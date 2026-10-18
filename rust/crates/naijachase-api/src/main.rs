use naijachase_api::{email_delivery_loop, load_state, router, weekly_expiration_loop};
use std::time::Duration;
use tokio::{sync::watch, task::JoinSet};
use tracing_subscriber::EnvFilter;

// Leave two seconds for runtime cleanup before systemd's 30-second stop limit.
const DRAIN_TIMEOUT: Duration = Duration::from_secs(27);

fn main() {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,tower_http=info")),
        )
        .init();
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap();
    let result = runtime.block_on(run());
    // spawn_blocking database calls cannot be cancelled; never let runtime Drop
    // wait indefinitely for them after the HTTP/worker drain deadline.
    runtime.shutdown_timeout(Duration::from_secs(1));
    if let Err(error) = result {
        tracing::error!(%error, "API stopped with an error");
        std::process::exit(2);
    }
}

fn shutdown_signal() -> impl std::future::Future<Output = ()> {
    #[cfg(unix)]
    {
        // Install both handlers before loading configuration or opening the DB.
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("install SIGTERM handler");
        let mut interrupt =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt())
                .expect("install SIGINT handler");
        async move {
            tokio::select! { _ = terminate.recv() => {}, _ = interrupt.recv() => {} }
        }
    }
    #[cfg(not(unix))]
    async {
        tokio::signal::ctrl_c()
            .await
            .expect("install Ctrl-C handler");
    }
}

async fn drain_server(
    server: impl std::future::Future<Output = Result<(), String>>,
    workers: &mut JoinSet<()>,
    mut stopping: watch::Receiver<bool>,
    deadline: Duration,
) -> Result<(), String> {
    tokio::pin!(server);
    tokio::select! {
        biased;
        _ = stopping.wait_for(|stop| *stop) => {
            match tokio::time::timeout(deadline, async {
                let result = server.await;
                while let Some(result) = workers.join_next().await {
                    if let Err(error) = result { tracing::error!(%error, "background worker stopped with an error"); }
                }
                result
            }).await {
                Ok(result) => result,
                Err(_) => { tracing::warn!("shutdown drain deadline reached"); Ok(()) }
            }
        },
        result = &mut server => result,
    }
}

async fn run() -> Result<(), String> {
    let (stop, stopping) = watch::channel(false);
    let signal = shutdown_signal();
    let signals = tokio::spawn(async move {
        signal.await;
        tracing::info!("shutdown requested; draining requests and workers");
        let _ = stop.send(true);
    });
    let state = load_state()?;
    let bind = state.config.bind.clone();
    let listener = tokio::net::TcpListener::bind(&bind)
        .await
        .map_err(|e| e.to_string())?;
    let mut workers = JoinSet::new();
    workers.spawn(weekly_expiration_loop(state.clone(), stopping.clone()));
    for _ in 0..state.config.email_worker_count {
        workers.spawn(email_delivery_loop(state.clone(), stopping.clone()));
    }
    tracing::info!(environment=?state.config.environment, bind=%bind, "Naija Chase API started");
    let mut http_stop = stopping.clone();
    let server = axum::serve(listener, router(state)).with_graceful_shutdown(async move {
        let _ = http_stop.wait_for(|stop| *stop).await;
    });
    let result = drain_server(
        async { server.await.map_err(|e| e.to_string()) },
        &mut workers,
        stopping,
        DRAIN_TIMEOUT,
    )
    .await;
    workers.abort_all();
    signals.abort();
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    };

    #[tokio::test]
    async fn shutdown_drains_in_flight_requests_and_workers() {
        let (stop, stopping) = watch::channel(false);
        let completed = Arc::new(AtomicBool::new(false));
        let worker_done = completed.clone();
        let mut worker_stop = stopping.clone();
        let mut workers = JoinSet::new();
        workers.spawn(async move {
            worker_stop.wait_for(|stop| *stop).await.unwrap();
            tokio::time::sleep(Duration::from_millis(20)).await;
            worker_done.store(true, Ordering::SeqCst);
        });
        let mut request_stop = stopping.clone();
        let request = async move {
            request_stop.wait_for(|stop| *stop).await.unwrap();
            tokio::time::sleep(Duration::from_millis(10)).await;
            Ok(())
        };
        stop.send(true).unwrap();
        drain_server(request, &mut workers, stopping, Duration::from_secs(1))
            .await
            .unwrap();
        assert!(completed.load(Ordering::SeqCst));
        assert!(workers.is_empty());
    }

    #[tokio::test]
    async fn shutdown_caps_a_stalled_request_and_worker() {
        let (stop, stopping) = watch::channel(false);
        let mut workers = JoinSet::new();
        workers.spawn(std::future::pending());
        stop.send(true).unwrap();
        tokio::time::timeout(
            Duration::from_secs(1),
            drain_server(
                std::future::pending(),
                &mut workers,
                stopping,
                Duration::from_millis(10),
            ),
        )
        .await
        .unwrap()
        .unwrap();
        workers.abort_all();
        assert!(DRAIN_TIMEOUT + Duration::from_secs(1) < Duration::from_secs(30));
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn signal_child() {
        let Some(path) = std::env::var_os("NAIJACHASE_SIGNAL_TEST_READY") else {
            return;
        };
        let signal = shutdown_signal();
        std::fs::write(path, "ready").unwrap();
        signal.await;
    }

    #[cfg(unix)]
    #[test]
    fn sigterm_and_ctrl_c_trigger_graceful_shutdown() {
        for signal in ["TERM", "INT"] {
            let path = std::env::temp_dir()
                .join(format!("naijachase-signal-{}-{signal}", std::process::id()));
            let _ = std::fs::remove_file(&path);
            let mut child = std::process::Command::new(std::env::current_exe().unwrap())
                .args(["--exact", "tests::signal_child", "--nocapture"])
                .env("NAIJACHASE_SIGNAL_TEST_READY", &path)
                .spawn()
                .unwrap();
            let deadline = std::time::Instant::now() + Duration::from_secs(5);
            while !path.exists() && std::time::Instant::now() < deadline {
                std::thread::sleep(Duration::from_millis(10));
            }
            if !path.exists() {
                let _ = child.kill();
                let _ = child.wait();
                panic!("signal child did not start");
            }
            assert!(
                std::process::Command::new("/bin/kill")
                    .args(["-s", signal, &child.id().to_string()])
                    .status()
                    .unwrap()
                    .success()
            );
            let status = loop {
                if let Some(status) = child.try_wait().unwrap() {
                    break status;
                }
                if std::time::Instant::now() > deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    panic!("shutdown signal was ignored");
                }
                std::thread::sleep(Duration::from_millis(10));
            };
            let _ = std::fs::remove_file(path);
            assert!(
                status.success(),
                "{signal} must complete gracefully, not kill the child"
            );
        }
    }
}
