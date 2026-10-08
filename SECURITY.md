# Security policy

Security fixes target the latest maintained version of videogen. The former Sora integration is retired.

## Report privately

Do not post a vulnerability publicly when it exposes credentials, local files, task data or generated media. Use a private maintainer contact if one is listed. If none is available, open a minimal issue stating that a security report is available, without exploit details or private data.

Reports should identify the videogen and Node versions, operating system, provider/region and a synthetic reproduction. Remove keys, bearer tokens, proxy credentials, private prompts, remote IDs and full personal paths. Never attach a real data directory.

## Security boundaries

- The server binds to `127.0.0.1`, validates Host, and requires a matching Origin for non-GET/HEAD API requests. It does not emit CORS headers.
- The application is a local tool, not a hosted multi-user service. Other processes under the same operating-system account are outside its isolation boundary.
- Keys are held in memory and scoped to provider + region + base URL. They are never persisted or forwarded to an unrelated host. Presigned media downloads omit credentials.
- Task journals and images contain private information and use restricted filesystem permissions where supported. They are not encrypted at rest.
- Static paths are constrained to `public/`. Outputs are streamed through partial files and published without overwriting existing files.
- A data-directory lock prevents two local services from dispatching the same recorded work. Ambiguous create outcomes require review; they must not trigger automatic paid resubmission.

Use HTTPS for remote provider endpoints. Do not expose the local service through a public interface or reverse proxy. See [Privacy notes](PRIVACY.md) for stored data and deletion behavior.
