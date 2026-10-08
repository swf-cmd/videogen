# Open-weight video models, local serving interfaces, and agent/MCP integration (as of 2026-10-08)

*All sources accessed 2026-10-08. Method note: direct page fetches (WebFetch/curl) were blocked by the sandbox egress proxy for most domains, including artificialanalysis.ai, docs.vllm.ai, docs.sglang.io and techjacksolutions.com. Findings therefore come from (a) web-search result extracts of the cited pages and (b) GitHub repository metadata (star counts, creation and update dates, descriptions) pulled live from the GitHub search API on 2026-10-08. Star counts are exact as of that date. Search-extract claims carry the uncertainty noted inline.*

---

## Q1. Which open-weight video models are competitive and runnable on consumer/prosumer GPUs (Oct 2026)?

### Takeaway
The open-weight frontier changed sharply in Jul–Aug 2026. Three new open models with native audio are now the competitive set: **MiniMax H3** (Aug 3), **MAGI-2 Preview** (Aug 5) and **LTX-2.5** (Aug 11). MiniMax H3 is the only open model near the closed top tier. Alibaba stopped publishing flagship Wan weights after **Wan 2.2** (Jul 2025), so Wan 2.5, 2.6, 2.7 and 3.0 are API-only. Every strong open model except Wan 2.2 carries a restrictive "community" license: territorial exclusions (H3, HunyuanVideo 1.5) or revenue caps (LTX). On a 24 GB RTX 4090 you can practically run 5–10 s clips at 720p from Wan 2.2, HunyuanVideo 1.5 and distilled or quantized LTX-2.5, at roughly 1–4 min per clip. H3 runs on 12–24 GB only with heavy offloading or community quantizations.

### Cited Findings

