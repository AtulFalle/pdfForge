use axum::extract::{DefaultBodyLimit, Multipart, Path, Query, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::Response;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use super::error::ApiError;
use super::AppState;
use crate::pdf::{AddText, DocumentAnalysis, PageRotation, PdfError, TextRun};
use crate::sessions::SessionSnapshot;

pub const MAX_UPLOAD_BYTES: usize = 50 * 1024 * 1024;

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MutationResponse {
    pub session_id: Uuid,
    pub revision: u64,
    pub analysis: DocumentAnalysis,
    pub file_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_fallback: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ReplaceBody {
    pub text: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ReorderBody {
    pub order: Vec<u32>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RotateBody {
    pub rotations: Vec<PageRotation>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct DeletePagesBody {
    pub pages: Vec<u32>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct DuplicatePageBody {
    pub page: u32,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SplitBody {
    pub pages: Vec<u32>,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct SearchQuery {
    pub q: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/sessions", post(create_session))
        .route(
            "/api/sessions/{id}",
            get(get_session).delete(delete_session),
        )
        .route("/api/sessions/{id}/file", get(get_file))
        .route("/api/sessions/{id}/export", get(export_file))
        .route("/api/sessions/{id}/analysis", get(get_analysis))
        .route("/api/sessions/{id}/search", get(search_session))
        .route("/api/sessions/{id}/runs", post(add_run))
        .route(
            "/api/sessions/{id}/runs/{run_id}",
            axum::routing::put(replace_text).delete(remove_run),
        )
        .route("/api/sessions/{id}/pages/reorder", post(reorder))
        .route("/api/sessions/{id}/pages/rotate", post(rotate))
        .route("/api/sessions/{id}/pages/delete", post(remove_pages))
        .route("/api/sessions/{id}/pages/duplicate", post(duplicate_page))
        .route("/api/sessions/{id}/merge", post(merge_session))
        .route("/api/sessions/{id}/split", post(split_session))
        .route("/api/sessions/{id}/undo", post(undo_session))
        .route("/api/sessions/{id}/redo", post(redo_session))
        .layer(DefaultBodyLimit::max(MAX_UPLOAD_BYTES))
}

/// Upload a PDF and open an editing session.
#[utoipa::path(
    post,
    path = "/api/sessions",
    tag = "sessions",
    request_body(content_type = "multipart/form-data"),
    responses(
        (status = 201, description = "Session created", body = MutationResponse),
        (status = 400, description = "Invalid PDF", body = super::error::ErrorBody)
    )
)]
pub(crate) async fn create_session(
    State(state): State<AppState>,
    multipart: Multipart,
) -> Result<(StatusCode, Json<MutationResponse>), ApiError> {
    let bytes = read_pdf_upload(multipart, "file").await?;
    let snapshot = state.sessions.create(&bytes)?;
    Ok((StatusCode::CREATED, Json(mutation(&snapshot, None))))
}

/// Get session analysis and current revision.
#[utoipa::path(
    get,
    path = "/api/sessions/{id}",
    tag = "sessions",
    params(("id" = Uuid, Path, description = "Session id")),
    responses((status = 200, body = MutationResponse), (status = 404, body = super::error::ErrorBody))
)]
pub(crate) async fn get_session(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<MutationResponse>, ApiError> {
    Ok(Json(mutation(&state.sessions.get(id)?, None)))
}

/// Delete a session and its temporary files.
#[utoipa::path(
    delete,
    path = "/api/sessions/{id}",
    tag = "sessions",
    params(("id" = Uuid, Path, description = "Session id")),
    responses((status = 204, description = "Deleted"))
)]
pub(crate) async fn delete_session(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    state.sessions.delete(id)?;
    Ok(StatusCode::NO_CONTENT)
}

/// Download the current PDF bytes.
#[utoipa::path(
    get,
    path = "/api/sessions/{id}/file",
    tag = "sessions",
    params(("id" = Uuid, Path, description = "Session id")),
    responses((status = 200, description = "PDF bytes"))
)]
pub(crate) async fn get_file(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Response, ApiError> {
    pdf_response(state.sessions.file_bytes(id)?, "current.pdf")
}

/// Export the current PDF as an attachment.
#[utoipa::path(
    get,
    path = "/api/sessions/{id}/export",
    tag = "sessions",
    params(("id" = Uuid, Path, description = "Session id")),
    responses((status = 200, description = "PDF bytes"))
)]
pub(crate) async fn export_file(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Response, ApiError> {
    pdf_response(state.sessions.file_bytes(id)?, "export.pdf")
}

/// Return the latest text-run analysis.
#[utoipa::path(
    get,
    path = "/api/sessions/{id}/analysis",
    tag = "sessions",
    params(("id" = Uuid, Path, description = "Session id")),
    responses((status = 200, body = DocumentAnalysis))
)]
pub(crate) async fn get_analysis(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<DocumentAnalysis>, ApiError> {
    Ok(Json(state.sessions.get(id)?.analysis))
}

/// Search extracted text runs.
#[utoipa::path(
    get,
    path = "/api/sessions/{id}/search",
    tag = "sessions",
    params(("id" = Uuid, Path, description = "Session id"), SearchQuery),
    responses((status = 200, body = [TextRun]))
)]
pub(crate) async fn search_session(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Vec<TextRun>>, ApiError> {
    Ok(Json(state.sessions.search(id, &query.q)?.runs))
}

/// Replace a text run. Requires X-Document-Revision.
#[utoipa::path(
    put,
    path = "/api/sessions/{id}/runs/{run_id}",
    tag = "sessions",
    params(
        ("id" = Uuid, Path, description = "Session id"),
        ("run_id" = String, Path, description = "Text run id")
    ),
    request_body = ReplaceBody,
    responses(
        (status = 200, body = MutationResponse),
        (status = 409, description = "Stale revision", body = super::error::ErrorBody)
    )
)]
pub(crate) async fn replace_text(
    State(state): State<AppState>,
    Path((id, run_id)): Path<(Uuid, String)>,
    headers: HeaderMap,
    Json(body): Json<ReplaceBody>,
) -> Result<Json<MutationResponse>, ApiError> {
    let revision = require_revision(&headers)?;
    let (snapshot, font_fallback) = state.sessions.replace(id, revision, &run_id, &body.text)?;
    Ok(Json(mutation(&snapshot, Some(font_fallback))))
}

