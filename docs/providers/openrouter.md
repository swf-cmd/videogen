# OpenRouter

Access date: **2026-10-08**. ✅ official document or public API response read; ❓ unknown. No paid generation was performed during contract research.

| Item | Contract and confidence | Source (accessed 2026-10-08) |
| --- | --- | --- |
| Create/auth | ✅ `POST https://openrouter.ai/api/v1/videos`, JSON, Bearer key. Fields: `model`, `prompt`, integer `duration`, `resolution`, `aspect_ratio`, optional `generate_audio`, `seed`, `frame_images`. HTTP 202 returns `id`, `polling_url`, `status`. | [Submit reference](https://openrouter.ai/docs/api/api-reference/video-generation/submit-a-video-generation-request) |
| Failure responses | ✅ Reference lists 400, 401, 402 (insufficient credits), 403, 404, 413, 429 and 500. No proof that a 500 means unaccepted. | [Submit reference](https://openrouter.ai/docs/api/api-reference/video-generation/submit-a-video-generation-request) |
| Poll/status | ✅ `GET /api/v1/videos/{id}` with Bearer; states `pending`, `in_progress`, `completed`, `failed`, `cancelled`, `expired`; may include `error`, `unsigned_urls`, `usage.cost`. | [Poll reference](https://openrouter.ai/docs/api/api-reference/video-generation/poll-video-generation-status) |
| Download | ✅ `GET /api/v1/videos/{id}/content?index=0` with Bearer. | [Content reference](https://openrouter.ai/docs/api/api-reference/video-generation/download-generated-video-content) |
| Local first frame | ❓ `data:` support was not established. Official cookbook requests a public HTTPS image URL. **Disabled in videogen** until local upload/data support is verified. | [Image-to-video cookbook](https://openrouter.ai/docs/cookbook/video-generation/image-to-video) |
| Discovery/schema | ✅ `GET /api/v1/videos/models`; `data[]` includes `supported_durations`, `supported_resolutions`, `supported_aspect_ratios`, `supported_frame_images`, `generate_audio`, `pricing_skus`. | [Models reference](https://openrouter.ai/docs/api/api-reference/video-generation/list-all-video-generation-models) |
| Discovery/auth conflict | ✅ The reference marks Bearer required, while the guide omits it. An unauthenticated GET actually succeeded on the access date. Refresh can try without a key; authentication errors must be handled. | [Models reference](https://openrouter.ai/docs/api/api-reference/video-generation/list-all-video-generation-models), [guide](https://openrouter.ai/docs/guides/overview/multimodal/video-generation), [public endpoint](https://openrouter.ai/api/v1/videos/models) |
| Poll cadence | ✅ Guide suggests around 30 seconds. | [Guide](https://openrouter.ai/docs/guides/overview/multimodal/video-generation) |
| Retention, limits, idempotency | ❓ No duration, video concurrency/RPM ceiling or create-idempotency guarantee was established in these pages. Default concurrency 2 is an application policy. TTL remains unknown; download immediately. | [Guide](https://openrouter.ai/docs/guides/overview/multimodal/video-generation) |

## Dated public snapshot

The public endpoint was fetched without credentials on 2026-10-08. A compact factual fixture is saved in `test/fixtures/openrouter-models.json`. It is a dated fallback, not a future availability promise.

| Model | Durations | Resolutions | Aspect ratios | Audio | Observed pricing SKUs |
| --- | --- | --- | --- | --- | --- |
| `alibaba/wan-3.0` | 2–30 integer seconds | 480p, 720p, 1080p | 16:9, 4:3, 1:1, 3:4, 9:16 | true | `duration_seconds_480p: 0.05`, `duration_seconds_720p: 0.1`, `duration_seconds_1080p: 0.2` |
| `alibaba/wan-2.7` | 2–10 integer seconds | 720p, 1080p | 16:9, 9:16, 1:1, 4:3, 3:4 | true | `duration_seconds: 0.1` |
| `runway/gen-4.5` | 2–10 integer seconds | 720p | 16:9, 9:16 | false | `cents_per_second_output: 12` |

Source for every snapshot row: [public video models endpoint](https://openrouter.ai/api/v1/videos/models), accessed 2026-10-08 (✅). SKU values are strings, and names vary by provider. Do not treat arbitrary SKUs as a single dollar-per-second rate. Unsupported/ambiguous formulas produce an unknown estimate. The guide's illustrative `per-video-second` examples differ from the live names.

## Safety decisions

No automatic create retry without explicit nonacceptance evidence. `supportsIdempotencyKey` is false. Poll URLs must stay on the lane origin. Prefer the constructed authenticated content endpoint; if a response supplies an external presigned URL, send no credentials. Do not forward Authorization across redirects. Model discovery is an explicit POST-triggered action, never an automatic background host contact. No ZDR promise: the guide states video requires temporary retention.
