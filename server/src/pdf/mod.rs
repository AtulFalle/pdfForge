mod editing;
mod errors;
mod extraction;
mod fonts;
mod sample;

pub use editing::{
    add_text, delete_pages, delete_run, duplicate_page, merge_documents, reorder_pages,
    replace_run, rotate_pages, search_runs, split_document, AddText, PageRotation, ReplaceResult,
};
pub use errors::PdfError;
pub use extraction::analyze;
pub use sample::{hello_pdf, scanned_pdf, simple_text_pdf, two_page_pdf};

use lopdf::Document;

const MAX_PAGE_CONTENT_BYTES: usize = 16 * 1024 * 1024;
const MAX_PDF_BYTES: usize = 50 * 1024 * 1024;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct BBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct TextStyle {
    pub font_name: String,
    pub size: f32,
    pub color: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct TextRun {
    pub id: String,
    pub page: u32,
    pub text: String,
    pub bbox: BBox,
    pub style: TextStyle,
    pub transform: [f32; 6],
    pub source_operators: Vec<String>,
    pub font_fallback: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct PageInfo {
    pub number: u32,
    pub width: f32,
    pub height: f32,
    pub rotation: i32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct DocumentAnalysis {
    pub revision: u64,
    pub pages: Vec<PageInfo>,
    pub runs: Vec<TextRun>,
}

pub fn load_pdf(bytes: &[u8]) -> Result<Document, PdfError> {
    if bytes.len() > MAX_PDF_BYTES {
        return Err(PdfError::TooLarge);
    }
    if !bytes.starts_with(b"%PDF") {
        return Err(PdfError::Malformed("file is not a PDF".into()));
    }
    let document = Document::load_from(std::io::Cursor::new(bytes))
        .map_err(|error| PdfError::Malformed(error.to_string()))?;
    if document.is_encrypted() || document.was_encrypted() {
        return Err(PdfError::Encrypted);
    }
    Ok(document)
}

pub fn save_pdf(document: &mut Document) -> Result<Vec<u8>, PdfError> {
    let mut bytes = Vec::new();
    document
        .save_to(&mut bytes)
        .map_err(|error| PdfError::Malformed(error.to_string()))?;
    Ok(bytes)
}
