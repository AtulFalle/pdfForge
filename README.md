# PDFForge

Personal, self-hosted PDF editor for homelab use. Documents stay on your machine. The engine edits real PDF content — it does not cover text with overlay boxes.

## Status

**Phase 3 (web editor):** Angular 22 app consumes the Phase 2 session API — open, render, search, edit text, page ops, undo/redo, and export. NgElemental widgets, CI, Docker, and an API proxy.

The Rust API remains the source of PDF work. Text is edited in content streams, not covered with overlay boxes.

## Layout

```text
pdfforge/
├── server/              # Rust API + PDF engine (Axum)
├── web/                 # Angular 22 app
├── docs/PRD.md
├── docker/
├── compose.yaml
└── skills/              # agent development skills
```

## Run locally (without Docker)

Requires a stable Rust toolchain (`rustfmt` and `clippy` components). On Windows, use the MSVC toolchain (`stable-x86_64-pc-windows-msvc`) if the GNU toolchain fails with a missing `dlltool.exe`.

API:

```bash
cd server
cargo test
cargo run
```

`cargo run` serves the API on `0.0.0.0:3000`.

Web (Node.js 24+, pnpm). Proxies API paths to `127.0.0.1:3000`:

```bash
cd web
pnpm install
pnpm start
```

| URL | What |
| --- | --- |
| `http://127.0.0.1:4200/` | Angular editor (open a PDF, then edit) |
| `GET /health` | liveness (proxied) |
| `GET /ready` | readiness (proxied) |
| `http://127.0.0.1:4200/swagger-ui/` | interactive OpenAPI (proxied) |
| `GET /api-docs/openapi.json` | OpenAPI document (proxied) |

Direct API URLs on port 3000 still work.

Upload a PDF to `POST /api/sessions` (`multipart/form-data` field `file`). Mutations send `X-Document-Revision`; a stale value returns **409**.

CLI (no UI required):

```bash
cargo run -- analyze path/to/file.pdf
cargo run -- replace path/to/file.pdf --run-id 1-0 --text "New text" -o out.pdf
```

## Vercel

The Angular UI and Rust API deploy as one Vercel project (`vercel.json`). `/api`, `/health`, `/ready`, `/swagger-ui`, and `/api-docs` go to the Axum container; everything else is the static editor.

Session PDFs live on that container's disk. Vercel scales the API to zero after idle time, so open documents do not survive a cold start. Homelab Compose is still the durable self-hosted option.

## Homelab deploy (CD)

Compose remains the local/self-hosted deploy artifact.

```bash
docker compose up -d --build
curl http://127.0.0.1:8080/health
```

Web listens on **8080** and proxies `/api`, `/health`, `/ready`, `/swagger-ui`, and `/api-docs` to the API. The API remains on **3000** for CLI use.

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
- `pnpm test` and `pnpm run build` in `web/`
- `docker compose build`

## Agent skills

Canonical skills for this repo:

- [skills/rust-pdf-engine/SKILL.md](skills/rust-pdf-engine/SKILL.md)
- [skills/angular-editor/SKILL.md](skills/angular-editor/SKILL.md)

Cursor also loads them from `.cursor/skills/` and `.cursor/rules/`. UI widgets must come from NgElemental (`src/app/ui/`), not custom HTML.
