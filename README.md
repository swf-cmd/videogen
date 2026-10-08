# videogen

A local, zero-dependency AI video workbench with bring-your-own provider keys, prompt queues and automatic downloads. Chinese, Japanese, English and Korean interfaces. [中文说明](README.zh-CN.md)

**Sora is retired.** videogen replaces Sora2App's discontinued Sora integration. Version **1.1.0** supports OpenRouter and configurable OpenAI-compatible video endpoints. The old OpenAI Batch workflow and discount are gone.

## Start

Requires Node.js 18 or newer; no npm packages need installing.

```bash
git clone https://github.com/swf-cmd/videogen.git
cd videogen
npm start
```

Open the address printed by the server, normally `http://127.0.0.1:5177`. `PORT` changes the port. The server binds only to `127.0.0.1`.

On macOS, double-click **Start videogen.command**. The former `Start Sora2App.command` name is retired. Keep the launcher and app files together; if a maintainer-provided bundle includes `runtime/`, keep that directory too. Only one service can use a data directory, even on different ports. Linux and Windows can run from source; their output directory is entered manually. Opening `public/index.html` directly provides a preview, without generation.

## Generate and recover

1. Select **provider · region**. For a compatible endpoint, enter its API base URL and model ID, then configure the durations, resolutions, aspect ratios and request format documented by that server.
2. Enter the lane's key. A lane is provider + region + base URL. Keys remain in service memory; changing lane or URL clears the input, and restarting the service forgets keys. A local endpoint can allow an empty key.
3. Separate prompts with blank lines. A single prompt can be repeated. Set the model parameters, optional first-frame image, output directory and filename.
4. Review the estimated cost and time, then confirm. Unknown pricing is shown as **Unknown**, never as free. Estimates are not provider billing guarantees.
5. The service processes the queue **sequentially, one task at a time**: create → poll → download. Output defaults to `~/Downloads/videogen`. Existing files are preserved; collisions receive another filename. Provider bytes and metadata are saved without transcoding.

This is the **phase 0** release. Task records and assets are durable, but automatic queue resumption after a service restart and the persistent queue dashboard arrive in phase 1. Keep the service running. If interrupted, use **Recover an existing task** with the original provider, region, model and remote task ID. Recovery only polls and downloads; it does not create another paid video. If a create result is unknown, inspect the provider console before considering another submission: a charge may already exist.

## Providers

| Provider | Status in 1.1.0 | Notes |
| --- | --- | --- |
| OpenRouter · global | Supported | Dated catalog includes `alibaba/wan-3.0`, `alibaba/wan-2.7`, `runway/gen-4.5`. Model access can change. Local first-frame upload is disabled because a supported local upload/data-URL contract was not verified. [Contract and sources](docs/providers/openrouter.md) |
| OpenAI-compatible · custom | Supported, experimental | Configure your local or trusted server's exact model and capabilities. Choose JSON or multipart before submission; no automatic create-format fallback. [Contract and sources](docs/providers/openai-compatible.md) |
| Mock · local | Development only | Set `VIDEOGEN_DEV=1`; deterministic test bytes, not playable generated videos. |
| Gemini, Alibaba Cloud Model Studio, Volcengine Ark, BytePlus ModelArk | Planned for phase 1 | No direct adapter in this release. Eligibility information below is planning guidance, not an availability promise. |

Catalog records and official references live under `data/catalog/` and `docs/providers/`. User overrides are read from `catalog.local.json` in the data directory. Unverified model configurations are marked **Experimental**.

## Provider regions and terms

Checked **2026-10-08**. Provider terms, account access and billing remain separate from this project's MIT license.

| Provider · region | Requirements and restrictions |
| --- | --- |
| OpenRouter · global | Access depends on the account and underlying model provider. Video generation requires temporary retention; do not assume zero data retention. [Video guide](https://openrouter.ai/docs/guides/overview/multimodal/video-generation) |
| Compatible endpoint · custom | You operate or select the endpoint and are responsible for its model license, allowed use and account requirements. Use HTTPS for remote endpoints. |
| Gemini API · supported regions, planned | Mainland China is absent from the [available-region list](https://ai.google.dev/gemini-api/docs/available-regions). Users must be 18+, and use must be for professional or business development. API clients available in the EEA, UK or Switzerland must use paid services. [Terms](https://ai.google.dev/gemini-api/terms) |
| Gemini Omni · EEA / UK / Switzerland, planned | Editing or extending **uploaded videos** is unavailable; images containing minors also have upload/edit restrictions. This is not a blanket ban on first-frame images. [Omni limitations](https://ai.google.dev/gemini-api/docs/omni) |
| Alibaba Cloud Model Studio · Beijing / Singapore, planned | Activate each region separately. Mainland paid usage requires real-name verification; free-quota access can differ. Activation requires a nonnegative balance, and billable use needs sufficient funds. Model preview access may need approval. [FAQ](https://help.aliyun.com/zh/model-studio/faq-about-alibaba-cloud-model-studio), [quota rules](https://help.aliyun.com/zh/model-studio/new-free-quota), [regions](https://help.aliyun.com/zh/model-studio/regions) |
| Volcengine Ark · Beijing, planned | Complete the applicable real-name onboarding. Seedance activation lists balance **above CNY 200**, an eligible savings plan, or remaining resource-pack credit as alternatives; verify the account's current activation screen. [Platform overview](https://docs.volcengine.com/docs/ark/platform-capabilities-overview?lang=zh), [video API requirements](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh) |
| BytePlus ModelArk · overseas, planned | The general service list excludes the US and includes Canada, UK, Australia and New Zealand. Restricted models have separate rules; actual availability is determined at purchase. [International availability](https://docs.byteplus.com/en/docs/ModelArk/availability) |

## Privacy and local files

**Prompts, parameters, first-frame images, remote task IDs, cost estimates and output paths now persist on disk**, together with job status, provider information and output hashes. This differs from old Sora2App's request-only workflow.

| System | Default data directory |
| --- | --- |
| macOS | `~/Library/Application Support/videogen/` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/videogen/` |
| Windows | `%APPDATA%\videogen\` |

`VIDEOGEN_DATA_DIR` overrides the directory. The journal is `jobs.ndjson`, its compacted snapshot is `jobs.snapshot.json`, and content-addressed first frames live in `assets/`. Permissions are restricted where supported.

Use **Clear history and assets** to delete finished task records and unused images. Unfinished and `needs_review` records remain; downloaded videos remain. Delete videos separately in your file manager. The application never stores keys in files, browser storage or URLs. Nonsecret UI preferences use `videogen.*` localStorage keys; output-directory preferences are excluded, although a job's output path is recorded.

Submitted prompts and images go to your selected provider. Result downloads may use that provider's returned storage/CDN URLs. Credentials are not attached to presigned downloads or forwarded across redirects. There is no telemetry, update checking or project-operated cloud service. Displayed home paths use `~`; review all screenshots and reports before sharing.

[Privacy details](PRIVACY.md) · [Security policy](SECURITY.md) · [Architecture](docs/ARCHITECTURE.md)

## Development

```bash
npm test
VIDEOGEN_DEV=1 npm start
```

Tests use Node's built-in test runner, run offline and require no provider keys. The mock fixture is `test/fixtures/mock-provider-server.js`. The app uses CommonJS and classic browser scripts, without a build step. See [Contributing](CONTRIBUTING.md), [Changelog](CHANGELOG.md) and the maintainer's [packaging checklist](docs/GITHUB_LAUNCH_CHECKLIST.md).

[MIT license](LICENSE). `runtime/`, generated media, local task data and credentials do not belong in source control.
