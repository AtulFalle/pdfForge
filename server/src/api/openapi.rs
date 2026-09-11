use utoipa::OpenApi;

use super::error::ErrorBody;
use super::health::{HealthResponse, ReadyResponse};
use super::sessions::{
    DeletePagesBody, DuplicatePageBody, MutationResponse, ReorderBody, ReplaceBody, RotateBody,
    SplitBody,
};
use crate::pdf::{AddText, BBox, DocumentAnalysis, PageInfo, PageRotation, TextRun, TextStyle};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "PDFForge API",
        description = "Session API for content-stream PDF editing. Documents are processed in-session and are never sent to a third-party PDF service.",
        license(name = "MIT", url = "https://github.com/AtulFalle/pdfForge/blob/master/LICENSE")
    ),
    paths(
        crate::api::health::health,
        crate::api::health::ready,
        crate::api::sessions::create_session,
        crate::api::sessions::get_session,
        crate::api::sessions::delete_session,
        crate::api::sessions::get_file,
        crate::api::sessions::export_file,
        crate::api::sessions::get_analysis,
        crate::api::sessions::search_session,
        crate::api::sessions::replace_text,
        crate::api::sessions::remove_run,
        crate::api::sessions::add_run,
        crate::api::sessions::reorder,
        crate::api::sessions::rotate,
        crate::api::sessions::remove_pages,
        crate::api::sessions::duplicate_page,
        crate::api::sessions::merge_session,
        crate::api::sessions::split_session,
        crate::api::sessions::undo_session,
        crate::api::sessions::redo_session,
    ),
    components(schemas(
        HealthResponse,
        ReadyResponse,
        ErrorBody,
        MutationResponse,
        ReplaceBody,
        ReorderBody,
        RotateBody,
        DeletePagesBody,
        DuplicatePageBody,
        SplitBody,
        AddText,
        PageRotation,
        DocumentAnalysis,
        PageInfo,
        TextRun,
        TextStyle,
        BBox,
    )),
    tags(
        (name = "health", description = "Liveness and readiness"),
        (name = "sessions", description = "PDF editing sessions"),
        (name = "pages", description = "Page operations")
    )
)]
pub struct ApiDoc;
