use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use utoipa::ToSchema;

use crate::pdf::PdfError;

#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorBody {
    pub error: String,
    pub message: String,
}

pub struct ApiError {
    status: StatusCode,
    body: ErrorBody,
}

impl ApiError {
    pub fn new(status: StatusCode, error: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            status,
            body: ErrorBody {
                error: error.into(),
                message: message.into(),
            },
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, "not_found", message)
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "bad_request", message)
    }
}

impl From<PdfError> for ApiError {
    fn from(error: PdfError) -> Self {
        match error {
            PdfError::StaleRevision => Self::new(
                StatusCode::CONFLICT,
                "stale_revision",
                "X-Document-Revision does not match the current session",
            ),
            PdfError::RunNotFound => Self::not_found("text run not found"),
            PdfError::PageNotFound => Self::not_found("page not found"),
            PdfError::Encrypted => Self::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                "encrypted",
                "encrypted PDFs are not supported",
            ),
            PdfError::TooLarge => Self::new(
                StatusCode::PAYLOAD_TOO_LARGE,
                "too_large",
                "PDF exceeds the 50MB upload limit",
            ),
            PdfError::Malformed(message) => Self::bad_request(message),
            PdfError::Invalid(message) if message.contains("session not found") => {
                Self::not_found("session not found")
            }
            PdfError::Invalid(message) => Self::bad_request(message),
            PdfError::Unencodable => Self::bad_request("text cannot be encoded"),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(self.body)).into_response()
    }
}
