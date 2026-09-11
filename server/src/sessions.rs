use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use uuid::Uuid;

use crate::pdf::{
    add_text, analyze, delete_pages, delete_run, load_pdf, merge_documents, reorder_pages,
    replace_run, rotate_pages, save_pdf, search_runs, split_document, AddText, DocumentAnalysis,
    PageRotation, PdfError,
};

const IDLE_TTL: Duration = Duration::from_secs(60 * 60);

pub struct SessionStore {
    root: PathBuf,
    last_access: Mutex<Vec<(Uuid, Instant)>>,
}

#[derive(Clone)]
pub struct SessionSnapshot {
    pub id: Uuid,
    pub revision: u64,
    pub analysis: DocumentAnalysis,
}

impl SessionStore {
    pub fn new(root: PathBuf) -> Result<Self, std::io::Error> {
        fs::create_dir_all(root.join("sessions"))?;
        Ok(Self {
            root,
            last_access: Mutex::new(Vec::new()),
        })
    }

    pub fn create(&self, pdf: &[u8]) -> Result<SessionSnapshot, PdfError> {
        let mut document = load_pdf(pdf)?;
        let id = Uuid::new_v4();
        let dir = self.session_dir(id);
        fs::create_dir_all(dir.join("undo"))
            .map_err(|error| PdfError::Invalid(error.to_string()))?;
        fs::create_dir_all(dir.join("redo"))
            .map_err(|error| PdfError::Invalid(error.to_string()))?;
        write_current(&dir, &mut document)?;
        write_revision(&dir, 1)?;
        self.touch(id);
        Ok(SessionSnapshot {
            id,
            revision: 1,
            analysis: analyze(&document, 1)?,
        })
    }

    pub fn get(&self, id: Uuid) -> Result<SessionSnapshot, PdfError> {
        let dir = self.require_dir(id)?;
        let revision = read_revision(&dir)?;
        let bytes = fs::read(dir.join("current.pdf"))
            .map_err(|error| PdfError::Invalid(error.to_string()))?;
        let document = load_pdf(&bytes)?;
        self.touch(id);
        Ok(SessionSnapshot {
            id,
            revision,
            analysis: analyze(&document, revision)?,
        })
    }

    pub fn file_bytes(&self, id: Uuid) -> Result<Vec<u8>, PdfError> {
        let dir = self.require_dir(id)?;
        self.touch(id);
        fs::read(dir.join("current.pdf")).map_err(|error| PdfError::Invalid(error.to_string()))
    }

    pub fn replace(
        &self,
        id: Uuid,
        revision: u64,
        run_id: &str,
        text: &str,
    ) -> Result<(SessionSnapshot, bool), PdfError> {
        self.mutate(id, revision, |document| {
            replace_run(document, run_id, text).map(|result| result.font_fallback)
        })
    }

    pub fn delete_text(
        &self,
        id: Uuid,
        revision: u64,
        run_id: &str,
    ) -> Result<SessionSnapshot, PdfError> {
        self.mutate(id, revision, |document| {
            delete_run(document, run_id)?;
            Ok(false)
        })
        .map(|(snapshot, _)| snapshot)
    }

    pub fn add(
        &self,
        id: Uuid,
        revision: u64,
        request: AddText,
    ) -> Result<SessionSnapshot, PdfError> {
        self.mutate(id, revision, |document| {
            add_text(document, &request)?;
            Ok(false)
        })
        .map(|(snapshot, _)| snapshot)
    }

    pub fn reorder(
        &self,
        id: Uuid,
        revision: u64,
        order: &[u32],
    ) -> Result<SessionSnapshot, PdfError> {
        self.mutate(id, revision, |document| {
            reorder_pages(document, order)?;
            Ok(false)
        })
        .map(|(snapshot, _)| snapshot)
    }

    pub fn rotate(
        &self,
        id: Uuid,
        revision: u64,
        rotations: &[PageRotation],
    ) -> Result<SessionSnapshot, PdfError> {
        self.mutate(id, revision, |document| {
            rotate_pages(document, rotations)?;
            Ok(false)
        })
        .map(|(snapshot, _)| snapshot)
    }

    pub fn remove_pages(
        &self,
        id: Uuid,
        revision: u64,
        pages: &[u32],
    ) -> Result<SessionSnapshot, PdfError> {
        self.mutate(id, revision, |document| {
            delete_pages(document, pages)?;
            Ok(false)
        })
        .map(|(snapshot, _)| snapshot)
    }

    pub fn merge(
        &self,
        id: Uuid,
        revision: u64,
        extra: &[u8],
    ) -> Result<SessionSnapshot, PdfError> {
        self.mutate(id, revision, |document| {
            merge_documents(document, extra)?;
            Ok(false)
        })
        .map(|(snapshot, _)| snapshot)
    }

    pub fn split(&self, id: Uuid, pages: &[u32]) -> Result<Vec<u8>, PdfError> {
        let bytes = self.file_bytes(id)?;
        let document = load_pdf(&bytes)?;
        split_document(&document, pages)
    }

    pub fn search(&self, id: Uuid, query: &str) -> Result<DocumentAnalysis, PdfError> {
        let snapshot = self.get(id)?;
        let runs = search_runs(&snapshot.analysis, query);
        Ok(DocumentAnalysis {
            revision: snapshot.revision,
            pages: snapshot.analysis.pages,
            runs,
        })
    }

    pub fn undo(&self, id: Uuid, revision: u64) -> Result<SessionSnapshot, PdfError> {
        self.restore(id, revision, "undo", "redo")
    }

