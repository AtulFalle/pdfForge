use std::path::PathBuf;
use std::sync::Arc;

use axum::Router;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
use uuid::Uuid;

use crate::sessions::SessionStore;

mod error;
mod health;
mod openapi;
mod sessions;

use self::openapi::ApiDoc;

#[derive(Clone)]
pub struct AppState {
    pub sessions: Arc<SessionStore>,
}

impl AppState {
    pub fn from_env() -> Result<Self, std::io::Error> {
        let root = std::env::var("PDFFORGE_TMP")
            .map(PathBuf::from)
            .unwrap_or_else(|_| std::env::temp_dir().join("pdfforge"));
        match SessionStore::new(root.clone()) {
            Ok(sessions) => Ok(Self {
                sessions: Arc::new(sessions),
            }),
            Err(error) => Err(std::io::Error::new(
                error.kind(),
                format!("cannot create session store in {}: {error}", root.display()),
            )),
        }
    }

    pub fn ephemeral() -> Self {
        let root = std::env::temp_dir().join(format!("pdfforge-{}", Uuid::new_v4()));
        Self {
            sessions: Arc::new(SessionStore::new(root).expect("create ephemeral session store")),
        }
    }
}

pub fn app() -> Router {
    app_with_state(AppState::ephemeral())
}

pub fn app_with_state(state: AppState) -> Router {
    Router::new()
        .merge(health::router())
        .merge(sessions::router())
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .with_state(state)
}
