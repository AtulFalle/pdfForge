use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use axum::Router;
use http_body_util::BodyExt;
use pdfforge::app;
use pdfforge::pdf::hello_pdf;
use tower::ServiceExt;

async fn send(app: Router, request: Request<Body>) -> (StatusCode, Vec<u8>) {
    let response = app.oneshot(request).await.expect("router should respond");
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

fn upload(bytes: &[u8]) -> Request<Body> {
    let boundary = "----pdfforgeTestBoundary";
    let mut body = Vec::new();
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"hello.pdf\"\r\nContent-Type: application/pdf\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(bytes);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    Request::builder()
        .method("POST")
        .uri("/api/sessions")
        .header(
            header::CONTENT_TYPE,
            format!("multipart/form-data; boundary={boundary}"),
        )
        .body(Body::from(body))
        .expect("upload request")
}

#[tokio::test]
async fn session_replace_roundtrip_and_stale_revision() {
    let app = app();
    let pdf = hello_pdf("Hello World").expect("sample");
    let (status, bytes) = send(app.clone(), upload(&pdf)).await;
    assert_eq!(status, StatusCode::CREATED);
    let created: serde_json::Value = serde_json::from_slice(&bytes).expect("json");
    let session_id = created["sessionId"].as_str().expect("sessionId");
    let revision = created["revision"].as_u64().expect("revision");
    let run_id = created["analysis"]["runs"][0]["id"]
        .as_str()
        .expect("run id")
        .to_string();
    assert_eq!(
        created["fileUrl"],
        format!("/api/sessions/{session_id}/file")
    );

    let (file_status, file_bytes) = send(
        app.clone(),
        Request::builder()
            .uri(format!("/api/sessions/{session_id}/file"))
            .body(Body::empty())
            .expect("file request"),
    )
    .await;
    assert_eq!(file_status, StatusCode::OK);
    assert!(file_bytes.starts_with(b"%PDF"));

    let replace = Request::builder()
        .method("PUT")
        .uri(format!("/api/sessions/{session_id}/runs/{run_id}"))
        .header("X-Document-Revision", revision.to_string())
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(r#"{"text":"Hello API"}"#))
        .expect("replace request");
    let (status, bytes) = send(app.clone(), replace).await;
    assert_eq!(status, StatusCode::OK);
    let mutated: serde_json::Value = serde_json::from_slice(&bytes).expect("json");
    assert_eq!(mutated["revision"], 2);
    assert_eq!(mutated["analysis"]["runs"][0]["text"], "Hello API");

    let stale = Request::builder()
        .method("PUT")
        .uri(format!("/api/sessions/{session_id}/runs/{run_id}"))
        .header("X-Document-Revision", revision.to_string())
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(r#"{"text":"stale"}"#))
        .expect("stale request");
    let (status, bytes) = send(app, stale).await;
    assert_eq!(status, StatusCode::CONFLICT);
    let error: serde_json::Value = serde_json::from_slice(&bytes).expect("json");
    assert_eq!(error["error"], "stale_revision");
}

#[tokio::test]
async fn openapi_documents_session_routes() {
    let (status, bytes) = send(
        app(),
        Request::builder()
            .uri("/api-docs/openapi.json")
            .body(Body::empty())
            .expect("openapi request"),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let spec: serde_json::Value = serde_json::from_slice(&bytes).expect("json");
    let paths = spec["paths"].as_object().expect("paths");
    assert!(paths.contains_key("/api/sessions"));
    assert!(paths.contains_key("/api/sessions/{id}/runs/{run_id}"));
    assert!(paths.contains_key("/api/sessions/{id}/pages/reorder"));
    assert!(paths.contains_key("/api/sessions/{id}/pages/duplicate"));
}
