use argon2::PasswordHash;
use mysql::{OptsBuilder, PoolConstraints, PoolOpts, SslOpts};
use std::{env, net::SocketAddr, path::PathBuf, time::Duration};

#[derive(Clone)]
pub struct Config {
    pub bind: SocketAddr,
    pub origin: String,
    pub username: String,
    pub password_hash: String,
    pub production: bool,
    pub disk_path: PathBuf,
    pub game_health_enabled: bool,
    pub ads_enabled: bool,
    pub ads_player_origin: String,
    pub mysql_options: OptsBuilder,
    pub control_mysql_options: OptsBuilder,
    pub backup_status_path: Option<PathBuf>,
    pub backup_max_age_hours: u64,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        Self::load(|name| env::var(name).ok())
    }

    fn load(mut get: impl FnMut(&str) -> Option<String>) -> Result<Self, String> {
        fn required(
            get: &mut impl FnMut(&str) -> Option<String>,
            name: &str,
        ) -> Result<String, String> {
            get(name)
                .filter(|v| !v.is_empty())
                .ok_or_else(|| format!("{name} is required"))
        }
        let environment = get("ADMIN_ENVIRONMENT").unwrap_or_else(|| "development".into());
        if environment != "development" && environment != "production" {
            return Err("ADMIN_ENVIRONMENT must be development or production".into());
        }
        let production = environment == "production";
        let bind: SocketAddr = get("ADMIN_BIND")
            .unwrap_or_else(|| "127.0.0.1:8081".into())
            .parse()
            .map_err(|_| "ADMIN_BIND must be an IP address and port")?;
        if !bind.ip().is_loopback() {
            return Err("ADMIN_BIND must use a loopback address behind the admin proxy".into());
        }
        let origin = get("ADMIN_PUBLIC_ORIGIN").unwrap_or_else(|| "http://127.0.0.1:4174".into());
        let parsed = reqwest::Url::parse(&origin)
            .map_err(|_| "ADMIN_PUBLIC_ORIGIN must be a valid origin")?;
        if !matches!(parsed.scheme(), "http" | "https")
            || parsed.host_str().is_none()
            || parsed.path() != "/"
            || parsed.query().is_some()
            || parsed.fragment().is_some()
            || !parsed.username().is_empty()
            || parsed.password().is_some()
            || origin != parsed.origin().ascii_serialization()
        {
            return Err("ADMIN_PUBLIC_ORIGIN must be an exact http(s) origin without a path or trailing slash".into());
        }
        if production && parsed.scheme() != "https" {
            return Err("production ADMIN_PUBLIC_ORIGIN must use HTTPS".into());
        }
        let ads_player_origin = get("ADMIN_ADS_PLAYER_ORIGIN").unwrap_or_else(|| {
            if production {
                "https://naijachase.app".into()
            } else {
                "http://localhost:4173".into()
            }
        });
        let player = reqwest::Url::parse(&ads_player_origin)
            .map_err(|_| "Invalid ADMIN_ADS_PLAYER_ORIGIN")?;
        if !matches!(player.scheme(), "http" | "https")
            || (production && player.scheme() != "https")
            || player.origin().ascii_serialization() != ads_player_origin
        {
            return Err(
                "ADMIN_ADS_PLAYER_ORIGIN must be an exact HTTP(S) origin (HTTPS in production)"
                    .into(),
            );
        }
        let username = get("ADMIN_BOOTSTRAP_USERNAME").unwrap_or_else(|| "admin".into());
        if !crate::control::valid_username(&username) {
            return Err("ADMIN_BOOTSTRAP_USERNAME must be 3..64 lowercase ASCII letters, digits, dot, dash or underscore".into());
        }
        let password_hash = get("ADMIN_BOOTSTRAP_PASSWORD_HASH").unwrap_or_default();
        if !password_hash.is_empty() {
            let hash = PasswordHash::new(&password_hash)
                .map_err(|_| "ADMIN_BOOTSTRAP_PASSWORD_HASH must be an Argon2id PHC hash")?;
            if hash.algorithm.as_str() != "argon2id" || hash.hash.is_none() || hash.salt.is_none() {
                return Err("ADMIN_BOOTSTRAP_PASSWORD_HASH must be an Argon2id PHC hash".into());
            }
        }
        let ssl_mode = get("ADMIN_MYSQL_SSL_MODE").unwrap_or_else(|| "disabled".into());
        let reporting_tls = mysql_tls_options(
            &ssl_mode,
            get("ADMIN_MYSQL_SSL_CA"),
            production,
            "ADMIN_MYSQL_SSL_MODE",
        )?;
        let port = get("ADMIN_MYSQL_PORT")
            .unwrap_or_else(|| "3306".into())
            .parse::<u16>()
            .map_err(|_| "ADMIN_MYSQL_PORT must be a valid port")?;
        let mut mysql_options = OptsBuilder::new()
            .ip_or_hostname(Some(required(&mut get, "ADMIN_MYSQL_HOST")?))
            .prefer_socket(false)
            .tcp_port(port)
            .user(Some(required(&mut get, "ADMIN_MYSQL_USER")?))
            .pass(Some(required(&mut get, "ADMIN_MYSQL_PASSWORD")?))
            .db_name(Some(required(&mut get, "ADMIN_MYSQL_DATABASE")?))
            .tcp_connect_timeout(Some(Duration::from_secs(3)))
            .read_timeout(Some(Duration::from_secs(3)))
            .write_timeout(Some(Duration::from_secs(3)))
            .pool_opts(PoolOpts::default().with_constraints(PoolConstraints::new(0, 4).unwrap()))
            .init(vec!["SET time_zone = '+00:00'".to_string()]);
        mysql_options = mysql_options.ssl_opts(reporting_tls);
        let control_host = get("ADMIN_CONTROL_MYSQL_HOST")
            .or_else(|| get("ADMIN_MYSQL_HOST"))
            .ok_or("ADMIN_CONTROL_MYSQL_HOST is required")?;
        let control_port = get("ADMIN_CONTROL_MYSQL_PORT")
            .or_else(|| get("ADMIN_MYSQL_PORT"))
            .unwrap_or_else(|| "3306".into())
            .parse::<u16>()
            .map_err(|_| "ADMIN_CONTROL_MYSQL_PORT must be a valid port")?;
        let control_user = required(&mut get, "ADMIN_CONTROL_MYSQL_USER")?;
        let control_password = required(&mut get, "ADMIN_CONTROL_MYSQL_PASSWORD")?;
        let control_database = required(&mut get, "ADMIN_CONTROL_MYSQL_DATABASE")?;
        if Some(&control_user) == get("ADMIN_MYSQL_USER").as_ref()
            || Some(&control_database) == get("ADMIN_MYSQL_DATABASE").as_ref()
        {
            return Err(
                "Admin control database and user must differ from the reporting database and user"
                    .into(),
            );
        }
        let control_ssl_mode = get("ADMIN_CONTROL_MYSQL_SSL_MODE")
            .or_else(|| get("ADMIN_MYSQL_SSL_MODE"))
            .unwrap_or_else(|| "disabled".into());
        let control_tls = mysql_tls_options(
            &control_ssl_mode,
            get("ADMIN_CONTROL_MYSQL_SSL_CA").or_else(|| get("ADMIN_MYSQL_SSL_CA")),
            production,
            "ADMIN_CONTROL_MYSQL_SSL_MODE",
        )?;
        let mut control_mysql_options = OptsBuilder::new()
            .ip_or_hostname(Some(control_host))
            .prefer_socket(false)
            .tcp_port(control_port)
            .user(Some(control_user))
            .pass(Some(control_password))
            .db_name(Some(control_database))
            .tcp_connect_timeout(Some(Duration::from_secs(3)))
            .read_timeout(Some(Duration::from_secs(3)))
            .write_timeout(Some(Duration::from_secs(3)))
            .pool_opts(PoolOpts::default().with_constraints(PoolConstraints::new(0, 4).unwrap()))
            .init(vec!["SET time_zone = '+00:00'".to_string()]);
        control_mysql_options = control_mysql_options.ssl_opts(control_tls);
        let backup_status_path = get("ADMIN_BACKUP_STATUS_PATH")
            .filter(|p| !p.is_empty())
            .map(PathBuf::from);
        if backup_status_path
            .as_ref()
            .is_some_and(|path| !path.is_absolute())
        {
            return Err("ADMIN_BACKUP_STATUS_PATH must be an absolute path".into());
        }
        let backup_max_age_hours = get("ADMIN_BACKUP_MAX_AGE_HOURS")
            .unwrap_or_else(|| "24".into())
            .parse::<u64>()
            .map_err(|_| "ADMIN_BACKUP_MAX_AGE_HOURS must be 1..8760")?;
        if !(1..=8760).contains(&backup_max_age_hours) {
            return Err("ADMIN_BACKUP_MAX_AGE_HOURS must be 1..8760".into());
        }
        let health = get("ADMIN_GAME_HEALTH_ENABLED").unwrap_or_else(|| "false".into());
        if !matches!(health.as_str(), "true" | "false") {
            return Err("ADMIN_GAME_HEALTH_ENABLED must be true or false".into());
        }
        let ads = get("ADMIN_ADS_ENABLED").unwrap_or_else(|| "false".into());
        if !matches!(ads.as_str(), "true" | "false") {
            return Err("ADMIN_ADS_ENABLED must be true or false".into());
        }
        Ok(Self {
            bind,
            origin,
            username,
            password_hash,
            production,
            disk_path: get("ADMIN_DISK_PATH")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("/")),
            game_health_enabled: health == "true",
            ads_enabled: ads == "true",
            ads_player_origin,
            mysql_options,
            control_mysql_options,
            backup_status_path,
            backup_max_age_hours,
        })
    }
}

