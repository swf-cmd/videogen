# Contributing

Thanks for considering a contribution to Sora2App.

## Before Opening an Issue

- Search existing issues first.
- Include your operating system, browser, Node.js version, and app version.
- Describe whether you used standard API mode or Batch API mode.
- Do not include API keys, full local paths, private prompts, video IDs, Batch IDs, or generated videos that should stay private.

## Development

Run from source with Node.js 18 or newer:

```bash
npm start
```

Then open:

```text
http://127.0.0.1:5177
```

## Pull Requests

- Keep the app local-first and avoid adding external services.
- Do not persist API keys or output folders.
- Keep screenshots and fixtures free of personal data.
- Update README or privacy notes when user-visible behavior changes.
- Test both standard mode and Batch mode UI flows when touching request handling.

## Release Assets

Do not commit the bundled `runtime/` directory to source history. Put bundled runtime archives in GitHub Release assets instead.
