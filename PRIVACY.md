# Privacy Notes

Sora2App is a local tool. It does not send your API key, prompts, output folder, or generated files to any service controlled by this project.

## What Stays Local

- The web UI is served from `127.0.0.1`.
- The API key is held in the browser form and sent to the local server only for the current request.
- The API key is not written to disk, browser localStorage, or application logs.
- The output folder is not persisted in browser localStorage.
- Generated MP4 files are saved to the folder selected by the user.

## What Is Sent to OpenAI

When you submit a job, Sora2App sends the required request data to OpenAI:

- API key.
- Prompt text.
- Selected model, duration, resolution, and Batch request data.
- Video and Batch follow-up requests needed to poll status and download generated MP4 content.

## Screenshot Safety

Before sharing screenshots, blur or crop:

- API keys.
- Full local paths.
- Private prompts.
- Video IDs and Batch IDs.
- Generated videos that you do not want to publish.

The app shortens paths under your home directory to `~/...` when displaying saved files, but you should still review screenshots before posting them publicly.