/// `required` matches the game's encryption-only contract. Any `Some(SslOpts)`
/// makes mysql reject servers without TLS; certificate verification is opt-in.
fn mysql_tls_options(
    mode: &str,
    ca: Option<String>,
    production: bool,
    setting: &str,
) -> Result<Option<SslOpts>, String> {
    match mode {
        "disabled" if production => Err(format!(
            "production {setting} must be required or verify_identity"
        )),
        "disabled" => Ok(None),
        "required" => Ok(Some(
            SslOpts::default()
                .with_danger_accept_invalid_certs(true)
                .with_danger_skip_domain_validation(true),
        )),
        "verify_identity" => {
            let mut tls = SslOpts::default();
            if let Some(path) = ca.filter(|path| !path.is_empty()) {
                tls = tls.with_root_cert_path(Some(PathBuf::from(path)));
            }
            Ok(Some(tls))
        }
        _ => Err(format!(
            "{setting} must be disabled, required or verify_identity"
        )),
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    fn with_overrides(overrides: &[(&str, &str)]) -> Result<Config, String> {
        let vars = [
            ("ADMIN_BOOTSTRAP_USERNAME", "operator"),
            (
                "ADMIN_BOOTSTRAP_PASSWORD_HASH",
                "$argon2id$v=19$m=19456,t=2,p=1$YWJjZGVmZ2hpamtsbW5vcA$fXVb6z8id8LbrB8yKL+f5Bv9ZnBTtOCxb7CYp9bWQcs",
            ),
            ("ADMIN_MYSQL_HOST", "127.0.0.1"),
            ("ADMIN_MYSQL_USER", "reports"),
            ("ADMIN_MYSQL_PASSWORD", "unused"),
            ("ADMIN_MYSQL_DATABASE", "test"),
            ("ADMIN_CONTROL_MYSQL_USER", "control"),
            ("ADMIN_CONTROL_MYSQL_PASSWORD", "unused-control"),
            ("ADMIN_CONTROL_MYSQL_DATABASE", "test_admin"),
        ];
        Config::load(|name| {
            overrides
                .iter()
                .chain(vars.iter())
                .find(|v| v.0 == name)
                .map(|v| v.1.to_owned())
        })
    }
    pub fn config() -> Config {
        with_overrides(&[]).unwrap()
    }
    #[test]
    fn rejects_non_loopback_bind_and_unsafe_origin() {
        assert!(
            Config::load(|n| match n {
                "ADMIN_BIND" => Some("0.0.0.0:8081".into()),
                _ => None,
            })
            .is_err()
        );
        assert!(
            Config::load(|n| match n {
                "ADMIN_PUBLIC_ORIGIN" => Some("http://localhost:4174/".into()),
                _ => None,
            })
            .is_err()
        );
    }
    #[test]
    fn production_rejects_plaintext_for_each_pool() {
        let base = [
            ("ADMIN_ENVIRONMENT", "production"),
            ("ADMIN_PUBLIC_ORIGIN", "https://admin.example.test"),
        ];
        for (report, control) in [
            ("disabled", "required"),
            ("required", "disabled"),
            ("disabled", "disabled"),
        ] {
            let mut overrides = base.to_vec();
            overrides.extend([
                ("ADMIN_MYSQL_SSL_MODE", report),
                ("ADMIN_CONTROL_MYSQL_SSL_MODE", control),
            ]);
            assert!(
                with_overrides(&overrides)
                    .err()
                    .unwrap()
                    .contains("must be required or verify_identity")
            );
        }
    }
    #[test]
    fn required_matches_game_encryption_flags_and_control_inherits() {
        let config = with_overrides(&[
            ("ADMIN_MYSQL_SSL_MODE", "required"),
            ("ADMIN_MYSQL_SSL_CA", "/unused/in/encryption-only-mode.pem"),
        ])
        .unwrap();
        for builder in [config.mysql_options, config.control_mysql_options] {
            let opts: mysql::Opts = builder.into();
            let tls = opts
                .get_ssl_opts()
                .expect("Some TLS options forbids plaintext fallback in mysql");
            assert!(tls.accept_invalid_certs());
            assert!(tls.skip_domain_validation());
            assert!(tls.root_cert_path().is_none());
            assert!(!opts.get_prefer_socket());
        }
    }
    #[test]
    fn verify_identity_validates_chain_and_host_and_inherits_ca() {
        let config = with_overrides(&[
            ("ADMIN_MYSQL_SSL_MODE", "verify_identity"),
            ("ADMIN_MYSQL_SSL_CA", "/reporting-ca.pem"),
        ])
        .unwrap();
        for builder in [config.mysql_options, config.control_mysql_options] {
            let opts: mysql::Opts = builder.into();
            let tls = opts
                .get_ssl_opts()
                .expect("identity verification requires TLS");
            assert!(!tls.accept_invalid_certs());
            assert!(!tls.skip_domain_validation());
            assert_eq!(
                tls.root_cert_path(),
                Some(std::path::Path::new("/reporting-ca.pem"))
            );
        }
        let config = with_overrides(&[
            ("ADMIN_MYSQL_SSL_MODE", "required"),
            ("ADMIN_CONTROL_MYSQL_SSL_MODE", "verify_identity"),
            ("ADMIN_MYSQL_SSL_CA", "/reporting-ca.pem"),
            ("ADMIN_CONTROL_MYSQL_SSL_CA", "/control-ca.pem"),
        ])
        .unwrap();
        let reports: mysql::Opts = config.mysql_options.into();
        assert!(reports.get_ssl_opts().unwrap().accept_invalid_certs());
        let control: mysql::Opts = config.control_mysql_options.into();
        assert!(!control.get_ssl_opts().unwrap().accept_invalid_certs());
        assert!(!control.get_ssl_opts().unwrap().skip_domain_validation());
        assert_eq!(
            control.get_ssl_opts().unwrap().root_cert_path(),
            Some(std::path::Path::new("/control-ca.pem"))
        );
    }
    #[test]
    fn verified_mode_uses_system_roots_without_a_custom_ca_and_development_can_disable_tls() {
        let config = with_overrides(&[
            ("ADMIN_MYSQL_SSL_MODE", "verify_identity"),
            ("ADMIN_CONTROL_MYSQL_SSL_MODE", "disabled"),
        ])
        .unwrap();
        let report: mysql::Opts = config.mysql_options.into();
        let tls = report.get_ssl_opts().unwrap();
        assert!(!tls.accept_invalid_certs());
        assert!(!tls.skip_domain_validation());
        assert!(tls.root_cert_path().is_none());
        let control: mysql::Opts = config.control_mysql_options.into();
        assert!(control.get_ssl_opts().is_none());
        let development = with_overrides(&[]).unwrap();
        assert!(
            mysql::Opts::from(development.mysql_options)
                .get_ssl_opts()
                .is_none()
        );
        assert!(
            mysql::Opts::from(development.control_mysql_options)
                .get_ssl_opts()
                .is_none()
        );
    }
    #[test]
    fn production_accepts_both_encrypted_modes_and_rejects_unknown_modes() {
        for mode in ["required", "verify_identity"] {
            let config = with_overrides(&[
                ("ADMIN_ENVIRONMENT", "production"),
                ("ADMIN_PUBLIC_ORIGIN", "https://admin.example.test"),
                ("ADMIN_MYSQL_SSL_MODE", mode),
            ])
            .unwrap();
            assert!(
                mysql::Opts::from(config.mysql_options)
                    .get_ssl_opts()
                    .is_some()
            );
            assert!(
                mysql::Opts::from(config.control_mysql_options)
                    .get_ssl_opts()
                    .is_some()
            );
        }
        for setting in ["ADMIN_MYSQL_SSL_MODE", "ADMIN_CONTROL_MYSQL_SSL_MODE"] {
            assert!(
                with_overrides(&[(setting, "preferred")])
                    .err()
                    .unwrap()
                    .contains("must be disabled, required or verify_identity")
            );
        }
    }
}
