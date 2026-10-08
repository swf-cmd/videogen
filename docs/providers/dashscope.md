# Alibaba Cloud Model Studio / DashScope

Access date for every source below: **2026-10-08**. ✅ first-party documentation read; ❓ unverified. No paid generation was performed during contract research.

| Item | Contract and confidence | Source |
| --- | --- | --- |
| Wan 3 base URLs | ✅ Beijing: `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com`; Singapore: `https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com`. A real workspace hostname is required before submission. | [Wan 3 API reference](https://help.aliyun.com/en/model-studio/wan3-video-generation-api-reference) |
| Regional isolation | ✅ Region, API key and model availability must match. Generic legacy DashScope hosts in the region guide do not establish Wan 3 support there. | [Regions](https://help.aliyun.com/zh/model-studio/regions) |
| Create/auth | ✅ `POST /api/v1/services/aigc/video-generation/video-synthesis`; Bearer key, JSON and `X-DashScope-Async: enable`. Models `wan3.0-video`, `wan3.0-video-prime`. | [Wan 3 API reference](https://help.aliyun.com/en/model-studio/wan3-video-generation-api-reference) |
| Request | ✅ `{model,input:{prompt,media?},parameters:{resolution,ratio,duration,audio,seed,prompt_extend?}}`; `resolution` uppercase `480P`, `720P`, `1080P`; `media:[{type:"first_frame",url}]` accepts a base64 data URL. | [Wan 3 API reference](https://help.aliyun.com/en/model-studio/wan3-video-generation-api-reference) |
| Parameters | ✅ Integer duration 2–30 seconds; ratio `adaptive`, `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`; audio defaults true. Seed -1 or 0–2147483647. | [Wan 3 API reference](https://help.aliyun.com/en/model-studio/wan3-video-generation-api-reference) |
| Response/poll | ✅ Create returns `output.task_id`, `output.task_status`. Bearer `GET /api/v1/tasks/{id}`; `PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELED`, `UNKNOWN`. Suggested polling: 15 seconds. | [Wan 3 API reference](https://help.aliyun.com/en/model-studio/wan3-video-generation-api-reference) |
| Result/retention | ✅ `output.video_url`; URL and task validity 24 hours, after which task status may be `UNKNOWN`. Download without Bearer. | [Wan 3 API reference](https://help.aliyun.com/en/model-studio/wan3-video-generation-api-reference) |
| Preview/audio | ✅ Preview requires application/activation. Audio generation is supported; turning it off does not reduce the quoted price. | [Wan 3 guide](https://help.aliyun.com/en/model-studio/wan3-video-generation-guide), [Pricing](https://help.aliyun.com/en/model-studio/model-pricing) |
| Limits | ✅ Published Wan 3 standard/prime limits: 5 create requests/second and 5 simultaneous jobs, including Singapore. App concurrency 2 is conservative policy, not the official maximum. Do not represent 5 RPS as an equivalent burst policy of 300 RPM. | [Rate limits](https://help.aliyun.com/en/model-studio/rate-limit) |
| Idempotency/cancel | ❓ No create-idempotency guarantee or cancellation endpoint established in the read pages. | [Wan 3 API reference](https://help.aliyun.com/en/model-studio/wan3-video-generation-api-reference) |

## Prices

✅ Published **list** rates, CNY per second in both regions. Do not convert the Singapore table to USD or assume the undated promotional discount applies. [Pricing](https://help.aliyun.com/en/model-studio/model-pricing), accessed 2026-10-08.

| Model / region | 480p | 720p | 1080p |
| --- | ---: | ---: | ---: |
| `wan3.0-video` / Beijing | 0.30 | 0.60 | 1.20 |
| `wan3.0-video` / Singapore | 0.374710 | 0.749420 | 1.498840 |
| `wan3.0-video-prime` / Beijing | 0.45 | 0.90 | 1.80 |
| `wan3.0-video-prime` / Singapore | 0.495838 | 1.020844 | 2.041687 |

## Errors and operational decisions

✅ The error reference distinguishes `InvalidApiKey`, billing errors such as `CommodityNotPurchased`/`PrepaidBillOverdue`, and HTTP 429 throttling including `Throttling.RateQuota`, `Throttling.BurstRate`, `Throttling.AllocationQuota`, `ServiceOverloaded`, `ResourceExhausted`. Allocation/token-rate quota is not account balance. `InvalidParameter.DataInspection` is a moderation error. A 500 `InternalError.DataInspection` does not establish that create was unaccepted: preserve unknown-outcome handling. [Error codes](https://help.aliyun.com/en/model-studio/error-code).

An unknown polling enum is a protocol error eligible for bounded polling retry, never a reason to submit again. The documented `UNKNOWN` after retention should become expired when age supports it; do not invent a successful result. No cloud Batch video discount: the published Batch support table does not include Wan video generation. [Batch inference](https://help.aliyun.com/zh/model-studio/batch-inference).

✅ Activation may require real-name verification, and the FAQ requires a nonnegative balance to activate Model Studio. This is distinct from Ark's Seedance-specific balance requirement. [Model Studio FAQ](https://help.aliyun.com/zh/model-studio/faq-about-alibaba-cloud-model-studio).

Use workspace templates and an editable base URL; block unresolved placeholders. Exclude resold video models until their own protocols are verified. Local first frames can be sent as data URLs; no third-party image host is needed.

## Adapter behavior

Choose Beijing or Singapore, then replace `workspace-id` in the displayed endpoint with the workspace's actual identifier. The adapter rejects legacy generic hosts, placeholder hosts and region mismatches before a create can be sent. `catalog.local.json` may override model capabilities and prices; API keys belong only in the local service's memory.

The catalog includes Wan 3.0 and Wan 3.0 Prime, with `pricingByRegion` in CNY. The app limits reference images to its supported JPEG/PNG/WebP formats and validates the documented dimensions before create. Image alpha/content constraints remain subject to provider validation. Polls with `UNKNOWN` become expired when the saved start time establishes 24-hour age; an unexpectedly early `UNKNOWN` is a protocol error and cannot cause resubmission. OSS result downloads carry no API key. Remote cancellation is not exposed because a supported endpoint was not established.

Offline contract tests cover both request shapes, workspace checks, signed-result download headers, stale tasks, moderation/billing/throttling, malformed create responses and uncertain transport failures. No paid smoke call was made because `VIDEOGEN_LIVE_DASHSCOPE_KEY` was absent.

## v2.1 first and last frames

Wan3.0 accepts `input.media` with one `first_frame` and one `last_frame`, both as local base64 data URLs. Videogen requires the first frame, preserves role order, validates each image, and rejects duplicate/unknown roles before generation. [Official material-combination rules and first-last-frame example](https://help.aliyun.com/en/model-studio/wan3-video-generation-api-reference).