    pub fn redo(&self, id: Uuid, revision: u64) -> Result<SessionSnapshot, PdfError> {
        self.restore(id, revision, "redo", "undo")
    }

    pub fn delete(&self, id: Uuid) -> Result<(), PdfError> {
        let dir = self.session_dir(id);
        if dir.exists() {
            fs::remove_dir_all(&dir).map_err(|error| PdfError::Invalid(error.to_string()))?;
        }
        if let Ok(mut access) = self.last_access.lock() {
            access.retain(|(existing, _)| *existing != id);
        }
        Ok(())
    }

    pub fn cleanup_expired(&self) {
        let now = Instant::now();
        let expired: Vec<Uuid> = self
            .last_access
            .lock()
            .map(|access| {
                access
                    .iter()
                    .filter(|(_, last)| now.duration_since(*last) > IDLE_TTL)
                    .map(|(id, _)| *id)
                    .collect()
            })
            .unwrap_or_default();
        for id in expired {
            let _ = self.delete(id);
        }
    }

    pub fn tmp_dir(&self) -> &Path {
        &self.root
    }

    fn mutate(
        &self,
        id: Uuid,
        revision: u64,
        action: impl FnOnce(&mut lopdf::Document) -> Result<bool, PdfError>,
    ) -> Result<(SessionSnapshot, bool), PdfError> {
        let dir = self.require_dir(id)?;
        let current_revision = read_revision(&dir)?;
        if current_revision != revision {
            return Err(PdfError::StaleRevision);
        }
        let bytes = fs::read(dir.join("current.pdf"))
            .map_err(|error| PdfError::Invalid(error.to_string()))?;
        fs::write(
            dir.join("undo").join(format!("{current_revision}.pdf")),
            &bytes,
        )
        .map_err(|error| PdfError::Invalid(error.to_string()))?;
        let _ = fs::remove_dir_all(dir.join("redo"));
        let _ = fs::create_dir_all(dir.join("redo"));

        let mut document = load_pdf(&bytes)?;
        let extra = action(&mut document)?;
        write_current(&dir, &mut document)?;
        let new_revision = current_revision + 1;
        write_revision(&dir, new_revision)?;
        self.touch(id);
        Ok((
            SessionSnapshot {
                id,
                revision: new_revision,
                analysis: analyze(&document, new_revision)?,
            },
            extra,
        ))
    }

    fn restore(
        &self,
        id: Uuid,
        revision: u64,
        from: &str,
        to: &str,
    ) -> Result<SessionSnapshot, PdfError> {
        let dir = self.require_dir(id)?;
        let current_revision = read_revision(&dir)?;
        if current_revision != revision {
            return Err(PdfError::StaleRevision);
        }
        let source_dir = dir.join(from);
        let snapshot = newest_snapshot(&source_dir)?;
        let current = fs::read(dir.join("current.pdf"))
            .map_err(|error| PdfError::Invalid(error.to_string()))?;
        fs::write(
            dir.join(to).join(format!("{current_revision}.pdf")),
            current,
        )
        .map_err(|error| PdfError::Invalid(error.to_string()))?;
        let restored = fs::read(&snapshot).map_err(|error| PdfError::Invalid(error.to_string()))?;
        fs::remove_file(&snapshot).map_err(|error| PdfError::Invalid(error.to_string()))?;
        fs::write(dir.join("current.pdf"), &restored)
            .map_err(|error| PdfError::Invalid(error.to_string()))?;
        let new_revision = current_revision + 1;
        write_revision(&dir, new_revision)?;
        let document = load_pdf(&restored)?;
        self.touch(id);
        Ok(SessionSnapshot {
            id,
            revision: new_revision,
            analysis: analyze(&document, new_revision)?,
        })
    }

    fn session_dir(&self, id: Uuid) -> PathBuf {
        self.root.join("sessions").join(id.to_string())
    }

    fn require_dir(&self, id: Uuid) -> Result<PathBuf, PdfError> {
        let dir = self.session_dir(id);
        if dir.is_dir() {
            Ok(dir)
        } else {
            Err(PdfError::Invalid("session not found".into()))
        }
    }

    fn touch(&self, id: Uuid) {
        if let Ok(mut access) = self.last_access.lock() {
            access.retain(|(existing, _)| *existing != id);
            access.push((id, Instant::now()));
        }
    }
}

fn write_current(dir: &Path, document: &mut lopdf::Document) -> Result<(), PdfError> {
    let bytes = save_pdf(document)?;
    fs::write(dir.join("current.pdf"), bytes).map_err(|error| PdfError::Invalid(error.to_string()))
}

fn write_revision(dir: &Path, revision: u64) -> Result<(), PdfError> {
    fs::write(dir.join("revision"), revision.to_string())
        .map_err(|error| PdfError::Invalid(error.to_string()))
}

fn read_revision(dir: &Path) -> Result<u64, PdfError> {
    let text = fs::read_to_string(dir.join("revision"))
        .map_err(|error| PdfError::Invalid(error.to_string()))?;
    text.trim()
        .parse()
        .map_err(|_| PdfError::Invalid("invalid revision file".into()))
}

fn newest_snapshot(dir: &Path) -> Result<PathBuf, PdfError> {
    let mut files: Vec<_> = fs::read_dir(dir)
        .map_err(|error| PdfError::Invalid(error.to_string()))?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("pdf"))
        .collect();
    files.sort();
    files
        .pop()
        .ok_or_else(|| PdfError::Invalid("nothing to restore".into()))
}
