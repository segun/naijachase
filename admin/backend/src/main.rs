use naijachase_admin::{AppState, config::Config, router};
use std::{io, time::Duration};

fn main() {
    if std::env::args().nth(1).as_deref() == Some("--hash-password") {
        use argon2::{Argon2, PasswordHasher, password_hash::SaltString};
        use rand::RngCore;
        let mut password = String::new();
        io::stdin()
            .read_line(&mut password)
            .expect("read password from stdin");
        while password.ends_with(['\r', '\n']) {
            password.pop();
        }
        if password.len() < 16 || password.len() > 128 {
            eprintln!("Password must contain 16 to 128 bytes");
            std::process::exit(2);
        }
        let mut bytes = [0_u8; 16];
        rand::rng().fill_bytes(&mut bytes);
        let salt = SaltString::encode_b64(&bytes).unwrap();
        println!(
            "{}",
            Argon2::default()
                .hash_password(password.as_bytes(), &salt)
                .unwrap()
        );
        return;
    }
    tracing_subscriber::fmt()
        .json()
        .with_env_filter("info")
        .init();
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap();
    let result = runtime.block_on(run());
    runtime.shutdown_timeout(Duration::from_secs(1));
    if let Err(error) = result {
        tracing::error!(%error, "admin backend stopped");
        std::process::exit(2);
    }
}

async fn run() -> Result<(), String> {
    let signal = shutdown_signal();
    let (stop, mut stopping) = tokio::sync::watch::channel(false);
    let signals = tokio::spawn(async move {
        signal.await;
        let _ = stop.send(true);
    });
    let config = Config::from_env()?;
    let bind = config.bind;
    let pool = mysql::Pool::new(config.mysql_options.clone())
        .map_err(|_| "Unable to initialize reporting database pool")?;
    let control_pool = mysql::Pool::new(config.control_mysql_options.clone())
        .map_err(|_| "Unable to initialize admin identity database pool")?;
    // Missing migrations, permissions, or control database prevent startup.
    naijachase_admin::initialize_control(&control_pool, &config)?;
    let state = AppState::new(config, Some(pool)).with_control_pool(control_pool);
    let listener = tokio::net::TcpListener::bind(bind)
        .await
        .map_err(|_| "Unable to bind admin listener")?;
    tracing::info!(%bind, "admin backend listening");
    let mut http_stop = stopping.clone();
    let server = axum::serve(
        listener,
        router(state).into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(async move {
        let _ = http_stop.wait_for(|stop| *stop).await;
    });
    // Bound request draining even if a reporting query is still blocked in the driver.
    let serving = async {
        server
            .await
            .map_err(|_| "Admin HTTP server failed".to_owned())
    };
    tokio::pin!(serving);
    let result = tokio::select! {
        result = &mut serving => result,
        _ = stopping.wait_for(|stop| *stop) => {
            match tokio::time::timeout(Duration::from_secs(20), serving).await {
                Ok(result) => result,
                Err(_) => Ok(()),
            }
        }
    };
    signals.abort();
    result
}

fn shutdown_signal() -> impl std::future::Future<Output = ()> {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("SIGTERM handler");
        let mut interrupt =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt())
                .expect("SIGINT handler");
        async move {
            tokio::select! { _ = terminate.recv() => {}, _ = interrupt.recv() => {} }
        }
    }
    #[cfg(not(unix))]
    async {
        let _ = tokio::signal::ctrl_c().await;
    }
}
