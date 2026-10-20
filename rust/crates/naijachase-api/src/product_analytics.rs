//! Small write-only product measurement boundary. No admin routes or admin authentication here.
use super::*;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct UsageEvent {
    kind: String,
    email: Option<String>,
}

fn visitor_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::COOKIE)?
        .to_str()
        .ok()?
        .split(';')
        .map(str::trim)
        .find_map(|cookie| cookie.strip_prefix("nc_usage="))
        .filter(|token| {
            token.len() == 43
                && token
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_'))
        })
        .map(str::to_owned)
}

fn usage_cookie(token: &str, config: &ServiceConfig, forget: bool) -> HeaderValue {
    let secure = if config.environment == Environment::Development {
        ""
    } else {
        "; Secure"
    };
    HeaderValue::from_str(&format!(
        "nc_usage={token}; Path=/api; HttpOnly; SameSite=Lax; Max-Age={}{}",
        if forget { 0 } else { 90 * 24 * 60 * 60 },
        secure
    ))
    .expect("validated opaque cookie")
}

fn normalize_draft_email(email: Option<String>) -> Result<Option<String>, ApiError> {
    let Some(email) = email else {
        return Ok(None);
    };
    let email = email.trim().to_lowercase();
    let valid = email.len() <= 320
        && email.is_ascii()
        && !email
            .bytes()
            .any(|b| b.is_ascii_whitespace() || b.is_ascii_control())
        && email.split_once('@').is_some_and(|(local, domain)| {
            !local.is_empty()
                && domain.contains('.')
                && !domain.contains('@')
                && !domain.starts_with('.')
                && !domain.ends_with('.')
        });
    if !valid {
        return Err(bad_request("enter a valid email address"));
    }
    Ok(Some(email))
}

pub(super) async fn record(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(event): Json<UsageEvent>,
) -> Result<Response, ApiError> {
    ensure_origin(&headers, &state.config)?;
    if !matches!(event.kind.as_str(), "visit" | "registration_start")
        || (event.kind == "visit" && event.email.is_some())
    {
        return Err(bad_request("invalid usage event"));
    }
    let email = normalize_draft_email(event.email)?;
    // Nginx overwrites X-Real-IP. Outside development the API is loopback-only.
    let ip = headers
        .get("x-real-ip")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("direct");
    enforce_auth_limit(&state, ip, "usage_ingress", 600).await?;
    let token = visitor_token(&headers).unwrap_or_else(random_token);
    let visitor_hash = hash_token(&token);
    enforce_auth_limit(&state, &visitor_hash, "usage", 12).await?;
    let session_hash = session_token(&headers).ok().map(|token| hash_token(&token));
    let store = state.store.clone();
    let accepted = tokio::task::spawn_blocking(move || {
        if event.kind == "registration_start" {
            store.record_registration_start(&visitor_hash, email.as_deref())
        } else {
            store.record_product_visit(&visitor_hash, session_hash.as_deref())
        }
    })
    .await
    .map_err(task_error)??;
    if !accepted {
        return Ok(StatusCode::NO_CONTENT.into_response());
    }
    let mut response = StatusCode::ACCEPTED.into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        usage_cookie(&token, &state.config, false),
    );
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok(response)
}

pub(super) async fn forget(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    ensure_origin(&headers, &state.config)?;
    if let Some(token) = visitor_token(&headers) {
        let store = state.store.clone();
        tokio::task::spawn_blocking(move || store.delete_product_analytics(&hash_token(&token)))
            .await
            .map_err(task_error)??;
    }
    let mut response = StatusCode::NO_CONTENT.into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, usage_cookie("", &state.config, true));
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok(response)
}

/// Starts immediately and repeats hourly. Each batch yields and observes shutdown.
pub async fn analytics_retention_loop(
    state: Arc<AppState>,
    mut stopping: tokio::sync::watch::Receiver<bool>,
) {
    loop {
        if *stopping.borrow() {
            return;
        }
        let store = state.store.clone();
        let more = match tokio::task::spawn_blocking(move || store.prune_product_analytics()).await
        {
            Ok(Ok(more)) => more,
            Ok(Err(error)) => {
                tracing::error!(%error, "usage retention cleanup failed");
                false
            }
            Err(error) => {
                tracing::error!(%error, "usage retention task failed");
                false
            }
        };
        tokio::select! {
            _ = stopping.wait_for(|stop| *stop) => return,
            _ = tokio::time::sleep(if more { Duration::from_millis(100) } else { Duration::from_secs(3600) }) => {},
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn visitor_cookie_accepts_only_bounded_random_tokens() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::COOKIE,
            HeaderValue::from_static("nc_usage=forged; nc_session=other"),
        );
        assert!(visitor_token(&headers).is_none());
        let token = random_token();
        headers.insert(
            header::COOKIE,
            HeaderValue::from_str(&format!("nc_session=other; nc_usage={token}")).unwrap(),
        );
        assert_eq!(visitor_token(&headers), Some(token));
    }
    #[test]
    fn draft_emails_are_normalized_and_control_characters_rejected() {
        assert_eq!(
            normalize_draft_email(Some(" ADA@Example.com ".into())).unwrap(),
            Some("ada@example.com".into())
        );
        for value in [
            "a",
            "a@b",
            "a@@b.com",
            "a@b.com\r\nBcc:test",
            "a @b.com",
            "@example.com",
        ] {
            assert!(
                normalize_draft_email(Some(value.into())).is_err(),
                "{value:?}"
            );
        }
        assert!(normalize_draft_email(None).unwrap().is_none());
    }
    #[test]
    fn usage_cookie_is_host_scoped_http_only_and_secure_outside_development() {
        let mut config = ServiceConfig::test();
        config.environment = Environment::Production;
        let cookie = usage_cookie(&random_token(), &config, false);
        let cookie = cookie.to_str().unwrap();
        assert!(cookie.contains("HttpOnly; SameSite=Lax"));
        assert!(cookie.ends_with("; Secure"));
        assert!(!cookie.contains("Domain="));
        assert!(
            usage_cookie("", &config, true)
                .to_str()
                .unwrap()
                .contains("Max-Age=0")
        );
    }
}
