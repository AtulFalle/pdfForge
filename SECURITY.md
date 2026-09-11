# Security

PDFForge treats uploaded PDFs as untrusted input. Files are parsed and edited in-session on the API host. They are never sent to a third-party PDF processing service.

## Reporting a vulnerability

Please report security issues privately with [GitHub Security Advisories](https://github.com/AtulFalle/pdfForge/security/advisories/new). Do not open a public issue for exploitable bugs.

Include the affected version or commit, a short reproduction, and the impact.

## Product boundaries

- Session files live on the API host's disk and are not a durable document store.
- The hosted deployment can scale to zero; open sessions do not survive a cold start.
- Self-hosted Compose keeps session files on the volume you mount.
