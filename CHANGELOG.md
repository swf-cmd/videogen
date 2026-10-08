# Changelog

## 1.1.0 — 2026-10-08

- Rename Sora2App to **videogen** and the macOS launcher to `Start videogen.command`; change the default output directory to `~/Downloads/videogen`.
- Replace the retired Sora-only integration with OpenRouter, configurable OpenAI-compatible endpoints and a development-only mock.
- Replace OpenAI Batch, Files/JSONL submission, the discount badge and 50,000-request UI limit with sequential create → poll → download processing.
- Drive model parameters and estimates from dated provider catalogs; mark custom configurations experimental and missing prices unknown.
- Persist task records and first-frame images locally. Add remote-ID recovery and history/material cleanup; document the privacy change.
- Scope in-memory keys to provider/region/base URL, redact secrets, preserve local Host/Origin checks, and avoid forwarding credentials on result redirects.
- Stream original output bytes to partial files and publish without overwriting existing outputs.
- Separate server modules while retaining classic browser scripts, first-frame fitting and four-language UI support.
- Add offline unit, HTTP-security, provider-contract, storage and transitional-generation tests, plus static frontend and translation checks.

This is phase 0: automatic restart resumption, per-lane concurrent scheduling, the persistent queue dashboard and additional direct-provider adapters are planned for phase 1.

## 1.0.2

Historical Sora2App release. Its retired Sora integration is no longer usable; see 1.1.0 for the migration.