**Leaderboard position (Artificial Analysis, crowd-voted Elo; read from search extracts of AA pages, not opened directly)**
- AA's FAQ says **Wan 3.0** (closed/API-only) leads AA-Video-T2V v2.0 overall at 1156 Elo — [AA T2V leaderboard](https://artificialanalysis.ai/video/leaderboard/text-to-video)
- Open-weights T2V leader is **MiniMax H3 (768p) at 1137 Elo**, followed by LTX-2.5 Fast (946) and LTX-2.5 Pro (943) — [AA T2V leaderboard](https://artificialanalysis.ai/video/leaderboard/text-to-video)
- Open-weights I2V board: MiniMax H3 1181, **MAGI-2 Preview 1093**, LTX-2.5 variants 1038 / 1007 — [AA I2V open-weights leaderboard](https://artificialanalysis.ai/video/leaderboard/image-to-video/open-weights)
- T2V-with-audio board: the open-weights MiniMax H3 entry is listed at 1220 Elo, **ranked 4th overall** and released Jul 2026. The LTX-2.5 Fast and Pro variants sit near 1055 and 1053 — [AA embed T2V leaderboard](https://artificialanalysis.ai/embed/text-to-video-leaderboard/leaderboard/text-to-video)
- Caveat: Elo scales differ per board (the T2V v2.0 anchor is fixed at 1000). An Apr 30 third-party snapshot listed "HappyHorse-1.0" (Alibaba) at #1 with 1368, while AA's current board shows it at 1023 — [pinggy.io](https://pinggy.io/blog/best_video_generation_ai_models/), [techsy.io](https://techsy.io/en/blog/best-ai-video-models). An aggregator, theopenweights.com, lists "FLUX 3" as #1 T2V on Oct 5, 2026, which could not be reconciled with AA — [theopenweights.com](https://theopenweights.com/leaderboards)

**Wan (Alibaba): open vs API-only**
- Open-weight flagship releases stopped at **Wan 2.2 (released Jul 28, 2025, Apache 2.0)**. Wan 2.5, 2.6 and 2.7 never had weights published — [howaiworks.ai](https://howaiworks.ai/blog/alibaba-wan-open-weights-stopped-at-2-2); [wavespeed.ai](https://wavespeed.ai/blog/video-model-access/is-wan-3-0-open-source/)
- Wan 2.5 launched API-only on Alibaba Cloud, and Wan 2.6 requires commercial API access — [MindStudio](https://www.mindstudio.ai/blog/what-is-wan-2-5-image); [Cliprise](https://www.cliprise.app/news/alibaba-wan-2-2-2-6). Wan 2.7 (Apr 2026) has no public weights — [Runpod](https://www.runpod.io/articles/guides/wan-2-7-runpod)
- **Wan 3.0**: public beta added to Alibaba Cloud Model Studio on Aug 6, 2026, with clips up to 30 s. Broad release on ~Aug 24 via wan.video, Model Studio and the Qwen Cloud API. The Model Studio API reference (updated Sep 4, 2026) contains no "license", "weights" or "open source" terms. Claims of Apache 2.0 Wan 3.0 weights trace back to a single social post and are uncorroborated — [howaiworks.ai](https://howaiworks.ai/blog/alibaba-wan-open-weights-stopped-at-2-2); [datanorth.ai](https://datanorth.ai/news/alibaba-launches-wan3-0-video-model); [seedance.tv](https://www.seedance.tv/blog/wan-3-0-open-source-model) (says no verified weights as of Sep 1, 2026)
- Alibaba still ships open *side* models: Wan2.2-Animate-2-14B (updated Aug 9, 2026) and Wan-Dancer-14B (music-to-dance, Jul 2026), both Apache 2.0 — [howaiworks.ai](https://howaiworks.ai/blog/alibaba-wan-open-weights-stopped-at-2-2) (via search extract)
- Wan 2.2 specs: a 27B MoE (14B active) plus a TI2V-5B variant (Apache 2.0), which runs in about 8 GB in ComfyUI — [thundercompute](https://www.thundercompute.com/blog/best-open-source-ai-video-generation-models); [localaimaster](https://localaimaster.com/blog/local-ai-video-generation)
- GitHub stars: Wan-Video/Wan2.2 **17,772**; Wan-Video/Wan2.1 **17,110** — [GitHub Wan2.2](https://github.com/Wan-Video/Wan2.2), [GitHub Wan2.1](https://github.com/Wan-Video/Wan2.1)

**MiniMax H3 (Hailuo 3)**
- Announced Jul 31, 2026 as API-only. Weights posted Aug 3, 2026 on Hugging Face (MiniMaxAI/MiniMax-H3) under the "MiniMax H3 Community License". A ComfyUI repackage (Comfy-Org/MiniMax-H3) shipped the same day as native ComfyUI support — [Runpod blog](https://www.runpod.io/blog/minimax-h3-the-open-weight-omni-modal-video-model-and-what-it-takes-to-run-it); [Atlas Cloud](https://www.test.atlascloud.ai/blog/tips/minimax-h3-open-source-weights); [SCMP](https://www.scmp.com/tech/article/3362540/video-ai-minimax-challenges-bytedance-low-price-open-weights-new-h3-model)
- License: use is **not authorized in the US, EU, UK or South Korea**, and the restriction reaches outputs produced there — [NYU Shanghai RITS](https://rits.shanghai.nyu.edu/ai/minimax-ships-h3-weights-with-the-us-and-eu-excluded/). Commercial terms are summarized inconsistently. One source says use is free with a required "MiniMax H3" UI attribution and needs written authorization above $20M annual revenue. Another says non-commercial use is free with limited commercial use — [Runpod blog](https://www.runpod.io/blog/minimax-h3-the-open-weight-omni-modal-video-model-and-what-it-takes-to-run-it)
- Architecture and size: H3-Base is a **33B dense** single-stream transformer. Components total ~123.6 GB at native precision and ~42.5 GB when choosing the smallest variant of each. ComfyUI says it reaches a **12 GB RTX 3060 with offloading**. Local generation is natively **768 px short edge**, and 2K requires a second in-context pass — [Runpod blog](https://www.runpod.io/blog/minimax-h3-the-open-weight-omni-modal-video-model-and-what-it-takes-to-run-it); [Atlas Cloud](https://www.test.atlascloud.ai/blog/tips/minimax-h3-open-source-weights)
- Datacenter reference: a vLLM recipe reports 8.7 s of 1248×768 video with synchronized stereo audio in ~87 s on 4×B300 — [vLLM recipes](https://recipes.vllm.ai/MiniMaxAI/MiniMax-H3)
- Community quantizations (unofficial): GGUF Q3_K_M 8.9 GB (~12 GB GPUs), Q4_K_M 11.6 GB (16 GB GPUs), Q5_K_M recommended for 24 GB — [HF Abiray GGUF](https://huggingface.co/Abiray/MiniMax-H3-Pruned-GGUF). An INT8 build needs 24 GB+ VRAM — [HF int8](https://huggingface.co/abhishekchohan/minimax-h3-int8). An FP8 build needs ~75 GB+ host RAM for the streamed-offload consumer path — [HF fp8](https://huggingface.co/abhishekchohan/minimax-h3-fp8)

**Lightricks LTX-2 / 2.3 / 2.5**
- LTX-2 (19B: 14B video + 5B audio) was the first open model to generate synchronized video and audio in one pass — [localaimaster](https://localaimaster.com/blog/local-ai-video-generation); [thundercompute](https://www.thundercompute.com/blog/best-open-source-ai-video-generation-models). LTX-2.3 was an interim release in Mar 2026 — [NYU Shanghai RITS](https://rits.shanghai.nyu.edu/ai/ltx-2-5-adds-native-multi-shot-video-and-a-diffusion-decoder/)
- **LTX-2.5** (Aug 11, 2026) is a 22B asymmetric dual-stream DiT that generates video and audio jointly, with a Gemma 4 12B text encoder. It supports T2V, I2V, V2V, T2A and A2V, ships dev and distilled checkpoints, and adds native multi-shot and a diffusion decoder. The HF repo is gated — [NYU Shanghai RITS](https://rits.shanghai.nyu.edu/ai/ltx-2-5-adds-native-multi-shot-video-and-a-diffusion-decoder/); [ComfyUI Wiki](https://comfyui-wiki.com/en/news/2026-08-11-ltx-2-5-open-weights-release); [HF Lightricks/LTX-2.5-Diffusers](https://huggingface.co/Lightricks/LTX-2.5-Diffusers/tree/main)
- License: **LTX-2.x Community License**, free for organizations under $10M ARR, with a commercial license required above that — [ComfyUI Wiki](https://comfyui-wiki.com/en/news/2026-08-11-ltx-2-5-open-weights-release); [gradually.ai](https://www.gradually.ai/en/ai-models/ltx-2-5/). One table lists LTX-2 as Apache 2.0, which conflicts with this — [sevenlabs](https://www.sevenlabs.site/blogs/best-open-source-video-generation-models-2026)
- Max resolution conflicts. ComfyUI Wiki claims 4K HDR output with day-one ComfyUI templates. Gradually.ai ties 4K to the hosted API's Fast mode, with Pro at 720p/1080p — [ComfyUI Wiki](https://comfyui-wiki.com/en/news/2026-08-11-ltx-2-5-open-weights-release); [gradually.ai](https://www.gradually.ai/en/ai-models/ltx-2-5/). Another blog lists 4K and 20 s with 24 kHz stereo audio — [builderai.tools](https://builderai.tools/blog/best-open-source-video-generation-stack-2026)
- Vendor speed claim: a 10 s clip in 6.8 s on 2× GB200 at 720p (self-measured) — [cryptobriefing](https://cryptobriefing.com/ltx-2-5-ai-video-model-release/)
- Consumer GPU (community-reported):
  - An fp8 distilled build takes ~99 s per video on an RTX 4090 with 64 GB RAM, and over 10 min when it spills to system RAM — [HF guillaume127/LTX-2.5-FP8](https://huggingface.co/guillaume127/LTX-2.5-FP8)
  - The INT8 build sits at ~22.67 GiB resident on a 4090 for 5 s clips — [runaihome](https://runaihome.com/blog/ltx-2-5-local-ai-video-hardware-guide-2026/)
  - On an RTX 5060 Ti 16 GB with NVFP4, a 1344×768, ~4.4 s clip takes ~170 s with system RAM above 92% (Reddit report relayed by a blog) — [openclawdc](https://openclawdc.com/blog/can-i-run-ltx-2-5-locally/)
  - The distilled path uses a fixed 8 steps at CFG 1. num_frames must satisfy % 8 == 1, and dimensions must be divisible by 32 — [ltxworkflow](https://ltxworkflow.com/models/ltx25-distilled-nvfp4)
- GitHub stars:
  - Lightricks/LTX-2 **9,622** (created Jan 3, 2026) — [GitHub](https://github.com/Lightricks/LTX-2)
  - LTX-Video **11,049** — [GitHub](https://github.com/Lightricks/LTX-Video)
  - ComfyUI-LTXVideo **4,176** — [GitHub](https://github.com/Lightricks/ComfyUI-LTXVideo)
  - **LTX-Desktop 2,048**, an open-source desktop app for generating videos with LTX models, created Mar 4, 2026 — [GitHub](https://github.com/Lightricks/LTX-Desktop)

**Tencent HunyuanVideo 1.5**
- 8.3B parameters, aimed at consumer GPUs. It renders natively at 720p with super-resolution to 1080p, and needs ~14 GB VRAM with offloading or 24 GB comfortably — [HF tencent/HunyuanVideo-1.5](https://huggingface.co/tencent/HunyuanVideo-1.5); [ComfyUI blog](https://blog.comfy.org/p/hunyuanvideo-15-native-support); [thundercompute](https://www.thundercompute.com/blog/hunyuan-video-comfyui)
- A step-distilled 480p I2V model (Dec 5, 2025) runs 8 or 12 steps and cuts end-to-end time by 75% on an RTX 4090 — [HF README](https://huggingface.co/tencent/HunyuanVideo-1.5). No audio — [localaimaster](https://localaimaster.com/blog/local-ai-video-generation)
- License: the mirrored license text is the **Tencent Hunyuan Community License, whose territory excludes the EU, UK and South Korea**. ComfyUI Wiki's "Apache 2.0" label appears wrong — [llm-stats](https://llm-stats.com/models/hunyuan-video-1.5); contradicted by [ComfyUI Wiki](https://comfyui-wiki.com/en/models/hunyuan/hunyuan-1-5)
- No official 2026 release found. "HunyuanVideo 2.0" (4K) appears only on a commercial platform's blog and is unverified — [picassoia](https://blog.picassoia.com/hunyuanvideo-2-0-4k-video-what-to-expect)
- GitHub stars: HunyuanVideo-1.5 **4,575**; HunyuanVideo (original 13B) **12,603** — [GitHub 1.5](https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5), [GitHub](https://github.com/Tencent-Hunyuan/HunyuanVideo)

**Sand.ai MAGI-2 Preview**
- Released Aug 5, 2026: a 114B-parameter MoE ("MagiMoE") with ~6B active per token. It is a unified audio-video model supporting T2V and TI2V, with **clips fixed at 10 s**. Generation is two-stage: a 512×896 preview, then a refiner to 1088×1920 (1080p). Weights are at sand-ai/MAGI-2-preview, and code is reportedly Apache-2.0 — [HF sand-ai/MAGI-2-preview](https://huggingface.co/sand-ai/MAGI-2-preview); [ComfyUI Wiki](https://comfyui-wiki.com/zh/news/2026-08-05-magi-2-preview)
- SGLang support is still an open PR — [orcarouter](https://www.orcarouter.ai/blog/magi-2-preview-sglang-serving-leak)

**Others**
- **SkyReels V3** (Skywork): code and weights released Jan 29, 2026. It covers multi-subject reference-to-video, audio-guided generation (A2V-19B) and V2V-14B. It requires Python 3.12+ and CUDA 12.8+, with `--low_vram` for GPUs under 24 GB. Third-party guides say it builds on the Wan2.1 architecture — [HF Skywork/SkyReels-V3-A2V-19B](https://huggingface.co/Skywork/SkyReels-V3-A2V-19B); [sourcepulse](https://www.sourcepulse.org/projects/25003051)
- **Kandinsky 5.0** (Nov 18, 2025): Video Lite (2B) produces up to 10 s at 768×512 / 24 fps. Video Pro (19B) targets 1280×768. Apache 2.0 is claimed only by a third party — [HF kandinskylab](https://huggingface.co/kandinskylab/Kandinsky-5.0-T2V-Lite-sft-10s); [arXiv 2511.14993](https://arxiv.org/abs/2511.14993)
- **CogVideoX** (2024) is legacy at this point; zai-org/CogVideo has **13,066** stars — [GitHub](https://github.com/zai-org/CogVideo)
- **FastVideo** (hao-ai-lab) is an inference and post-training acceleration framework with **4,566** stars — [GitHub](https://github.com/hao-ai-lab/FastVideo)

**Consumer hardware timings (blog-reported; methods unstated)**
| Model / setting | RTX 4090 | RTX 5090 |
|---|---|---|
| Wan 2.2 14B, 720p, 5 s | ~2:40, ~15 GB | ~1:45 |
| Wan 2.2 14B, 720p, 10 s | OOM / heavy swap | ~4:10, ~22 GB |
| Wan 2.2 14B, 480p, 10 s | ~4:20 | ~2:55 |
| HunyuanVideo 1.5, 720p, 5 s | ~3:50 | ~2:30 |

Source: [bestgpuforai](https://bestgpuforai.com/articles/rtx-5090-vs-4090-for-video-gen/)

- A GPU-cloud vendor contradicts this table, saying Wan 2.2 needs 65–80 GB at 720p and that consumer GPUs "cannot run Wan 2.1 or HunyuanVideo at production settings" — [Spheron](https://www.spheron.network/blog/ai-video-generation-gpu-guide/). The same vendor estimates LTX-2.3 needs 24–32 GB at 720p fp8 and takes ~5–8 min per 5 s 720p clip on a 5090 — [Spheron](https://www.spheron.network/blog/ai-video-generation-gpu-guide/)
- Hardware: the RTX 5090 has 32 GB GDDR7 and ~1.79 TB/s (+78% over the 4090) — [Runpod](https://www.runpod.io/articles/guides/nvidia-rtx-5090). October 2026 street prices are ~$4,300–5,000+ for the 5090 and $1,599–1,999 for new-stock 4090s, which are discontinued at retail — [tech-insider](https://tech-insider.org/rtx-5090-vs-4090-3d-rendering-no-ai-2026/)

### Inferences
- For a local-first tool, the realistic "local model" targets in Oct 2026 are:
  - **Wan 2.2** (the only permissive license; mature ecosystem)
  - **LTX-2.5** (audio, fast distilled path, best tooling, but $10M ARR cap)
  - **HunyuanVideo 1.5** (no audio; EU/UK/KR excluded)
  - **MiniMax H3** (best quality, but unusable for US/EU/UK/KR users under the license; heavy)
- License metadata per model, including territory and revenue limits, should be surfaced to users. This matters more than for API providers, where the provider's ToS applies.
- Generation times of roughly 1–5 min per clip on a 4090/5090, with OOM cliffs on longer clips, make a **crash-safe, serialized GPU queue** (videogen's existing strength) more valuable locally than for cloud APIs. A single GPU cannot run jobs concurrently.
- Because Alibaba's newest Wan models are API-only (DashScope Wan 3, which videogen already supports), "Wan" support splits into API-Wan 3 and local-Wan 2.2. These are different integration paths.
- Quality gap: H3 at 4th overall on the audio board suggests open weights are now within reach of the closed top tier. LTX-2.5 and Wan 2.2 are clearly a tier below on AA Elo.

### Gaps
- Could not open Artificial Analysis pages directly; Elo figures come from search extracts and may be stale or misattributed. No Wan 2.2 or HunyuanVideo 1.5 position on AA's current boards was found.
- No 2026 data was found for Mochi, Step-Video, Open-Sora 2.x or FramePack. They appear to have fallen out of the competitive set, but this is not confirmed.
- No independent, controlled 4090/5090 benchmarks were found for LTX-2.5, MiniMax H3 or MAGI-2. MAGI-2's consumer-GPU feasibility (114B total params) is unknown.
- Official LTX-2.5 local max resolution and duration were not verified from the model card. MiniMax H3's official commercial terms were not read.
- GitHub star count for the main ComfyUI repo was not retrieved.

---

## Q2. What serving interfaces exist, and is a de facto standard video API emerging?

### Takeaway
Two de facto standards coexist:
1. **ComfyUI's graph API** (`POST /prompt` → WebSocket or `/history` → `/view`). It is the day-one runtime for nearly every new open model (H3, LTX-2.5 and HunyuanVideo 1.5 all had same-day native ComfyUI support), and Comfy Cloud mirrors it.
2. **The OpenAI-shaped async job API**: `POST /v1/videos` → `GET /v1/videos/{id}` → `GET /v1/videos/{id}/content`. vLLM-Omni, SGLang Diffusion, NVIDIA Dynamo, LiteLLM and OpenRouter (`/api/v1/videos`) converged on this shape, even though **OpenAI itself shut down the Videos API on Sep 24, 2026** with no replacement.

The job lifecycle is converging. Request bodies are not: multipart vs JSON, `size`/`seconds` vs `width`/`height`/`num_frames`/`fps`, and vendor extension blocks such as Dynamo's `nvext`.

### Cited Findings

**OpenAI Videos API (reference shape; now shut down)**
- Shape: `POST /v1/videos` creates an async job, `videos.retrieve` polls status and progress, a content endpoint downloads the MP4, plus remix (POST with source video id + prompt), delete and list. Models were sora-2 (speed) and sora-2-pro (quality) — [OpenAI video guide](https://developers.openai.com/api/docs/guides/video-generation); [LiteLLM docs](https://docs.litellm.ai/docs/providers/openai/videos)
- **Deprecation**: notified Mar 24, 2026. The Videos API, sora-2, sora-2-pro and three dated snapshots shut down on **2026-09-24**, and the replacement column is empty — [OpenAI deprecations](https://developers.openai.com/docs/deprecations). The consumer Sora apps ended Apr 26, 2026 — [zilliz](https://zilliz.com/ai-faq/what-is-the-sora-shutdown-timeline); [mindstudio](https://www.mindstudio.ai/blog/openai-shutting-down-sora-what-happened). Secondary reports describe the removal as complete — [Spheron](https://www.spheron.network/blog/sora-2-api-shutdown-2026-self-hosted-video-alternatives/)

**vLLM-Omni** (GitHub vllm-project/vllm-omni: **7,072** stars, **1,917 open issues**, created Sep 11, 2025)
- Endpoints:
  - `POST /v1/videos` (async job)
  - `POST /v1/videos/sync` (returns raw bytes; for tests and benchmarks)
  - `GET /v1/videos/{id}`
  - `GET /v1/videos` (list)
  - `GET /v1/videos/{id}/content`
  - `DELETE /v1/videos/{id}`
- **Multipart form bodies**. OpenAI fields are `prompt`, `model`, `seconds`, `size`=WxH and `user`. `input_reference` file upload is an extension for I2V. The quickstart uses port 8091 and also sends `width`, `height`, `num_frames`, `fps` and `num_inference_steps`.
- One model per server (`vllm serve <model> --omni`). The docs recommend the job route for production.
- Sources: [vLLM-Omni Videos API docs](https://docs.vllm.ai/projects/vllm-omni/en/stable/serving/videos_api/); [GitHub](https://github.com/vllm-project/vllm-omni)
- NVIDIA Dynamo wraps vLLM-Omni with the same `/v1/videos` route but uses a **JSON** body with an `nvext` object (steps, frames, seed) on port 8000. `input_reference` may be a URL, a data URI or a local path. Tested models: Wan2.1 1.3B and Wan2.2 14B T2V; Wan2.2 5B and 14B I2V — [NVIDIA Dynamo vLLM-Omni](https://docs.nvidia.com/dynamo/v1.3.0/backends/v-llm/v-llm-omni)

**SGLang Diffusion** (launched Nov 7, 2025)
- One HTTP server serves an OpenAI-compatible image and video API plus LoRA adapter management. Supported video families: Wan series, FastWan, Hunyuan — [LMSYS blog](https://lmsys.org/blog/2025-11-07-sglang-diffusion); [SGLang Diffusion OpenAI API docs](https://docs.sglang.io/diffusion/api/openai_api.html)
- Flow: `POST /v1/videos` returns a job id, then poll `GET /v1/videos/{id}` until completed or failed, then download from `GET /v1/videos/{id}/content`. Launched with `sglang serve --model-path …`, default port 30000 — [NVIDIA AIPerf SGLang video guide](https://docs.nvidia.com/aiperf/tutorials/model-endpoint-guides/sg-lang-video-generation)
- Dynamo's example JSON body: `{"prompt", "model", "seconds": 2, "size": "832x480", "response_format", "nvext": {fps, num_frames, steps}}` — [NVIDIA Dynamo text-to-video](https://docs.nvidia.com/dynamo/diffusion/text-to-video.md)
- NVIDIA AIPerf has a `video_generation` endpoint type, which makes this API shape a benchmark target — [NVIDIA AIPerf](https://docs.nvidia.com/aiperf/tutorials/model-endpoint-guides/sg-lang-video-generation)

**Gateways adopting the shape**
- **LiteLLM** proxy: `/v1/videos` create, status, content and remix, with Sora, Runway Gen-4 and Gemini/Vertex Veo behind one surface. Its docs' bullet list names different paths (`/videos/generations`), which is inconsistent — [LiteLLM videos](https://docs.litellm.ai/docs/videos); [LiteLLM Runway](https://docs.litellm.ai/docs/providers/runwayml/videos); [LiteLLM Veo](https://docs.litellm.ai/docs/providers/gemini/videos)
- **OpenRouter** launched video generation on **Apr 15, 2026**. It uses an async `POST /api/v1/videos` → job id → poll → download flow. Day-one models were Seedance 2.0/1.5, Veo 3.1, Wan 2.7/2.6 and Sora 2 Pro. Per-model settings (duration, aspect) still differ, and some model pages are labeled alpha — [OpenRouter announcement](https://openrouter.ai/blog/announcements/video-generation/); [OpenRouter Veo 3.1 page](https://openrouter.ai/google/veo-3.1/api)
- Poe documents an "OpenAI Videos API" for external apps — [Poe creator docs](https://creator.poe.com/docs/external-applications/videos-api) (title only; content not verified). Azure Foundry also documents Sora video generation — [Microsoft Learn](https://learn.microsoft.com/en-my/Azure/foundry-classic/openai/concepts/video-generation)
- **LocalAI** does *not* use `/v1/videos`. Its video route is `POST /video`, with JSON fields `seconds`, `size` and `input_reference`. Backends include diffusers, stablediffusion, vllm-omni and longcat-video — [LocalAI video docs](https://localai.io/features/video-generation/)

**ComfyUI (local) and Comfy Cloud**
- Local OSS ComfyUI: `POST /prompt` (workflow graph JSON) returns a prompt_id. The official example waits on the WebSocket (`/ws`), then fetches outputs via `GET /history/{prompt_id}` and `/view` — [docs.comfy.org API examples](https://docs.comfy.org/development/comfyui-server/api-examples.md); [runflow guide](https://www.runflow.io/blog/comfyui-api-endpoints)
- **Comfy Cloud API** (labeled experimental):
  - Base `https://cloud.comfy.org`, with an `X-API-Key` header
  - `POST /api/prompt` with `{prompt: <workflow>}`
  - `GET /api/job/{id}/status` → pending | in_progress | completed | failed | cancelled
  - `GET /api/jobs/{id}` for full details and outputs
  - `GET /api/queue`
  - `/api/view` returns a 302 to a short-lived signed URL
  - `wss://cloud.comfy.org/ws?clientId=…&token=…`
  - The OpenAPI spec says it "implements the same API interfaces as OSS ComfyUI"
  - API usage draws from the same monthly credits as the UI. Tier availability conflicts (Creator/Pro vs Standard/Creator/Pro)
  - Sources: [Comfy Cloud overview](https://docs.comfy.org/development/cloud/overview); [Cloud API reference](https://docs.comfy.org/api-reference/cloud/overview)
- ComfyUI is the day-one runtime for new open models:
  - MiniMax H3: native support the same day as the weights (Aug 3, 2026) — [Atlas Cloud](https://www.test.atlascloud.ai/blog/tips/minimax-h3-open-source-weights)
  - LTX-2.5: official ComfyUI templates on day one — [ComfyUI Wiki](https://comfyui-wiki.com/en/news/2026-08-11-ltx-2-5-open-weights-release)
  - HunyuanVideo 1.5: native support — [ComfyUI blog](https://blog.comfy.org/p/hunyuanvideo-15-native-support)

**Other local runtimes**
- **Wan2GP** (deepbeepmeep): web UI with a built-in queuing system, aimed at low-VRAM GPUs. No OpenAI-style API is documented. A community FastAPI wrapper and an "agentic skill" add an HTTP API with queue monitoring and MP4 download — [mcpservers.org Wan2GP API Server](https://mcpservers.org/id/servers/magicmars35/wan2gp_agentic_skill); [HF mirror README](https://huggingface.co/vidfom/wan2gp/blob/main/README.md)
- **Diffusers** (huggingface/diffusers, **34,687** stars) is the common library layer for image, video and audio pipelines (Wan, Kandinsky 5, LTX-2.5 Diffusers checkpoints) — [GitHub](https://github.com/huggingface/diffusers); [HF Kandinsky5 diffusers docs](https://huggingface.co/docs/diffusers/main/en/api/pipelines/kandinsky5.md)
- **LTX-Desktop** is Lightricks' own open-source local app — [GitHub](https://github.com/Lightricks/LTX-Desktop); [ltx.io blog](https://ltx.io/blog/how-to-set-up-ltx-desktop)

### Inferences
- videogen's existing "OpenAI-compatible" adapter targets the right convergence point. With OpenAI's own endpoint gone, the shape is now governed de facto by vLLM-Omni, SGLang, LiteLLM and OpenRouter, not by OpenAI. The adapter should tolerate:
  - multipart vs JSON bodies
  - `size`/`seconds` vs `width`/`height`/`num_frames`/`fps`
  - nested extension objects (`nvext`)
  - optional `/sync` endpoints
  - OpenRouter's `/api/v1/videos` prefix
- Small config knobs could let one adapter cover vLLM-Omni, SGLang, Dynamo, LiteLLM-proxied models, OpenRouter and possibly LocalAI (via path override): base path, body encoding, and a field map for extension params.
- A **ComfyUI adapter** is the higher-leverage local integration. Every new open model lands there first, and the same client code would also reach Comfy Cloud (identical API shape, different auth header). The cost is that ComfyUI is workflow-graph based: the adapter needs a workflow-template-plus-parameter-injection layer rather than a simple prompt/size request.
- The "remix" endpoint from OpenAI's shape is not widely replicated by the open servers found (only LiteLLM documents it), so remix is not a safe common denominator.

### Gaps
- The full vLLM-Omni and SGLang parameter tables (seed, negative_prompt, guidance) and exact status enums could not be read, because the docs domains were blocked. Both sources are search extracts.
- Whether vLLM-Omni or SGLang currently serve LTX-2.5, MiniMax H3 or MAGI-2 was not confirmed. A vLLM recipe exists for H3, and SGLang MAGI-2 is a pending PR.
- No evidence was found of any formal standardization effort for a video generation API (e.g., an OpenAPI working group). Convergence appears to be emergent only.
- ComfyUI "Partner API Nodes" details (pricing, which closed models are callable from ComfyUI graphs) were not researched in this pass.

---

## Q3. How do AI agents (Claude, ChatGPT/Codex, Gemini, Cursor) generate video via MCP servers, skills and tools, and how popular are those integrations?

### Takeaway
No major agent platform ships native video generation:
- Claude: no native video generation.
- ChatGPT: the Sora app is gone.
- Gemini CLI: no built-in video.

Video reaches agents through **vendor-hosted remote MCP servers** and community servers or skills. The vendor-hosted ones are:
- **Runway** hosted MCP (May 27, 2026; works in Claude, ChatGPT, Cursor and Replit; billed to the Runway plan)
- **fal** hosted MCP at mcp.fal.ai (1,000+ models, with price-check and schema tools)

Vendors are archiving their early local MCP repos in favor of hosted endpoints (Runway, ElevenLabs). Popularity is modest: the most-starred dedicated video MCP is MiniMax-MCP at ~1.6k stars. The dominant technical pain point is **tool-call timeouts** (~60 s in ChatGPT, Codex and Claude Desktop), which pushes everyone to a **submit-job + poll-status** tool pattern. MCP's experimental **Tasks** primitive (spec 2025-11-25) is the protocol-level answer.

### Cited Findings

**Vendor / official servers (GitHub stars as of 2026-10-08)**
- **MiniMax-AI/MiniMax-MCP**, official (TTS, image, video): **1,582** stars, created Apr 10, 2025, updated Oct 4, 2026 — [GitHub](https://github.com/MiniMax-AI/MiniMax-MCP). MiniMax-MCP-JS: **130** — [GitHub](https://github.com/MiniMax-AI/MiniMax-MCP-JS)
- **elevenlabs/elevenlabs-mcp**, official (audio): **1,536** stars, now **archived** — [GitHub](https://github.com/elevenlabs/elevenlabs-mcp)
- **Runway**:
  - The local repo runwayml/runway-api-mcp-server has **23** stars and is **archived** — [GitHub](https://github.com/runwayml/runway-api-mcp-server)
  - The **hosted Runway MCP** launched **May 27, 2026** for Claude, Cursor, ChatGPT and Replit. It is added as a custom connector with Runway account auth and needs no separate API key. Generations are billed to the Runway plan
  - It exposes Gen-4.5 plus third-party models (Kling 3.0, Veo 3.1, Seedance 2.x, GPT Image 2, Nano Banana Pro). Clips run 2–10 s, up to 30 s on Seedance 2.5
  - It does no scripting, captions or publishing
  - Sources: [Runway news](https://runwayml.com/news/mcp); [aiweekly](https://aiweekly.co/alerts/runway-opens-mcp-server-for-chatgpt-claude-cursor-replit); [mcp.directory guide](https://mcp.directory/blog/runway-mcp-complete-guide-2026)
  - A Runway plugin for Cursor, Grok Bot and Grok Build using the hosted MCP was created Sep 11, 2026 — [GitHub runway-mcp-plugin](https://github.com/runwayml/runway-mcp-plugin)
- **fal** hosted MCP:
  - Endpoint `https://mcp.fal.ai/mcp`, with a Bearer FAL_KEY sent per request and never stored. It reaches 1,000+ models, has search by category (text-to-video, image-to-video), a schema tool, cost checking before running, and long-job submission and uploads. Nine tools in total. No extra rate limits beyond the API's
  - Claude Code setup: `claude mcp add --transport http fal-ai https://mcp.fal.ai/mcp --header "Authorization: Bearer $FAL_KEY"`
  - Sources: [fal MCP docs](https://fal.ai/docs/model-apis/mcp); [fal blog](https://blog.fal.ai/connect-your-ai-to-1-000-models-with-the-fal-mcp-server)
- **lumalabs/luma-api-mcp** (Ray video / Photon image): **26** stars — [GitHub](https://github.com/lumalabs/luma-api-mcp)
- **PixVerseAI/PixVerse-MCP**, official: **52** stars — [GitHub](https://github.com/PixVerseAI/PixVerse-MCP)
- **Replicate**: only replicate/replicate-mcp-code-mode (**4** stars) surfaced on GitHub — [GitHub](https://github.com/replicate/replicate-mcp-code-mode). Its official MCP was not verified (see Gaps)
- **Comfy-Org/comfy-mcp**, official local ComfyUI MCP:
  - **261** stars, created Jul 1, 2026
  - Local-GPU support was announced **Aug 11, 2026**, highlighting hardware checks, model recommendations and running LTX and MiniMax H3 locally
  - It wraps comfy-cli. Tools: generate from workflow JSON or text, monitor and cancel jobs, search installed nodes and models, validate and edit graphs, launch and stop ComfyUI
  - PyPI comfy-mcp v0.10.0
  - Comfy's own docs still call it private test / proof-of-concept, which conflicts with third-party "public beta" claims. Before this, Comfy MCP was cloud-only (late June 2026)
  - Sources: [GitHub](https://github.com/Comfy-Org/comfy-mcp); [docs.comfy.org agent-tools/local](https://docs.comfy.org/agent-tools/local); [ComfyUI Wiki](https://comfyui-wiki.com/en/news/2026-08-11-comfy-mcp-local-server); [GIGAZINE](https://gigazine.net/gsc_news/en/20260630-comfy-mcp-comfyui-ai-agent/)

**Community servers and bridges (stars as of 2026-10-08)**
- ComfyUI bridges:
  - heshengtao/comfyui_LLM_party: **2,379** — [GitHub](https://github.com/heshengtao/comfyui_LLM_party)
  - jau123/MeiGen-AI-Design-MCP (GPT Image 2, Seedance, ComfyUI): **1,781** — [GitHub](https://github.com/jau123/MeiGen-AI-Design-MCP)
  - ATH-MaaS/Pixelle-MCP (ComfyUI + MCP + LLM): **1,125** — [GitHub](https://github.com/ATH-MaaS/Pixelle-MCP)
  - artokun/comfyui-mcp ("178 tools, 36 AI skills", local, LAN, VPS or Comfy Cloud): **795**; reportedly being archived on 2026-10-09 in favor of official tooling — [GitHub](https://github.com/artokun/comfyui-mcp); [ComfyUI Wiki](https://comfyui-wiki.com/en/news/2026-08-11-comfy-mcp-local-server)
  - HuangYuChuh/ComfyUI_Skills_OpenClaw: **411** — [GitHub](https://github.com/HuangYuChuh/ComfyUI_Skills_OpenClaw)
  - joenorton/comfyui-mcp-server: **408** — [GitHub](https://github.com/joenorton/comfyui-mcp-server)
  - comfy-pilot: **230** — [GitHub](https://github.com/ConstantineB6/comfy-pilot)
- Model-specific:
  - Doriandarko/sora-mcp: **209**; moot after the Sep 24 Sora API shutdown — [GitHub](https://github.com/Doriandarko/sora-mcp)
  - ffroliva/gflow-cli (unofficial Google Flow / Veo CLI + MCP): **264**, 67 open issues — [GitHub](https://github.com/ffroliva/gflow-cli)
  - 199-mcp/mcp-kling: **43** — [GitHub](https://github.com/199-mcp/mcp-kling)
  - mario-andreschak/mcp-veo2: **34** — [GitHub](https://github.com/mario-andreschak/mcp-veo2)
  - merterbak/Grok-MCP: **52** — [GitHub](https://github.com/merterbak/Grok-MCP)
  - Anil-matcha/Wan-3.0-API (SDK + MCP via MuAPI): **80** — [GitHub](https://github.com/Anil-matcha/Wan-3.0-API)
  - AceDataCloud/SeedanceMCP: **20** — [GitHub](https://github.com/AceDataCloud/SeedanceMCP)
- fal-based community servers (raveenb/fal-mcp-server, mohsenmousavieyeline/mcp-fal) default to MiniMax for video and note that jobs take "a few minutes" — [glama mcp-fal](https://glama.ai/mcp/servers/MohsenMousaviEyeline/MCP-Fal); [glama raveenb](https://glama.ai/mcp/servers/@raveenb/fal-mcp-server/blob/1bfc317cf094a50b741e7221bd588f0a8ac681b4/docs/index.md)
- GitHub search for "video generation mcp" returns **409** repositories (Oct 8, 2026) — [GitHub search](https://github.com/search?q=video+generation+mcp&type=repositories)

**Agent platform native features**
- **Claude**:
  - Anthropic has not announced native image or video generation (mid-2026 comparison) — [creativeainews](https://www.creativeainews.com/blog/claude-vs-chatgpt-vs-gemini-creative-work-2026/)
  - Claude's Connectors Directory launched Jul 2025. In Apr 2026 Anthropic added 9 creative-software connectors (Adobe, Blender, Autodesk, Resolume) on all plans; these are not generative video — [buildfastwithai](https://www.buildfastwithai.com/blogs/claude-connectors-creative-tools-2026); [pasqualepillitteri](https://www.pasqualepillitteri.it/en/news/1558/claude-adobe-creative-cloud-50-tools-single-prompt-2026)
  - Claude skill marketplaces list many third-party "video-generation" skills, e.g. bytedance/deer-flow, runcomfy-agent-skills, doany-ai — [claudemarketplaces](https://claudemarketplaces.com/skills/bytedance/deer-flow/video-generation); [claudemarketplaces runcomfy](https://claudemarketplaces.com/skills/agentspace-so/runcomfy-agent-skills/ai-video-generation)
- **Gemini CLI**:
  - Extensions launched Oct 2025 and package MCP servers plus context files — [InfoQ](https://www.infoq.com/news/2025/10/gemini-cli-extensions)
  - No built-in video generation. A Google "experimental" Veo MCP (genmedia) needs a GCP project and Vertex AI (vendor guide; unverified). Veo 3.1 has been in the Gemini API since Oct 2025 — [anycap](https://anycap.ai/page/en-US/blog/gemini-cli-image-video-guide); [Google Developers Blog](https://developers.googleblog.com/en/introducing-veo-3-1-and-new-creative-controls-in-the-gemini-api)
  - An example repo pairing Gemini CLI with genmedia MCP has only **19** stars — [GitHub](https://github.com/vladkol/gemini-cli-media-generation)
- **ChatGPT**: the consumer Sora app was discontinued Apr 26, 2026 — [zilliz](https://zilliz.com/ai-faq/what-is-the-sora-shutdown-timeline). Video in ChatGPT now comes through connectors such as Runway MCP — [Runway news](https://runwayml.com/news/mcp)

**Tool interface patterns and reported problems**
- **ChatGPT connectors**: a developer reports calls cut off at ~60 s with a 500 error while the backend was still working — [OpenAI community](https://community.openai.com/t/handling-timeouts-with-long-running-mcp-connectors-vertex-ai-agent/1369341)
- **Codex CLI**:
  - `tool_timeout_sec` defaults to 60 s — [OpenAI community](https://community.openai.com/t/responses-api-mcp-timeouts/1374557)
  - A Windows bug report describes MCP transport closing at ~90 s — [aident.ai](https://aident.ai/blog/fix-codex-mcp-transport-closed-aws-lc-90-seconds)
  - Codex CLI v0.152.0 (Sep 2026) added per-tool MCP output limits and app-server timeouts — [codex.danielvaughan.com](https://codex.danielvaughan.com/2026/09/01/codex-cli-v0152-stable-per-tool-mcp-output-limits-app-server-timeouts-compaction-fixes/)
- **Claude Code**:
  - Feature request for a configurable MCP_TOOL_TIMEOUT — [GitHub issue #47076](https://github.com/anthropics/claude-code/issues/47076)
  - The Desktop app cancels stdio MCP calls at ~60 s and ignores MCP_TOOL_TIMEOUT, while the CLI honors it — [claudeissues #63379](https://claudeissues.com/issue/63379-bug-desktop-app-cancels-stdio-mcp-tool-calls-at-60s-and-ignores-mcp-tool-timeout)
  - Remote MCP tools are aborted after 5 min of silence (override: CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT) — [claudeissues #70441](https://claudeissues.com/issue/70441-docs-mcp-docs-omit-remote-tool-idle-timeout-and-claude-code-mcp-tool-idle-timeou)
  - A v2.1.148 regression defaulted stdio tool calls to a 1 s timeout — [claudeissues #62121](https://claudeissues.com/issue/62121-bug-stdio-mcp-tool-calls-default-to-1-second-timeout-in-v2-1-148-long-running-to)
  - Synchronous calls lasting 10–12 min stop the session from responding — [claudeissues #58480](https://claudeissues.com/issue/58480-long-running-synchronous-mcp-tool-calls-10-12-min-trigger-session-stopped-respon)
- **Prevailing pattern: split into generate + check tools**
  - Artificial Studio's MCP returns a job id plus a wait hint, so no request lasts more than a few hundred ms — [Artificial Studio async polling](https://docs.artificialstudio.ai/mcp/async-polling)
  - A Veo 3.1 MCP uses start and get-job tools because Veo takes 60–120 s — [glama veo-mcp](https://glama.ai/mcp/servers/@Generative-AI-Strategy-B-V/veo-mcp/blob/0ef36fdce059b43ffe8b31ab39e8876212042716/VEO-MCP-COMPLETE.md)
- **Cost risk**: client timeouts followed by retries cause duplicate generations that "both will be billed". Recommended fixes are idempotency keys on the start tool and status reads kept separate from the start call — [GMI Cloud blog](https://www.gmicloud.ai/en/blog/long-running-operations-in-mcp-job-tracking-polling-and-idempotency)
- **MCP Tasks**: the 2025-11-25 spec revision introduced experimental "Tasks" (call now, fetch later). Webhooks are planned, so polling is the current mechanism — [modelcontextprotocol.net Tasks overview](https://modelcontextprotocol.net/extensions/tasks/overview.md); [WorkOS](https://workos.com/blog/mcp-async-tasks-ai-agent-workflows)

### Inferences
- Agent-side video generation is still a "connect a provider" story rather than a platform feature. That leaves room for a neutral, multi-provider, local-first MCP server, especially one that also fronts local GPUs, which the hosted Runway and fal servers cannot do.
- Async job semantics are effectively mandatory for any videogen MCP: `submit` returns a job id immediately, `status`/`wait` is short-poll or bounded, and `fetch` returns a local file path. A blocking "generate" tool will hit the ~60 s ceilings in ChatGPT, Codex and Claude Desktop. videogen's crash-safe queue maps naturally onto this, and onto MCP Tasks if and when it stabilizes.
- **Pre-flight cost estimate plus hard budget caps plus idempotency keys** are differentiators. fal exposes price checking, and the community explicitly flags duplicate billing on retries as a failure mode.
- Popularity signal: dedicated video MCP servers stay in the tens to low thousands of stars. The high-star projects are end-to-end agentic *production* systems (see Q4). This suggests MCP alone is a feature, not a product.

### Gaps
- Replicate's official remote MCP (mcp.replicate.com) and Google's official genmedia/Veo MCP were not verified via primary sources.
- Kling has no official MCP found; Kling is reachable via Krea, Runway hosted MCP, fal and community servers.
- Usage metrics for hosted MCPs (Runway, fal) are not public, so popularity can only be proxied by GitHub stars.
- No primary data on Cursor- or Codex-specific video features beyond the timeout configuration.
- Current status of the MCP Tasks primitive in major clients (whether Claude Code, Codex and Cursor implement it as of Oct 2026) was not verified.

---

## Q4. Is there demand for a local "render queue" that agents can submit to (headless API / CLI / MCP with budget guards)? Do open-source projects already do this?

### Takeaway
There is strong, recent evidence of demand for **agent-driven video production**, and several direct analogs to videogen-with-MCP already exist:
- OpenMontage: 65k stars, created Mar 2026
- hypit: 20k stars, created Jul 2026
- Toonflow: 16.6k stars, with MCP

The direct analogs:
- **vibeframe**: "on your own keys, behind a hard cost cap. CLI + MCP"
- **ima2-gen**: local-first runtime for people and coding agents
- **Nomi**: local-first workbench with ComfyUI, driven by Claude Code, Codex or Cursor over MCP
- **mold**: local GPU CLI with REST/SSE and MCP
- **clipmivo-tools** and **mediagen**: CLI + MCP + skill

Most are 2026-vintage, small (50–900 stars), and focused on cloud APIs. Few combine a crash-safe local GPU queue, budget guards, and multi-provider BYOK. The niche is real but contested.

### Cited Findings

**High-star agentic video production projects** (stars as of 2026-10-08)
- **calesthio/OpenMontage**: **65,110** stars, created Mar 29, 2026. "World's first open-source, agentic video production system… Turn your AI coding assistant into a full video production studio" — [GitHub](https://github.com/calesthio/OpenMontage)
- **hypit-ai/hypit**: **20,110** stars, created Jul 29, 2026. Clones viral videos with AI agents and can "ship 100 variants in one command" — [GitHub](https://github.com/hypit-ai/hypit)
- **HBAI-Ltd/Toonflow-app**: **16,643** stars, created Jan 29, 2026. Open-source AI creation platform with local deployment and MCP/plugin extensibility — [GitHub](https://github.com/HBAI-Ltd/Toonflow-app)
- **HKUDS/ViMax** (agentic video generation): **12,568** — [GitHub](https://github.com/HKUDS/ViMax)
- **dramaclaw/dramaclaw** (AIGC video engine, self-hosted): **6,731** — [GitHub](https://github.com/dramaclaw/dramaclaw)
- **Forget-C/Jellyfish** (short-drama production): **6,621** — [GitHub](https://github.com/Forget-C/Jellyfish)
- **ArcReel/ArcReel**: **5,354**. Self-hosted agent video workspace built on the Claude Agent SDK, with "multi-provider and cost tracking" — [GitHub](https://github.com/ArcReel/ArcReel)
- **wide-trace/open-higgsfield**: **4,086**, created Aug 26, 2026 — [GitHub](https://github.com/wide-trace/open-higgsfield)
- **Anil-matcha/Open-Generative-AI**: **29,822** (multi-model studio via MuAPI) — [GitHub](https://github.com/Anil-matcha/Open-Generative-AI)

**Direct analogs: local-first, agent-addressable generation runtimes** (stars as of 2026-10-08)
- **lidge-ai/ima2-gen**: **865**, created Apr 21, 2026. "Local-first visual generation runtime and studio for people and coding agents, with reproducible image and video workflows across multiple providers" (MCP) — [GitHub](https://github.com/lidge-ai/ima2-gen)
- **aqm857886159/Nomi**: **550**, created May 4, 2026. "Open-source AI video workbench. Bring any model or your local ComfyUI, and let Claude Code / Codex / Cursor direct it over MCP… Local-first… No account, no telemetry" (BYOK) — [GitHub](https://github.com/aqm857886159/Nomi)
- **vericontext/vibeframe**: **174**, created Feb 1, 2026. "Frontier AI video generation for coding agents — Seedance, Runway, Veo, Kling on your own keys, **behind a hard cost cap. CLI + MCP**" — [GitHub](https://github.com/vericontext/vibeframe)
- **utensils/mold**: **52**, created Mar 12, 2026. "CLI-native local AI image and video generation for people, scripts, and agents — CUDA on Linux, Metal on macOS… REST/SSE, and MCP" — [GitHub](https://github.com/utensils/mold)
- **BarneyD66/clipmivo-tools**: **142**, created Sep 14, 2026. "REST API, CLI, local MCP server and Agent Skill" — [GitHub](https://github.com/BarneyD66/clipmivo-tools)
- **Cripacx/mediagen**: **52**, created Aug 22, 2026. Gemini, OpenAI and Kie AI "behind one CLI and MCP server", plus EU AI Act content marking — [GitHub](https://github.com/Cripacx/mediagen)
- **Tenney95/AI-Canvas-tauri**: **207**. Local-first canvas with ComfyUI, MCP and RunningHub — [GitHub](https://github.com/Tenney95/AI-Canvas-tauri)
- **ffroliva/gflow-cli**: **264**. "Scripted, batched and pipeline-ready… Ships an MCP server so coding agents can drive it" — [GitHub](https://github.com/ffroliva/gflow-cli)
- **DojoCodingLabs/remotion-superpowers** (Claude Code plugin: 5 MCP servers, 13 commands): **130** — [GitHub](https://github.com/DojoCodingLabs/remotion-superpowers)
- On the local-runtime side, **Wan2GP** has a built-in queuing system, and a community "agentic skill" / FastAPI wrapper adds an API with a queue monitor — [mcpservers.org](https://mcpservers.org/id/servers/magicmars35/wan2gp_agentic_skill). The official Comfy MCP exposes "monitor and cancel jobs" tools against the local ComfyUI queue — [ComfyUI Wiki](https://comfyui-wiki.com/en/news/2026-08-11-comfy-mcp-local-server)

**Budget and cost-control signals**
- fal's hosted MCP explicitly offers "check costs before running" — [fal MCP docs](https://fal.ai/docs/model-apis/mcp)
- vibeframe's headline differentiator is a "hard cost cap" — [GitHub](https://github.com/vericontext/vibeframe)
- ArcReel advertises cost tracking — [GitHub](https://github.com/ArcReel/ArcReel)
- Duplicate billing from agent retries is a documented failure mode — [GMI Cloud](https://www.gmicloud.ai/en/blog/long-running-operations-in-mcp-job-tracking-polling-and-idempotency)

### Inferences
- Demand for "let my coding agent make videos" is evidenced by star velocity: OpenMontage reached 65k in ~6 months, and hypit 20k in ~10 weeks. The *thin-layer* niche videogen would occupy (a queue, CLI and MCP over BYOK plus local GPUs) is crowded with small 2026 projects. None appears dominant.
- videogen's potential differentiators relative to these analogs:
  1. A crash-safe persistent queue that survives agent and session disconnects (most analogs are cloud-API wrappers)
  2. Both cloud BYOK and local GPU backends (ComfyUI and /v1/videos) behind one queue
  3. Budget guards with pre-flight cost estimates and idempotent submits
  4. Zero-dependency Node.js, which is easy to `npx` as a stdio MCP server
- Comfy-Org shipping an official local MCP (Aug 2026), and the largest community ComfyUI MCP archiving itself, mean videogen should probably *consume* ComfyUI (as a backend) rather than compete as a ComfyUI controller.
- Risk: hosted multi-provider MCPs (fal, Runway) already cover cloud generation for agents with zero install. The local-GPU plus queue plus budget angle is where a local tool adds value they cannot.

### Gaps
- No Reddit or forum threads were retrieved that directly ask for a local agent-submittable render queue. Demand evidence is indirect (GitHub stars and repo positioning).
- Feature depth of the analogs was not verified beyond their repo descriptions: whether vibeframe's cost cap is pre-flight or post-hoc, and whether ima2-gen or Nomi persist queues across crashes.
- Star counts can be inflated (e.g., OpenMontage's 65k in 6 months is unusually fast). No download or usage metrics were checked.
