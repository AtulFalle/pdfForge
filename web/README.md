# web/

Angular 22 editor app. Phase 1 is folder setup, CI, Docker, and an API proxy — no editor features.

UI widgets come from [NgElemental](https://www.npmjs.com/package/@ng-elemental/cli) source copies in `src/app/ui/`. Do not add custom layout HTML; compose `El*` components.

## Layout

```text
src/app/
  core/                 # reserved
  shared/               # reserved
  features/
    editor/             # reserved
    documents/          # reserved
    pages/              # reserved
  ui/                   # NgElemental copies
```

## Run locally

Needs Node.js 24+ and the API on `127.0.0.1:3000` if you want the proxy.

```bash
cd web
pnpm install
pnpm start
```

`pnpm start` serves the app at `http://127.0.0.1:4200` and proxies `/api`, `/health`, `/ready`, `/swagger-ui`, and `/api-docs` to the Axum API.

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
