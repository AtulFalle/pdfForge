use std::net::SocketAddr;
use std::path::PathBuf;

use clap::{Parser, Subcommand};
use pdfforge::pdf::{analyze, load_pdf, replace_run, save_pdf};
use pdfforge::{app_with_state, AppState};

#[derive(Parser)]
#[command(name = "pdfforge", about = "PDFForge API — content-stream PDF editor")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Serve the HTTP API
    Serve {
        #[arg(long, default_value = "0.0.0.0:3000")]
        bind: String,
    },
    /// Print text-run analysis as JSON
    Analyze { path: PathBuf },
    /// Replace a text run and write a new PDF
    Replace {
        path: PathBuf,
        #[arg(long)]
        run_id: String,
        #[arg(long)]
        text: String,
        #[arg(short, long)]
        output: PathBuf,
    },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let command = Cli::parse().command.unwrap_or(Command::Serve {
        bind: "0.0.0.0:3000".to_string(),
    });
    match command {
        Command::Serve { bind } => serve(&bind).await,
        Command::Analyze { path } => analyze_file(&path),
        Command::Replace {
            path,
            run_id,
            text,
            output,
        } => replace_file(&path, &run_id, &text, &output),
    }
}

async fn serve(bind: &str) -> Result<(), Box<dyn std::error::Error>> {
    let state = AppState::from_env()?;
    let addr = listen_addr(bind)?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    println!("PDFForge listening on {addr}");
    println!("OpenAPI: http://{addr}/swagger-ui/");
    axum::serve(listener, app_with_state(state))
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

fn listen_addr(cli_bind: &str) -> Result<SocketAddr, std::net::AddrParseError> {
    if let Ok(port) = std::env::var("PORT") {
        if let Ok(port) = port.parse::<u16>() {
            return format!("0.0.0.0:{port}").parse();
        }
    }
    cli_bind.parse()
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                let _ = signal.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {}
        () = terminate => {}
    }
}

fn analyze_file(path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    let bytes = std::fs::read(path)?;
    let document = load_pdf(&bytes)?;
    let analysis = analyze(&document, 1)?;
    println!("{}", serde_json::to_string_pretty(&analysis)?);
    Ok(())
}

fn replace_file(
    path: &PathBuf,
    run_id: &str,
    text: &str,
    output: &PathBuf,
) -> Result<(), Box<dyn std::error::Error>> {
    let bytes = std::fs::read(path)?;
    let mut document = load_pdf(&bytes)?;
    let result = replace_run(&mut document, run_id, text)?;
    std::fs::write(output, save_pdf(&mut document)?)?;
    println!(
        "wrote {} (font_fallback={})",
        output.display(),
        result.font_fallback
    );
    Ok(())
}