/// Delete a text run.
#[utoipa::path(
    delete,
    path = "/api/sessions/{id}/runs/{run_id}",
    tag = "sessions",
    params(
        ("id" = Uuid, Path, description = "Session id"),
        ("run_id" = String, Path, description = "Text run id")
    ),
    responses((status = 200, body = MutationResponse), (status = 409, body = super::error::ErrorBody))
)]
pub(crate) async fn remove_run(
    State(state): State<AppState>,
    Path((id, run_id)): Path<(Uuid, String)>,
    headers: HeaderMap,
) -> Result<Json<MutationResponse>, ApiError> {
    let revision = require_revision(&headers)?;
    Ok(Json(mutation(
        &state.sessions.delete_text(id, revision, &run_id)?,
        None,
    )))
}

/// Add text at a PDF user-space baseline origin.
#[utoipa::path(
    post,
    path = "/api/sessions/{id}/runs",
    tag = "sessions",
    params(("id" = Uuid, Path, description = "Session id")),
    request_body = AddText,
    responses((status = 200, body = MutationResponse))
)]
pub(crate) async fn add_run(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(body): Json<AddText>,
) -> Result<Json<MutationResponse>, ApiError> {
    let revision = require_revision(&headers)?;
    Ok(Json(mutation(
        &state.sessions.add(id, revision, body)?,
        None,
    )))
}

/// Reorder pages.
#[utoipa::path(
    post,
    path = "/api/sessions/{id}/pages/reorder",
    tag = "pages",
    params(("id" = Uuid, Path, description = "Session id")),
    request_body = ReorderBody,
    responses((status = 200, body = MutationResponse))
)]
pub(crate) async fn reorder(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(body): Json<ReorderBody>,
) -> Result<Json<MutationResponse>, ApiError> {
    let revision = require_revision(&headers)?;
    Ok(Json(mutation(
        &state.sessions.reorder(id, revision, &body.order)?,
        None,
    )))
}

/// Rotate pages.
#[utoipa::path(
    post,
    path = "/api/sessions/{id}/pages/rotate",
    tag = "pages",
    params(("id" = Uuid, Path, description = "Session id")),
    request_body = RotateBody,
    responses((status = 200, body = MutationResponse))
)]
pub(crate) async fn rotate(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(body): Json<RotateBody>,
) -> Result<Json<MutationResponse>, ApiError> {
    let revision = require_revision(&headers)?;
    Ok(Json(mutation(
        &state.sessions.rotate(id, revision, &body.rotations)?,
        None,
    )))
}

/// Delete pages.
#[utoipa::path(
    post,
    path = "/api/sessions/{id}/pages/delete",
    tag = "pages",
    params(("id" = Uuid, Path, description = "Session id")),
    request_body = DeletePagesBody,
    responses((status = 200, body = MutationResponse))
)]
pub(crate) async fn remove_pages(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(body): Json<DeletePagesBody>,
) -> Result<Json<MutationResponse>, ApiError> {
    let revision = require_revision(&headers)?;
    Ok(Json(mutation(
        &state.sessions.remove_pages(id, revision, &body.pages)?,
        None,
    )))
}

