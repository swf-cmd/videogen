# OpenAI-compatible video servers

Access date: **2026-10-08**. ✅ means an official source was read; ❓ means not established. This adapter targets a user-operated compatible server, not the retired OpenAI Videos service.

| Item | Contract and confidence | Source (accessed 2026-10-08) |
| --- | --- | --- |
| vLLM-Omni endpoints | ✅ Async create `POST /v1/videos`; status `GET /v1/videos/{id}`; bytes `GET /v1/videos/{id}/content`; models selected at server startup. | [Videos API](https://docs.vllm.ai/projects/vllm-omni/en/latest/serving/videos_api/) |
| vLLM-Omni request | ✅ **Multipart**, including text-only requests: `prompt`, optional `model`, `seconds` string, `size` as `WIDTHxHEIGHT`, `input_reference` file, `seed`; extension fields include `num_frames`, `fps`, `width`, `height`. | [Videos API](https://docs.vllm.ai/projects/vllm-omni/en/latest/serving/videos_api/) |
| vLLM-Omni response | ✅ `id`, `status`, `created_at`; documented states include `queued`, `in_progress`, `completed`. | [Videos API](https://docs.vllm.ai/projects/vllm-omni/en/latest/serving/videos_api/) |
| vLLM-Omni authentication | ❓ Examples omit authentication; a deployment may enforce it. Do not infer universal unauthenticated access. | [Videos API](https://docs.vllm.ai/projects/vllm-omni/en/latest/serving/videos_api/) |
| SGLang request | ✅ `POST /v1/videos` accepts JSON (`prompt`, `size`) or multipart (`input_reference` file). `GET /v1/models` reports deployed model IDs. ❓ The read page does not establish duration/frame-count mapping. | [OpenAI API](https://docs.sglang.io/docs/sglang-diffusion/api/openai_api) |
| SGLang response/download | ✅ Creation returns an ID and status; examples poll `GET /v1/videos` until `completed`, then fetch `/v1/videos/{id}/content`. ❓ Individual status retrieval is not shown on this page. | [OpenAI API](https://docs.sglang.io/docs/sglang-diffusion/api/openai_api) |
| SGLang authentication | ✅ Examples use a Bearer header, including placeholder SDK keys. ❓ Whether a key is required depends on server configuration. | [OpenAI API](https://docs.sglang.io/docs/sglang-diffusion/api/openai_api) |
| Limits, TTL, price, idempotency | ❓ No shared guarantee. Deployment-specific; no commercial rate is assumed. | Both sources above |

Implementation decisions: configurable base URL and optional key; default concurrency **1 is a videogen policy**, not a vendor limit. No idempotency guarantee is assumed. Select JSON or multipart before submission; never retry create with another encoding after an ambiguous response. The server operator supplies model capabilities and any pricing. Unknown prices stay unknown. An HTTP URL outside loopback with a key requires a plaintext-transport warning. Content downloads carry a key only on the configured origin; redirect targets never inherit credentials.
