# PDFForge

**Edit the PDF itself.** Select existing text, change it, and export a valid document — fonts, layout, and content streams stay intact. No overlay boxes. No third-party PDF processor.

[Open the editor](https://pdfforge-woad.vercel.app) · [Privacy](docs/PRIVACY.md) · [License](LICENSE)

[![CI](https://github.com/AtulFalle/pdfForge/actions/workflows/ci.yml/badge.svg)](https://github.com/AtulFalle/pdfForge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-0f172a.svg)](LICENSE)

## Why PDFForge

Most browser “PDF editors” cover original text with a white rectangle and draw a new box on top. The file looks edited until you search, copy, or reopen it in a real reader.

PDFForge rewrites the PDF content stream. The change is the document.

| You get | You skip |
| --- | --- |
| Real text replacement in the PDF | Overlay textboxes |
| Original fonts and layout, kept when the file allows | Accounts and a document cloud |
| In-session processing on your API host | Sending files to an external PDF API |

## What you can do

- Open and render a PDF (up to 50 MB)
- Select, edit, add, and delete text
- Search extracted text
- Rotate, reorder, duplicate, delete, merge, and split pages
- Undo and redo
- Export a valid PDF
- Analyze or replace text from the CLI

The engine prefers the original embedded font. It never silently substitutes a font when exact preservation is impossible.

## How it works

```text
Browser (Angular editor)
        │
        │  typed session API
        ▼
Rust API (Axum, OpenAPI)
        │
        ▼
PDF engine (content streams, fonts, pages)
```

The UI never parses or patches PDF internals. The engine stays independent of HTTP so the same logic can run as an API or a CLI.

## Try it

**Hosted:** [pdfforge-woad.vercel.app](https://pdfforge-woad.vercel.app)

**Local** — needs a stable Rust toolchain (`rustfmt`, `clippy`) and Node.js 24+. On Windows, use the MSVC toolchain (`stable-x86_64-pc-windows-msvc`) if GNU fails with a missing `dlltool.exe`.

```bash
cd server && cargo run
```

```bash
cd web && pnpm install && pnpm start
```

| URL | What |
| --- | --- |
| `http://127.0.0.1:4200/` | Editor |
| `GET /health` | Liveness |
| `GET /ready` | Readiness |
| `http://127.0.0.1:4200/swagger-ui/` | OpenAPI |
| `GET /api-docs/openapi.json` | OpenAPI document |

The Angular dev server proxies API paths to `127.0.0.1:3000`. Mutations send `X-Document-Revision`; a stale value returns **409**.

CLI, no UI required:

```bash
cargo run -- analyze path/to/file.pdf
cargo run -- replace path/to/file.pdf --run-id 1-0 --text "New text" -o out.pdf
```

## Deploy

**Vercel** — one project for the Angular UI and the Rust API (`vercel.json`). `/api`, `/health`, `/ready`, `/swagger-ui`, and `/api-docs` go to the API container; everything else is the editor.

- Push to `master` → production
- Pull requests → preview URLs
- Other branch pushes without a PR are skipped

Session PDFs live on that container's disk. The API can scale to zero, so open documents do not survive a cold start.

**Self-host** — Compose is the durable deploy:

```bash
docker compose up -d --build
curl http://127.0.0.1:8080/health
```

The web service listens on **8080** and proxies API paths. The API remains on **3000** for CLI use. Optional: `PDFFORGE_TMP` (Compose already points it at `/tmp/pdfforge`).

```bash
docker compose down
```

## Privacy

Documents are processed in the editing session. They are never sent to an external PDF service. There are no accounts and no document cloud. Details: [docs/PRIVACY.md](docs/PRIVACY.md).

## License

PDFForge is [MIT](LICENSE). Third-party notices are in [NOTICE](NOTICE). Security reports: [SECURITY.md](SECURITY.md).

## Develop

GitHub Actions runs on pull requests and on pushes to `master`: `cargo fmt`, Clippy, Rust tests, `pnpm test`, `pnpm run build`, and `docker compose build`. Deploys are not done from Actions — the Vercel GitHub app ships production from `master`.

```text
pdfforge/
├── server/     Rust API + PDF engine
├── web/        Angular editor
├── docs/       PRD and privacy
├── docker/     images
└── compose.yaml
```
