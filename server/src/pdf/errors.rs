#[derive(Debug, thiserror::Error)]
pub enum PdfError {
    #[error("malformed PDF: {0}")]
    Malformed(String),
    #[error("encrypted PDFs are not supported")]
    Encrypted,
    #[error("text run not found")]
    RunNotFound,
    #[error("page not found")]
    PageNotFound,
    #[error("stale document revision")]
    StaleRevision,
    #[error("PDF exceeds the 50MB upload limit")]
    TooLarge,
    #[error("replacement text cannot be encoded in the original font")]
    Unencodable,
    #[error("{0}")]
    Invalid(String),
}
