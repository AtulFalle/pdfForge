use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use pdfforge::app;
use tower::ServiceExt;

#[tokio::test]
async fn health_returns_ok_json() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .expect("valid health request"),
        )
        .await
        .expect("router should respond");

    assert_eq!(response.status(), StatusCode::OK);

    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("readable body")
        .to_bytes();
    let value: serde_json::Value =
        serde_json::from_slice(&bytes).expect("health response should be JSON");
    assert_eq!(value["status"], "ok");
}
