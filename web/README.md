# web/

Angular editor for PDFForge. It talks to the Rust session API and uses NgElemental widgets in `src/app/ui/`.

PDF pages render with pdf.js. Text selection and edits use the engine analysis overlay — not a pdf.js text layer and not white-box overlays.

## Layout

```text
src/app/
  core/                 # typed session API, pdf.js renderer
  features/
    editor/             # viewer, toolbar, text properties
    documents/          # open / upload
    pages/              # thumbnails and page actions
  ui/                   # NgElemental copies
```

## Features

- Open a PDF (`POST /api/sessions`)
- Select, edit, add, and delete text runs
- Search extracted text
- Rotate, reorder, delete, merge, and split pages
- Undo / redo and export

Mutations send `X-Document-Revision`. A stale value returns **409**.

## Run

Needs Node.js 24+ and the API on `127.0.0.1:3000`.

```bash
cd web
pnpm install
pnpm start
```

`pnpm start` serves `http://127.0.0.1:4200` and proxies `/api`, `/health`, `/ready`, `/swagger-ui`, and `/api-docs` to the API.

```bash
pnpm test
pnpm run build
```

## Docker

From the repo root:

```bash
docker compose up -d --build
curl http://127.0.0.1:8080/health
```

The web image is nginx. It serves the Angular build and proxies those same API paths to the `api` service.
