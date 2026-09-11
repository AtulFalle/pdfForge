# PDFForge

Personal, self-hosted PDF editor for homelab use. Documents stay on your machine. The engine edits real PDF content — it does not cover text with overlay boxes.

## Status

**Phase 2:** Axum OpenAPI/Swagger, PDF engine, session API, sanity tests.

Phase 3 (Angular UI) is blocked until Phase 2 is reviewed.

## Layout

```text
pdfforge/
├── server/              # Rust API + PDF engine (Axum)
├── web/                 # Angular app — Phase 3
├── docs/PRD.md
├── docker/
├── compose.yaml
└── skills/              # agent development skills
```

## Run locally (without Docker)

Requires a stable Rust toolchain (`rustfmt` and `clippy` components). On Windows, use the MSVC toolchain (`stable-x86_64-pc-windows-msvc`) if the GNU toolchain fails with a missing `dlltool.exe`.

```bash
cd server
cargo test
cargo run
```

`cargo run` serves the API on `0.0.0.0:3000`.

| URL | What |
| --- | --- |
| `GET /health` | liveness |
| `GET /ready` | readiness (temp dir writable) |
| `http://127.0.0.1:3000/swagger-ui/` | interactive OpenAPI |
| `GET /api-docs/openapi.json` | OpenAPI document |

Upload a PDF to `POST /api/sessions` (`multipart/form-data` field `file`). Mutations send `X-Document-Revision`; a stale value returns **409**.

CLI (no UI required):

```bash
cargo run -- analyze path/to/file.pdf
cargo run -- replace path/to/file.pdf --run-id 1-0 --text "New text" -o out.pdf
```

## Homelab deploy (CD)

Compose is the deploy artifact. There is no cloud target.

```bash
docker compose up -d --build
curl http://127.0.0.1:3000/health
```

Optional: set `PDFFORGE_TMP` (Compose already points it at `/tmp/pdfforge`).

Stop:

```bash
docker compose down
```

## CI

GitHub Actions runs on push and pull requests:

- `cargo fmt --check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test`
- `docker compose build api`

## Agent skills

Canonical skills for this repo:

- [skills/rust-pdf-engine/SKILL.md](skills/rust-pdf-engine/SKILL.md)
- [skills/angular-editor/SKILL.md](skills/angular-editor/SKILL.md)

Cursor also loads them from `.cursor/skills/` and `.cursor/rules/`.
