# PDFForge

Personal, self-hosted PDF editor for homelab use. Documents stay on your machine. The engine edits real PDF content — it does not cover text with overlay boxes.

## Status

**Phase 1:** repository layout, health API stub, Docker Compose, CI.

Phase 2 (backend / PDF engine) and Phase 3 (Angular UI) are blocked until each previous phase is reviewed.

## Layout

```text
pdfforge/
├── server/              # Rust API (Axum)
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

Health check:

```bash
curl http://127.0.0.1:3000/health
```

Expected: `{"status":"ok"}`

## Homelab deploy (CD)

Compose is the deploy artifact. There is no cloud target.

```bash
docker compose up -d --build
curl http://127.0.0.1:3000/health
```

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
