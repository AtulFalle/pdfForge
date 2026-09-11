# PDFForge — Product Requirements Document

**Status:** Draft
**Purpose:** Personal, self-hosted PDF editor for homelab use

## 1. Problem

Free online PDF editors are often limited, ad-heavy, or require uploading private documents.

The previous approach only allowed adding textboxes over PDFs. PDFForge should edit the **actual PDF content**, especially existing text, while preserving the document's original appearance.

## 2. Vision

Build a lightweight, self-hosted PDF editor that can:

* Edit existing PDF text
* Preserve original fonts and formatting
* Add, remove and modify content
* Manipulate pages and images
* Fill PDF forms
* Eventually support handwriting-style document completion

All PDF processing should remain within the user's infrastructure.

## 3. MVP

### PDF Editing

* Open and render PDFs
* Select existing text
* Edit existing text
* Add and delete text
* Preserve font, size, color, position and formatting where possible
* Search text

### Pages

* Reorder pages
* Rotate pages
* Delete pages
* Merge and split PDFs

### Export

* Generate valid PDFs
* Preserve untouched content
* Maintain document quality
* Basic undo/redo

### Core Success Criteria

> Existing PDF text must be genuinely editable, not simply covered by a new textbox.

A real PDF should be editable and exported with the changed text visually matching the original document.

## 4. Future Scope

### Advanced Editing

* Images: add, replace, resize, crop and delete
* Shapes and drawing
* Advanced typography
* Find & replace
* Improved font matching/substitution

### Forms

* Detect existing form fields
* Create and edit fields
* Fill forms
* Checkboxes and radio buttons
* Signatures
* Automatic field detection

### Handwriting

* Freehand writing
* Mouse/touch/stylus support
* Handwriting-style text generation
* Personal handwriting profiles
* Automatic placement into form fields

### Scanned PDFs

* OCR
* Detect text regions
* Reconstruct editable text
* Font/style estimation

## 5. Architecture

```text
Browser
   │
   ▼
Angular Web UI
   │
   │ HTTP
   ▼
Rust API
   │
   ▼
PDF Engine
```

The Angular application handles the editing experience and UI.

Rust handles PDF parsing, analysis, modification and generation.

The PDF engine should remain independent of the UI so it can potentially be reused later as a CLI, WASM module or desktop application.

## 6. Technology

| Area              | Choice                             |
| ----------------- | ---------------------------------- |
| Frontend          | Angular 21                         |
| Package manager   | pnpm                               |
| Backend/API       | Rust + Axum                        |
| PDF processing    | Rust                               |
| Storage           | Local filesystem / temporary files |
| Database          | None initially                     |
| Deployment        | Docker Compose                     |
| Target            | Homelab                            |
| Workspace tooling | None                               |

### Architecture Decision: No Nx

Nx is intentionally **not used**.

The project is small enough that Nx would add unnecessary abstraction and maintenance overhead. Angular CLI and Cargo are sufficient for managing their respective applications.

The initial repository will remain a simple project structure:

```text
pdfforge/
├── web/                 # Angular application
├── server/              # Rust API + PDF engine
├── docs/
│   └── PRD.md
├── docker/
├── compose.yaml
├── README.md
└── .gitignore
```

Rust modules/crates will only be separated when the PDF engine's complexity justifies it.

## 7. Privacy & Security

* No external PDF-processing service
* Documents remain within the homelab
* Temporary files cleaned after processing
* Safe handling of malformed PDFs
* No database or persistent document storage initially

## 8. Non-Goals

Initially:

* No SaaS platform
* No user accounts
* No cloud storage
* No collaboration
* No AI dependency
* No attempt to reproduce every Adobe Acrobat feature

## 9. Development Strategy

**MVP-0 is an engine spike, not the editor UI.**

Work is gated in three phases:

1. Folders, Docker, CI/CD
2. Backend (OpenAPI, PDF engine, sanity tests)
3. Angular UI — only after the backend works

First prove:

```text
PDF
 ↓
Parse
 ↓
Find existing text
 ↓
Detect font + properties
 ↓
Replace text
 ↓
Generate PDF
 ↓
Verify in standard PDF reader
```

Only after reliable text replacement works should we build the full editing interface.

**Forbidden:** covering original text with a white rectangle and drawing new text on top.
