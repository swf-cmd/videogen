# Volcengine Ark / BytePlus ModelArk

Access date for every source below: **2026-10-08**. ✅ first-party document body read; ❓ not fully verified. Several sites initially returned a JavaScript shell. BytePlus contract details were read from the official page's embedded `MDContent`; CN create, get and tutorial bodies subsequently became readable. No paid generation was performed during research.

## Endpoints and models

| Lane | Base URL | Seedance 2.5 model | Confidence / source |
| --- | --- | --- | --- |
| Volcengine Beijing | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-seedance-2-5-260628` | ✅ [CN tutorial](https://docs.volcengine.com/docs/ark/seedance-2-5) |
| BytePlus overseas | `https://ark.ap-southeast.bytepluses.com/api/v3` | `dreamina-seedance-2-5-260628` | ✅ [BytePlus tutorial](https://docs.byteplus.com/en/docs/modelark/seedance-2-5) |

Keys and model IDs belong to their respective platform. No fixed key prefix is required by videogen. Use Bearer authentication only on the selected lane origin.

| Item | Contract and confidence | Source |
| --- | --- | --- |
| Create | ✅ `POST /contents/generations/tasks`; JSON `{model,content:[{type:"text",text}],resolution,ratio,duration,generate_audio}`; returns `id`. | [CN create](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh), [BytePlus create](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api) |
| First frame | ✅ Add `{type:"image_url",image_url:{url:"data:image/png;base64,..."},role:"first_frame"}`. Local base64 is explicitly supported. **For Seedance 2.5, `ratio` must be `adaptive`**, preserving the image's ratio. | [CN create](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh), [BytePlus create](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api) |
| Capabilities | ✅ 4–30 integer seconds; 480p, 720p, 1080p; text-only ratios 16:9, 4:3, 1:1, 3:4, 9:16, 21:9, adaptive. Audio defaults true. | [CN create](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh), [BytePlus tutorial](https://docs.byteplus.com/en/docs/modelark/seedance-2-5) |
| Seed | ✅ The detailed BytePlus seed support list names older Seedance models, not 2.5. ❓ No 2.5 seed support was established for CN. Both included 2.5 models disable seed; an explicit seed is rejected before create. | [BytePlus create, seed section](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api) |
| Images | ✅ JPEG, PNG, WebP and additional formats accepted; width/height 300–6000 pixels, width/height ratio 0.4–2.5, each image under 30 MB. Application limits can be lower. | [BytePlus create](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api) |
| Poll | ✅ Bearer `GET /contents/generations/tasks/{id}`; `queued`, `running`, `cancelled`, `succeeded`, `failed`; errors carry `error.code`/`error.message`. | [CN get](https://docs.volcengine.com/docs/ark/get-video-generation-task-api?lang=zh), [BytePlus get](https://docs.byteplus.com/en/docs/ModelArk/1521309) |
| Result/retention | ✅ `content.video_url`, valid 24 hours; Seedance 2.5 permits at most 100 downloads. Task records last 7 days. Download without Authorization. | [CN get](https://docs.volcengine.com/docs/ark/get-video-generation-task-api?lang=zh), [BytePlus get](https://docs.byteplus.com/en/docs/ModelArk/1521309) |
| Limits | ✅ Individual: 180 RPM, 3 simultaneous jobs. Enterprise: 600 RPM, 10 simultaneous jobs. Account/model limits may change; app defaults 3. | [CN tutorial](https://docs.volcengine.com/docs/ark/seedance-2-5), [BytePlus tutorial](https://docs.byteplus.com/en/docs/modelark/seedance-2-5) |
| Cancellation | ✅ Only remotely `queued` tasks can be cancelled; running tasks cannot. A DELETE of a completed task deletes its record, so do not issue DELETE blindly after a state race. | [CN get](https://docs.volcengine.com/docs/ark/get-video-generation-task-api?lang=zh), [BytePlus cancellation](https://docs.byteplus.com/en/docs/modelark/cancel-or-delete-video-generation-tasks-api?redirect=1) |
| Idempotency/cadence | ❓ No create-idempotency guarantee established. Tutorial examples use differing poll cadences; 15 seconds is application policy. | [CN tutorial](https://docs.volcengine.com/docs/ark/seedance-2-5), [BytePlus tutorial](https://docs.byteplus.com/en/docs/modelark/seedance-2-5) |

Some Seedance 2.5 parameter failures occur **after acceptance**, during remote processing. A remotely failed task must not be treated as a safely unaccepted create just because its error says `InvalidParameter`. Unknown status values are protocol errors for bounded poll retry; never call create from a poll path. [CN tutorial](https://docs.volcengine.com/docs/ark/seedance-2-5).

1080p output uses 10-bit H.265/HEVC and may not play in every browser. Preserve the downloaded bytes and implicit labels; do not transcode. The optional visible `watermark` parameter defaults false; omitting it does not remove provider metadata. [CN create](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh).

## Price evidence

✅ BytePlus Seedance 2.5, without input video: USD 10.70/million tokens for 480p/720p and USD 11.70/million for 1080p. The published estimate is `duration × width × height × frameRate / 1024`, then multiply by price/million. Exact output dimensions vary by aspect ratio; do not substitute one universal per-second amount. `usage.completion_tokens` is the billing reference. Published examples for five seconds at 16:9 are USD 0.514 (480p), 1.156 (720p), 2.843 (1080p). [BytePlus pricing](https://docs.byteplus.com/en/docs/modelark/model-pricing).

The catalog records the documented dimensions by resolution and ratio, a 24 fps factor, and the 1024 pixel divisor. For example, five seconds at 1280 × 720 estimates 108,000 tokens, or USD 1.1556. Adaptive text-only output has no fixed dimensions and remains unknown. These are estimates; actual billing follows provider usage. [BytePlus create dimensions](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api).

❓ CN pricing body remained unavailable on direct reads. Official search indexing exposed CNY 70/million at 480p/720p and 77/million at 1080p (without input video), but this is **not a verified catalog price**. Keep the estimate unknown until the live page can be read. Do not reuse the task brief's approximate yuan/second figures. [CN pricing](https://docs.volcengine.com/docs/ark/model-pricing?lang=en&redirect=1).

## Error categories

✅ BytePlus lists `AuthenticationError` (401); `AccountOverdueError`/`OperationDenied.ServiceOverdue` (403 billing); HTTP 429 codes including `RateLimitExceeded.EndpointRPMExceeded`, `ModelAccountRpmRateLimitExceeded`, `APIAccountRpmRateLimitExceeded`, `InflightBatchsizeExceeded`, `ServerOverloaded`; and moderation codes such as `InputImageSensitiveContentDetected.PrivacyInformation` and `OutputVideoSensitiveContentDetected`. `QuotaExceeded` is ambiguous: both trial exhaustion and queued-task limits use it. Inspect the documented message/context; do not classify every quota occurrence as permanent balance failure. A create 5xx remains unknown outcome. [BytePlus error codes](https://docs.byteplus.com/en/docs/modelark/error-codes).

❓ CN error-code page could not be directly read; shared-platform similarity alone is not proof that all detailed codes are identical. Use standard HTTP classification and confirmed sensitive-content codes conservatively.

## Availability and account setup

✅ BytePlus's general service-country list omits the United States but **includes Canada, the United Kingdom, Australia and New Zealand**. The list excludes separately restricted models; point-of-purchase availability governs. Do not repeat the task brief's broader exclusion claim. [Availability](https://docs.byteplus.com/en/docs/ModelArk/availability).

✅ CN Seedance activation requires one qualifying option: balance above CNY 200, a qualifying CNY 200-or-higher savings plan, or a resource pack with remaining quota. BytePlus documents corresponding options above USD 30 / a USD 30-or-higher savings plan / a remaining resource pack. [CN create](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh); [BytePlus tutorial](https://docs.byteplus.com/en/docs/modelark/seedance-2-5).

❓ CN real-name onboarding is described in official indexed excerpts, but the overview body was unavailable: confirm in the console rather than promise unverified eligibility. [Platform overview](https://docs.volcengine.com/docs/ark/platform-capabilities-overview?lang=zh).

✅ Direct uploads containing real faces are restricted; official flows include authorized portraits, trusted generated assets and preset virtual people. Treat a confirmed portrait/content rejection as one job's moderation failure. Do not automate account verification or bypass it. [CN create](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh).

## Adapter behavior

The catalog scopes each Seedance 2.5 model to its own region and key. The first frame is fitted locally to the selected aspect ratio, then submitted as a data URL with `ratio:"adaptive"`, as required by the API. Text-only requests retain the selected ratio. Download TOS/CDN URLs without Authorization, preserve returned bytes, and do not add a flex tier or assume promotional prices.

The adapter deliberately omits cancellation: a queued task can finish between a check and DELETE, at which point DELETE destroys the completed record. Already submitted cancelled batches continue tracking/download. A remote terminal parameter or moderation failure remains an accepted job; it does not authorize retry. Create 5xx, reset, timeout, missing ID and malformed responses remain unknown outcomes.

Offline contract tests cover create/poll/download, first-frame adaptation, token estimates, error mapping and credential boundaries. `VIDEOGEN_LIVE_ARK_KEY` was absent, so no paid smoke call was made.
