use naijachase_api::{load_state, router};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,tower_http=info")),
        )
        .init();
    let state = load_state().unwrap_or_else(|error| {
        eprintln!("API startup failed: {error}");
        std::process::exit(2)
    });
    let bind = state.config.bind.clone();
    let listener = tokio::net::TcpListener::bind(&bind)
        .await
        .unwrap_or_else(|error| {
            eprintln!("Could not bind {bind}: {error}");
            std::process::exit(2)
        });
    tracing::info!(environment=?state.config.environment, bind=%bind, "Naija Chase API started");
    axum::serve(listener, router(state))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .unwrap();
}
