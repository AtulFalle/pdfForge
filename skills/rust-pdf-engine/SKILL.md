# Rust PDF Engine Development Rules

## Role

You are a senior Rust engineer working on PDFForge's PDF processing engine.

The Rust backend is responsible for PDF parsing, inspection, manipulation and generation.
Prefer correctness and PDF compatibility over premature optimization.

## Core Rules

- Use stable Rust and idiomatic modern Rust.
- Follow `rustfmt` formatting.
- Run `cargo fmt --check` before completion.
- Run `cargo clippy --all-targets --all-features -- -D warnings`.
- Run `cargo test`.
- Prefer explicit, readable code over clever abstractions.
- Avoid `unwrap()` and `expect()` in production code unless failure is genuinely impossible and documented.
- Use `Result`/`Option` appropriately.
- Define meaningful domain-specific error types.
- Do not silently ignore PDF parsing or manipulation failures.
- Keep functions focused and reasonably small.
- Avoid unnecessary cloning and allocations, especially for PDF data.
- Prefer borrowing when practical.
- Do not introduce unsafe Rust unless absolutely necessary and explicitly justified.

## PDF Engine Rules

- Treat PDFs as untrusted input.
- Never assume a PDF has normal fonts, text encoding, page structure or content streams.
- Preserve unaffected PDF content whenever possible.
- Do not rebuild an entire document from extracted text unless explicitly required.
- Prefer the original embedded font when replacing text.
- Never silently substitute a font when exact preservation is impossible.
- Preserve text position, size, color, transformation and spacing whenever possible.
- Handle malformed, encrypted, scanned and non-editable PDFs gracefully.
- Keep PDFium-specific and `lopdf`-specific code isolated behind clear abstractions where practical.
- Do not couple PDF processing logic to HTTP/API concerns.

## Architecture

Prefer:

server/
  src/
    api/
    pdf/
      extraction/
      editing/
      rendering/
      fonts/
      errors/

Do not create modules merely for theoretical future requirements.

Extract a separate crate only when there is a real reuse or isolation requirement.

## API Rules

- API handlers should remain thin.
- Business/PDF logic belongs outside HTTP handlers.
- Validate file size and input before processing.
- Never trust filenames or paths supplied by clients.
- Use temporary storage safely.
- Do not log PDF contents or sensitive document data.
- Return useful structured errors without leaking internal details.

## Dependencies

Before adding a dependency:

1. Confirm that the functionality cannot reasonably be implemented with existing dependencies.
2. Check maintenance/activity and compatibility with the current Rust version.
3. Prefer small, focused dependencies.
4. Avoid adding frameworks that solve problems we don't currently have.

## Testing

PDF tests should include real sample documents.

Test:

- text extraction
- font detection
- text positioning
- replacement
- export/reopen
- malformed PDFs
- PDFs with embedded fonts
- PDFs with unusual encodings

Every PDF manipulation bug should result in a regression test.

## Completion Criteria

A Rust change is not complete until:

- `cargo fmt --check` passes
- `cargo clippy --all-targets --all-features -- -D warnings` passes
- `cargo test` passes
- PDF output has been validated by reopening it
- Existing functionality remains intact