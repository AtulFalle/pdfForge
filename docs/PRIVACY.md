# Privacy

PDFForge is built so you can edit PDFs without handing them to an external PDF API.

## What we do not do

- No user accounts
- No document cloud
- No third-party PDF processing service
- No collaboration or sharing features

## What happens to a file

1. You open a PDF in the editor.
2. The file is uploaded to the PDFForge API for that session only.
3. Edits rewrite PDF content streams on the API host.
4. Export downloads the result. Closing the session drops the working copy.

The hosted app runs on your chosen infrastructure (currently Vercel). The operator of that infrastructure can see traffic and disk used by the API container. If you need the files to stay on hardware you control, run PDFForge with Docker Compose.

## Size limit

Uploads are capped at 50 MB.
