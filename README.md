# videogen

A local AI video batch studio: per-shot frames, CSV imports, gallery selection, crash recovery and automatic downloads. Bring your own provider key.

[English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

[![Offline workflow recording: import, per-shot frames and gallery](docs/media/videogen-workflow.gif)](docs/media/videogen-workflow.webm)

[Watch the workflow recording](docs/media/videogen-workflow.webm) · [Play the offline preview fixture](docs/media/offline-preview.mp4) · [Portable setup](docs/PORTABLE.md) · [From Sora 2](docs/MIGRATING_FROM_SORA.md)

The recording uses local fixtures with no paid generation. The short preview is a synthetic playback test, **not an AI-generated quality sample**. Real provider samples are deferred until a user authorizes paid generation or supplies publishable clips.

**Sora is retired.** Version **2.1.0** builds on the persistent queue introduced in 2.0.0, which replaces Sora2App's discontinued integration with a persistent queue. Jobs continue when you close the browser, and survive service restarts. The old OpenAI Batch workflow and discount are gone.

## Start

**No-install ZIP:** choose the Windows x64 or macOS universal archive from [Releases](https://github.com/swf-cmd/videogen/releases), extract the whole folder, then double-click **Start videogen.cmd** or **Start videogen.command**. Node 24 LTS is included. Portable records and default videos stay in `portable-data/` and `portable-output/` beside the launcher. OS first-open confirmation may be required; see [portable setup and checksums](docs/PORTABLE.md). If a bundle has not yet been published, use source startup below.

**From source:** Use **Node.js 22.21.0 or later in the 22.x line, or Node.js 24.5.0 or later** (`^22.21.0 || >=24.5.0`). Node 18, 20 and 23 are unsupported. No `npm install` is needed.

```bash
git clone https://github.com/swf-cmd/videogen.git
cd videogen
npm start
```

Open the printed address, normally `http://127.0.0.1:5177`. `PORT` changes the port; the service binds only to `127.0.0.1`. The launchers choose another local port when the default is busy. Keep the launcher, runtime and application files together. The former `Start Sora2App.command` name is retired. Linux runs from source; Windows and Linux use a manually entered output directory. Opening `public/index.html` directly provides a preview without generation. Only one service may use a data directory, even on different ports. Ctrl+C allows up to 15 seconds to record in-flight work before exit. Data and output folders must support hard links; use a local system disk instead of exFAT.

## Submit a batch

See the [CSV columns, templates and folder-matching guide](docs/BATCH_IMPORT.md) for copyable examples.

1. Select **provider · region** and a model. For a compatible server, enter its base URL, model ID and documented capabilities. Choose JSON or multipart before submission; the app never retries a create with another request format.
2. Enter and save the lane's key. A lane is provider + region + base URL. Keys stay in service memory; changing lane or URL clears the input. A local endpoint may allow an empty key. You may queue work before supplying a required key.
3. Separate prompts with blank lines, repeat a single prompt, or import a UTF-8 CSV/template and image folder. Give each row its own first frame and, when supported, last frame. Row validation checks the selected model before submission; templates expand variables into prompts. Choose output directory and filename.
4. Review the estimated cost and ETA, optionally set a batch budget, then confirm. Missing prices show **Unknown**. Currency totals remain separate; estimates are not provider billing guarantees.
5. Preview completed videos in the gallery, mark takes **Keep** or **Reject**, and inspect the estimated cost per kept clip. Every regeneration requires a fresh explicit confirmation and can incur a new charge. Watch lanes, batches and the paginated job table. Default render concurrency is 1 for compatible endpoints, 2 for OpenRouter and Model Studio, and 3 for Gemini and Ark. You can adjust each lane. A separate pool downloads up to 3 results at once.

Source outputs default to `~/Downloads/videogen`; portable bundles use `portable-output/`. `VIDEOGEN_OUTPUT_DIR` overrides the default. Downloads stream to disk, preserve provider bytes and metadata, and never replace an existing file. A collision gets another filename. Results nearing expiry are highlighted; keep the service running to save them promptly.

A budget limits **estimated future dispatch**, not your provider's bill. It accounts for reserved and possibly charged work; already submitted jobs continue. Unknown pricing cannot be used for a budget. Gemini's estimate covers video output only and excludes additional input/thinking charges. Pausing a lane or batch stops new creates while submitted work remains tracked. Cancelling stops queued jobs; current production adapters continue tracking and downloading already submitted work, which may already be charged.

## Restart and review

The browser receives incremental Server-Sent Events (SSE). Closing or refreshing the tab does not stop the service queue. After restarting the service, re-enter each required lane key; known remote jobs resume polling/download, and queued jobs can continue. Lane concurrency and manual pause settings persist.

An interrupted or ambiguous create becomes **Needs review** (`needs_review`). The app does not automatically create it again. Inspect the provider console, then choose one action:

- **Confirm it was not created → resubmit.** This explicitly authorizes another create and can duplicate a charge if your conclusion is wrong.
- **Abandon.** Stop local tracking of that review item; this does not cancel or refund work at the provider.
- **Attach a remote ID.** Associate the provider's existing task and resume polling/download without a new create.

A failed job can be retried only when the app has evidence that create was not accepted. A timeout, connection reset, malformed response or create 5xx is not such evidence. Rate limits cool the lane; authentication waits for a replacement key; balance/model-access problems pause new submissions while accepted jobs keep polling and downloading. Moderation failures affect only their own jobs.

**Gemini uses background interactions.** The create request sets `background: true`; the interaction ID is saved before polling. A restart resumes that ID after key re-entry, and successful results retain their Files address. A create response lost before the ID is received can still require review; background mode cannot guarantee recovery across every network failure. Existing Files references remain usable for manual recovery. See the [Gemini contract](docs/providers/gemini.md).

## Providers and estimates

Catalog/source date: **2026-10-08**. All adapters have offline contract tests. No paid provider calls were made for this release; account access and live behavior still need confirmation with your provider.

| Provider · region | Included models and limitations |
| --- | --- |
| OpenRouter · global | The dated fallback snapshot includes Veo 3.1 Lite, Seedance 2.5, Wan and other catalog models. Explicit refresh fetches the current video catalog. Local first frames use base64 data URLs in `frame_images` when the refreshed model advertises support. Controls, validation and estimates follow `/videos/models`; unavailable capabilities are not assumed. USD SKU estimates; retention and account limits remain unknown. [Contract](docs/providers/openrouter.md) |
| Gemini API · supported regions | `gemini-omni-1.1-flash`, 3–10 seconds, 360p/720p/1080p/4K, first/last frames and native audio. Audio is fixed on; seed is unavailable. Only the 720p video-output token factor is verified: about USD 0.10136/second, plus input/thinking charges. Other resolution estimates are unknown. [Contract](docs/providers/gemini.md) |
| Alibaba Cloud Model Studio · Beijing / Singapore | `wan3.0-video`, `wan3.0-video-prime`, 2–30 seconds, 480p/720p/1080p, supported first/last frames, audio toggle and seed. Enter your **workspace-specific hostname**; placeholders, generic legacy hosts and region mismatches are rejected. List prices are CNY and differ by region; no promotional discount is assumed. [Contract](docs/providers/dashscope.md) |
| Volcengine Ark · Beijing / BytePlus ModelArk · overseas | Seedance 2.5: `doubao-seedance-2-5-260628` / `dreamina-seedance-2-5-260628`, 4–30 seconds, 480p/720p/1080p, first/last frames and audio toggle. Seed is disabled because 2.5 support was not verified. CN pricing is unknown; BytePlus uses a verified USD token/dimension formula. Adaptive output dimensions have unknown cost. 1080p HEVC may not play in every browser. [Contract](docs/providers/ark.md) |
| OpenAI-compatible · custom | Configure a local or trusted server's exact model/capabilities; experimental by default. Choose its supported request format. No default Sora model or assumed price. [Contract](docs/providers/openai-compatible.md) |
| Mock · local | Development only with `VIDEOGEN_DEV=1`; deterministic test bytes, not playable generated videos. |

`data/catalog/` contains the bundled catalog. `catalog.local.json` in the data directory can override it. OpenRouter refresh results are cached; failures retain a usable catalog, with the bundled snapshot as fallback. Unknown/unverified configurations are marked **Experimental**. Provider prices and access can change.

For Wan 3, replace the placeholder with your actual workspace ID:

- Beijing: `https://<WorkspaceId>.cn-beijing.maas.aliyuncs.com`
- Singapore: `https://<WorkspaceId>.ap-southeast-1.maas.aliyuncs.com`

## Regions and account terms

Provider terms, region eligibility and billing apply independently of this project's MIT license. Checked **2026-10-08**; the linked provider notes distinguish verified facts from unresolved details.

| Provider · region | Requirements and restrictions |
| --- | --- |
| OpenRouter · global | Availability depends on the account and underlying provider. Video generation needs temporary retention; do not assume zero data retention. [Video guide](https://openrouter.ai/docs/guides/overview/multimodal/video-generation) |
| Compatible endpoint · custom | Follow the selected server/model's license, allowed use and account rules. Use HTTPS for remote endpoints. |
| Gemini API · supported regions | Mainland China is absent from the [available-region list](https://ai.google.dev/gemini-api/docs/available-regions). Users must be 18+; the API is for professional/business development. API clients available in the EEA, UK or Switzerland must use paid services. [Terms](https://ai.google.dev/gemini-api/terms) |
| Gemini Omni · EEA / UK / Switzerland | Editing/extending uploaded videos and uploading/editing minors' images are restricted. This app supports first-frame images, not uploaded-video editing; a proxy does not change region eligibility. [Omni limitations](https://ai.google.dev/gemini-api/docs/omni) |
| Model Studio · Beijing / Singapore | Match workspace, region and key. Mainland paid usage requires real-name verification; free-quota conditions can differ. Activation needs a nonnegative balance, and billable use needs sufficient funds. Wan 3 preview may require approval. [FAQ](https://help.aliyun.com/zh/model-studio/faq-about-alibaba-cloud-model-studio), [quota rules](https://help.aliyun.com/zh/model-studio/new-free-quota), [regions](https://help.aliyun.com/zh/model-studio/regions) |
| Volcengine Ark · Beijing | Complete applicable real-name onboarding; confirm the current console requirements. Seedance activation accepts a balance above CNY 200, a qualifying savings plan, or remaining resource-pack quota. The detailed onboarding source remains incompletely verified. [Contract and confidence](docs/providers/ark.md), [activation requirements](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh) |
| BytePlus ModelArk · overseas | The general service list excludes the US and includes Canada, UK, Australia and New Zealand; restricted models have separate rules and purchase eligibility governs. Activation lists a balance above USD 30, a qualifying savings plan, or remaining resource-pack quota. Portrait inputs have provider authorization rules. [Availability](https://docs.byteplus.com/en/docs/ModelArk/availability), [provider details](docs/providers/ark.md) |

## Proxy configuration

`npm start` and the launcher enable Node's native environment-proxy support. For an account legally eligible to use the selected service, this shell example routes Gemini/OpenRouter through a local proxy and bypasses it for Model Studio/Volcengine hosts:

```bash
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
export NO_PROXY=.aliyuncs.com,.volces.com
npm start
```

On PowerShell, set the same names with `$env:HTTPS_PROXY`, `$env:HTTP_PROXY` and `$env:NO_PROXY` before `npm start`. With no proxy variables, requests go directly. Nonempty lowercase `https_proxy`, `http_proxy` and `no_proxy` values take precedence over uppercase names; clear stale lowercase values if your configuration seems ignored. The app always adds loopback hosts to the bypass list, so local endpoints never use a proxy. The UI shows the effective proxy address with credentials redacted. Invalid proxy configuration stops startup without echoing the raw URL. There is no per-lane proxy setting. For direct Node invocation, use `node --no-use-env-proxy server.js`. The initial process safely validates and normalizes proxy settings, then starts the service with native proxy support enabled; the negative flag protects the validation step.

## Privacy and local files

**Prompts, parameters, reference images, gallery selections, remote IDs, job/batch states, cost estimates and output paths persist on disk.** Keys stay in memory and disappear when the service stops.

| System | Default data directory |
| --- | --- |
| macOS | `~/Library/Application Support/videogen/` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/videogen/` |
| Windows | `%APPDATA%\videogen\` |

Portable bundles instead use `portable-data/` beside the launcher. `VIDEOGEN_DATA_DIR` overrides the location. Files include `jobs.ndjson`, `jobs.snapshot.ndjson`, `assets/`, nonsecret lane `settings.json`, optional `catalog.local.json`, OpenRouter's catalog cache and the instance lock. Directories/files use 0700/0600 where supported; they are not encrypted by the app.

**Clear history and assets** removes finished records and unused images. Unfinished and `needs_review` items remain, as do downloaded videos; delete videos separately. It does not delete provider data or backups. Nonsecret `videogen.*` browser preferences persist; API keys and output-directory preferences do not. Job records still contain their output paths.

Prompts/images go to the chosen provider; downloads may contact its returned storage/CDN URLs. Presigned downloads omit API credentials; authenticated downloads start on the lane origin and redirects strip credentials. Proxy URL userinfo and known keys are redacted from errors. There is no telemetry, update check or project-operated cloud service. [Privacy details](PRIVACY.md) · [Security policy](SECURITY.md) · [Architecture](docs/ARCHITECTURE.md)

## Development and acceptance

```bash
npm test
npm run test:e2e
VIDEOGEN_DEV=1 npm start
```

Tests use Node's built-in runner, local mock providers and temporary directories. They run offline and make no paid API calls. The 100-job crash acceptance run used two lanes, three SIGKILL restarts and five SSE disconnects: 92 succeeded, 5 moderation failures and 3 review items; zero duplicate creates, untracked remote jobs, hash mismatches or exposed keys. Observed lane maxima were 3/5 and the download pool maximum was 3. These are mock-test results, not a provider uptime or billing guarantee.

The app uses CommonJS and classic browser scripts. Legacy generation/status/download routes are removed; the UI uses persistent batch/job APIs and `/api/events`. See [Contributing](CONTRIBUTING.md), [Changelog](CHANGELOG.md) and the [release checklist](docs/GITHUB_LAUNCH_CHECKLIST.md).

[MIT license](LICENSE). Keep `runtime/`, generated media, local task data and credentials out of source control.
