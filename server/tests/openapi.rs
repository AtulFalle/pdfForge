use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use pdfforge::app;
use tower::ServiceExt;

async fn get(path: &str) -> (StatusCode, Vec<u8>) {
    let response = app()
        .oneshot(
            Request::builder()
                .uri(path)
                .body(Body::empty())
                .expect("valid request"),
        )
        .await
        .expect("router should respond");

    let status = response.status();
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("readable body")
        .to_bytes()
        .to_vec();
    (status, bytes)
}

#[tokio::test]
async fn ready_returns_ok_json() {
    let (status, bytes) = get("/ready").await;
    assert_eq!(status, StatusCode::OK);

    let value: serde_json::Value =
        serde_json::from_slice(&bytes).expect("ready response should be JSON");
    assert_eq!(value["status"], "ok");
}

#[tokio::test]
async fn openapi_json_is_a_valid_spec() {
    let (status, bytes) = get("/api-docs/openapi.json").await;
    assert_eq!(status, StatusCode::OK);

    let value: serde_json::Value =
        serde_json::from_slice(&bytes).expect("openapi response should be JSON");
    assert!(
        value
            .get("openapi")
            .and_then(serde_json::Value::as_str)
            .is_some(),
        "spec must include an openapi version key, got {value}"
    );
    assert_eq!(value["info"]["title"], "PDFForge API");
    assert_eq!(value["info"]["license"]["name"], "MIT");
    let paths = value["paths"].as_object().expect("spec must include paths");
    assert!(paths.contains_key("/health"), "spec must document /health");
    assert!(paths.contains_key("/ready"), "spec must document /ready");
    assert!(
        paths.contains_key("/api/sessions"),
        "spec must document session upload"
    );
}

#[tokio::test]
async fn swagger_ui_is_served() {
    let (status, bytes) = get("/swagger-ui/").await;
    assert_eq!(status, StatusCode::OK);
    let body = String::from_utf8_lossy(&bytes);
    assert!(
        body.to_ascii_lowercase().contains("swagger"),
        "swagger UI should serve HTML, got: {body}"
    );
}
