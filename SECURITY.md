# Security policy

Security fixes target the latest maintained videogen release. Version 2.2.0 is a local persistent queue; the former Sora integration is retired. Use a supported, patched Node release: `^22.21.0 || >=24.5.0`; Node 23 is unsupported. Maintainer release bundles should include Node 24 LTS.

## Report privately

Do not publish a vulnerability that exposes credentials, local files, task data or generated media. Use a private maintainer contact if one is listed. If none is available, open a minimal issue saying a security report is available, without exploit details or private data.

Include the videogen/Node versions, operating system, provider/region, affected job/lane state and a synthetic reproduction. Remove keys, bearer tokens, proxy credentials, private prompts, remote IDs, signed result URLs and full personal paths. Never attach a real data directory. If a key has been exposed, revoke it at the provider; deleting a local key does not revoke it remotely.

## Local boundaries

- The service binds to `127.0.0.1`, validates Host, and requires a matching Origin for state-changing API calls, including DELETE. API and SSE responses do not enable CORS. Responses set `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` to prevent framing.
- Static paths stay within `public/`; request bodies are bounded, including chunked uploads. SSE sends incremental events and bounded replay, not the complete queue at connection time.
- This is a local single-user application, not a hosted multi-user service. Other processes with access under the same operating-system account are outside its isolation boundary. Do not expose the service through a public interface or reverse proxy.
- Journals, images, lane settings and caches use private permissions where supported, but are not encrypted at rest. The task store contains prompts, paths and potentially sensitive media URLs. See [Privacy notes](PRIVACY.md).

## Credentials and network requests

Keys are memory-only and scoped to provider + region + base URL. They are excluded from browser storage, files, URLs, logs and API/SSE responses. Validation rejects whitespace/control characters; provider-specific formats apply. Only validated keys of at least 16 characters are registered for provider-response substring redaction; sensitive headers are redacted as fields. Short compatible-server placeholders and rejected keys cannot rewrite prompts, endpoints, paths or IDs.

Authenticated requests must start at the selected lane origin. External presigned downloads carry no provider credentials. Redirects remove authorization/API-key headers and cookies; credential-bearing or known-secret URLs are rejected. A create redirect does not trigger another automatic submission. Gemini uses `x-goog-api-key`, never a query key.

Use HTTPS for remote endpoints. Native environment proxy support honors effective proxy/bypass settings and always excludes loopback endpoints. The standard startup commands validate proxy settings in a guarded process before starting the service with native HTTP proxy agents; invalid configuration stops startup without echoing the raw URL. Proxy URL credentials are redacted in the UI and errors, and are not written to queue files. A proxy configuration does not change provider regional eligibility. The application has no telemetry, automatic update checks or third-party upload service.

## Duplicate-charge and output safeguards

A single-instance lock protects each data directory. The store flushes both the transition to `submitting` and the returned remote ID before the scheduler can continue. On restart, an ambiguous create from the shipped non-idempotent providers becomes `needs_review`; it is never automatically sent again. Poll/download retries cannot call create. Only an explicit review decision can authorize another ambiguous job submission, and the UI warns about possible duplicate charges.

Definite pre-acceptance failures can be retried according to their category. An accepted task's terminal parameter/content error is not permission to recreate it. Disk-write failures stop dispatch; corrupted records do not silently become new jobs. Gemini persists the interaction ID and any initial Files recovery address; bounded SSE replay recovers later Files references without buffering inline video.

Downloads stream to private partial files, sync before acknowledging publication, and publish without replacing existing files. Name collisions select an unused filename. Recovery verifies known published-file markers without deleting unrelated files. Provider media bytes and implicit labels are preserved.

Offline tests exercise Host/Origin rules, traversal, size limits, credential redaction, redirect handling, storage crash boundaries and concurrent queues. The crash acceptance test checks duplicate creates, tracked remote jobs, output hashes and secret absence. These are implementation checks; they cannot guarantee third-party service behavior, account eligibility or charges after a user-authorized resubmission.
