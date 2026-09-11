# PDFForge — Product Requirements

**Status:** Shipping
**Purpose:** Privacy-first PDF editor that changes the document itself — not a box drawn on top of it.

## 1. Problem

Free online PDF editors are limited, ad-heavy, or require uploading private documents to someone else's PDF pipeline.

Many editors only add textboxes over the page. PDFForge must edit **actual PDF content**, especially existing text, while preserving the document's original appearance.

## 2. Vision

A focused PDF editor that can:

* Edit existing PDF text
* Preserve original fonts and formatting
* Add, remove, and modify content
* Manipulate pages
* Export a valid PDF

All PDF processing stays on the PDFForge API host. Nothing is sent to an external PDF-processing service.

## 3. Product

### PDF editing

* Open and render PDFs (up to 50 MB)
* Select existing text
* Edit, add, and delete text
* Preserve font, size, color, position, and formatting where possible
* Search text

### Pages

* Reorder, rotate, duplicate, and delete pages
* Merge and split PDFs

### Export

* Generate valid PDFs
* Preserve untouched content
* Maintain document quality
* Undo / redo

### Success criterion

> Existing PDF text must be genuinely editable, not covered by a new textbox.

A real PDF should export with changed text that still looks like the original document.

## 4. Later

### Advanced editing

* Images: add, replace, resize, crop, and delete
* Shapes and drawing
* Advanced typography
* Find & replace
* Improved font matching

### Forms

* Detect, create, and fill fields
* Checkboxes, radio buttons, signatures

### Handwriting

* Freehand input
* Mouse / touch / stylus
* Placement into form fields

### Scanned PDFs

* OCR
* Reconstruct editable text
* Font / style estimation

## 5. Architecture

```text
Browser
   │
   ▼
Angular web editor
   │
   │ HTTP
   ▼
Rust API
   │
   ▼
PDF engine
```

Angular owns the editing experience. Rust owns parsing, analysis, modification, and generation.

The engine stays independent of HTTP so it can run as a CLI, WASM module, or desktop app later.

## 6. Technology

| Area | Choice |
| --- | --- |
| Editor | Angular 22 |
| Package manager | pnpm |
| API | Rust + Axum |
| PDF processing | Rust (`lopdf`) |
| Storage | Session files on the API host |
| Database | None |
| Hosted deploy | Vercel (UI + API container) |
| Self-host | Docker Compose |
| Workspace tooling | None (no Nx) |

Nx is intentionally not used. Angular CLI and Cargo are enough.

```text
pdfforge/
├── web/
├── server/
├── docs/
├── docker/
├── compose.yaml
└── README.md
```

## 7. Privacy & security

* No external PDF-processing service
* No accounts or document cloud
* Temporary session files, not a durable store
* Safe handling of malformed PDFs
* See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](../SECURITY.md)

## 8. Non-goals

* Not a multi-tenant SaaS with user accounts
* Not a collaboration suite
* Not an AI writing tool
* Not a clone of every Adobe Acrobat feature

## 9. Editing rule

Prove this path before expanding the editor:

```text
PDF → parse → find text → detect font → replace → write PDF → verify in a reader
```

**Forbidden:** covering original text with a white rectangle and drawing new text on top.
