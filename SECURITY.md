# Security Policy

## Supported Versions

Security fixes are provided for the latest release.

## Reporting a Vulnerability

Please do not open a public issue for a vulnerability that exposes API keys, local files, generated videos, prompts, or other private data.

Use a private contact channel if one is listed by the maintainer. If no private channel is available yet, open a minimal public issue that says a security report is available, without including secrets, exploit details, local paths, or private screenshots.

## Privacy-Sensitive Data

Do not include any of the following in public reports:

- OpenAI API keys or bearer tokens.
- Full local paths that include your username.
- Private prompts, customer data, or unpublished generated videos.
- Raw request or response logs that include secrets.
- Video IDs or batch IDs unless you are sure they can be public.

## Local-Only Assumptions

Sora2App is intended to run on `127.0.0.1`. If you modify it to listen on a public interface, deploy it to a remote server, or put it behind a proxy, you are responsible for authentication, transport security, logging policy, and API key protection.
