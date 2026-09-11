use std::net::SocketAddr;

use pdfforge::app;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    println!("pdfforge listening on {addr}");
    axum::serve(listener, app()).await?;
    Ok(())
}