/// Duplicate a page (inserts a copy immediately after the source page).
#[utoipa::path(
    post,
    path = "/api/sessions/{id}/pages/duplicate",
    tag = "pages",
    params(("id" = Uuid, Path, description = "Session id")),
    request_body = DuplicatePageBody,
    responses((status = 200, body = MutationResponse))
)]
pub(crate) async fn duplicate_page(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(body): Json<DuplicatePageBody>,
) -> Result<Json<MutationResponse>, ApiError> {
    let revision = require_revision(&headers)?;
    Ok(Json(mutation(
        &state.sessions.duplicate(id, revision, body.page)?,
        None,
    )))
}

/// Merge another PDF into this session.
#[utoipa::path(
    post,
    path = "/api/sessions/{id}/merge",
    tag = "pages",
    params(("id" = Uuid, Path, description = "Session id")),
    request_body(content_type = "multipart/form-data"),
    responses((status = 200, body = MutationResponse))
)]
pub(crate) async fn merge_session(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    multipart: Multipart,
) -> Result<Json<MutationResponse>, ApiError> {
    let revision = require_revision(&headers)?;
    let bytes = read_pdf_upload(multipart, "file").await?;
    Ok(Json(mutation(
        &state.sessions.merge(id, revision, &bytes)?,
        None,
    )))
}

/// Split selected pages into a new PDF download.
#[utoipa::path(
    post,
    path = "/api/sessions/{id}/split",
    tag = "pages",
    params(("id" = Uuid, Path, description = "Session id")),
    request_body = SplitBody,
    responses((status = 200, description = "PDF bytes"))
)]
pub(crate) async fn split_session(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<SplitBody>,
) -> Result<Response, ApiError> {
    pdf_response(state.sessions.split(id, &body.pages)?, "split.pdf")
}

/// Undo the previous mutation.
#[utoipa::path(
    post,
    path = "/api/sessions/{id}/undo",
    tag = "sessions",
    params(("id" = Uuid, Path, description = "Session id")),
    responses((status = 200, body = MutationResponse), (status = 409, body = super::error::ErrorBody))
)]
pub(crate) async fn undo_session(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<Json<MutationResponse>, ApiError> {
    let revision = require_revision(&headers)?;
    Ok(Json(mutation(&state.sessions.undo(id, revision)?, None)))
}

/// Redo the last undone mutation.
#[utoipa::path(
    post,
    path = "/api/sessions/{id}/redo",
    tag = "sessions",
    params(("id" = Uuid, Path, description = "Session id")),
    responses((status = 200, body = MutationResponse), (status = 409, body = super::error::ErrorBody))
)]
pub(crate) async fn redo_session(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<Json<MutationResponse>, ApiError> {
    let revision = require_revision(&headers)?;
    Ok(Json(mutation(&state.sessions.redo(id, revision)?, None)))
}

fn mutation(snapshot: &SessionSnapshot, font_fallback: Option<bool>) -> MutationResponse {
    MutationResponse {
        session_id: snapshot.id,
        revision: snapshot.revision,
        analysis: snapshot.analysis.clone(),
        file_url: format!("/api/sessions/{}/file", snapshot.id),
        font_fallback,
    }
}

fn require_revision(headers: &HeaderMap) -> Result<u64, ApiError> {
    headers
        .get("X-Document-Revision")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse().ok())
        .ok_or_else(|| ApiError::bad_request("X-Document-Revision header is required"))
}

pub(crate) async fn read_pdf_upload(
    mut multipart: Multipart,
    field_name: &str,
) -> Result<Vec<u8>, ApiError> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|error| ApiError::bad_request(error.to_string()))?
    {
        if field.name() == Some(field_name) {
            let bytes = field
                .bytes()
                .await
                .map_err(|error| ApiError::bad_request(error.to_string()))?;
            if bytes.len() > MAX_UPLOAD_BYTES {
                return Err(PdfError::TooLarge.into());
            }
            return Ok(bytes.to_vec());
        }
    }
    Err(ApiError::bad_request("missing file field"))
}

fn pdf_response(bytes: Vec<u8>, filename: &str) -> Result<Response, ApiError> {
    let mut response = Response::new(bytes.into());
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/pdf"),
    );
    if let Ok(value) = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\"")) {
        response
            .headers_mut()
            .insert(header::CONTENT_DISPOSITION, value);
    }
    Ok(response)
}
