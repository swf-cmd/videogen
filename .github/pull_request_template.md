## Summary

-

## Testing

- Offline `npm test` result:
- `npm run test:e2e` result for queue, persistence, output or recovery changes:
- Relevant provider/mock, persistence and UI checks:
- Node versions and proxy checks for runtime/network changes:

## Contracts and documentation

- Explain any change to create/retry/recovery behavior and its protection against duplicate paid creates.
- For provider changes, cite the official source and access date; keep unknown capabilities/prices explicit.
- Update both READMEs and all four UI languages when applicable.

## Privacy Check

- [ ] No API keys, bearer tokens, proxy credentials, or `.env` files.
- [ ] No full local paths, usernames, emails, or private account details.
- [ ] No private prompts, remote task IDs, signed result URLs, generated videos, task databases, or logs.
- [ ] `runtime/` and release archives are not committed to source history.
