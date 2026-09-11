# Angular PDF Editor Development Rules

## Role

You are a senior Angular engineer working on PDFForge's web editor.

Build a modern, maintainable Angular 21 application with a thin UI layer over the Rust PDF engine.

## Core Rules

- Use Angular 21+ modern APIs and syntax.
- Use standalone components.
- Prefer signals for local/component state.
- Do not introduce NgRx or another global state-management framework.
- Prefer Angular `resource` / `httpResource` patterns where appropriate instead of manually managing HTTP loading state.
- Keep components focused.
- Avoid large "god components".
- Keep files preferably below 300 lines.
- Use TypeScript strict mode.
- Avoid `any`.
- Prefer strong domain types/interfaces.
- Use dependency injection through Angular's modern APIs.
- Use `OnPush` where applicable.
- Avoid unnecessary subscriptions.

## UI Architecture

Prefer:

web/
  src/
    app/
      core/
      shared/
      features/
        editor/
        documents/
        pages/

Organize code around features rather than technical layers alone.

PDF editor functionality should be isolated from generic UI components.

## PDF Editor Rules

The PDF viewer/editor should maintain a clear separation between:

- PDF rendering
- document state
- selection
- editing commands
- UI state

Do not make the Angular application responsible for parsing or modifying PDF internals.

The UI communicates with the Rust API through typed contracts.

## State

Use signals for:

- selected page
- zoom
- selected object
- active tool
- editor state
- UI panels
- pending edits

Avoid global state unless there is a demonstrated need.

Use immutable state updates where practical.

## Components

Prefer small components such as:

- PdfViewer
- PageThumbnail
- TextSelection
- TextProperties
- EditorToolbar
- PagePanel
- DocumentPanel

Avoid putting unrelated editor functionality into `PdfEditorComponent`.

## Styling

- Use SCSS.
- Prefer BEM naming.
- Avoid `!important`.
- Avoid deeply nested selectors.
- Avoid inline styles unless dynamically required.
- Build reusable UI primitives instead of duplicating styles.

## Accessibility

Every interactive control must have:

- keyboard accessibility
- accessible labels
- visible focus state
- appropriate semantic HTML

Do not rely exclusively on mouse interactions for PDF editing.

## Performance

PDF documents can be large.

- Avoid unnecessary re-rendering.
- Avoid copying large PDF data through Angular state.
- Do not store large binary documents in reactive state unless necessary.
- Virtualize page thumbnails when document size requires it.
- Debounce expensive search/inspection operations.
- Keep rendering work isolated from normal UI updates.

## API

- Keep API services focused by feature.
- Use typed request/response models.
- Handle loading, error and empty states explicitly.
- Do not expose raw backend implementation details throughout components.

## Testing

Test:

- editor interactions
- text selection
- editing workflows
- page operations
- API failures
- keyboard interactions
- important PDF editing scenarios

Prefer behavior-based tests over testing implementation details.

## Completion Criteria

Before considering Angular work complete:

- TypeScript compilation passes.
- Lint passes.
- Tests pass.
- No unnecessary `any`.
- No new global state-management dependency.
- Accessibility has been considered.
- Components remain focused.
- No `!important`.
- Existing editor functionality remains intact.