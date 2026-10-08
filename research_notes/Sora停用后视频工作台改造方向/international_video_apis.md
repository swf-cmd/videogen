# International (non-Chinese) Closed-Source Video Generation APIs as Sora 2 Replacements (state as of 2026-10-08)

> Method note: this environment's egress proxy blocked direct fetches of almost every vendor domain (ai.google.dev, docs.dev.runwayml.com, docs.x.ai, lumalabs.ai, aws.amazon.com, developer.adobe.com, artificialanalysis.ai, arena.ai all returned DNS failure/403). Three primary sources were read in full: (1) the Google Cloud generative-AI pricing page (cloud.google.com, fetched 2026-10-08; it now redirects from `/vertex-ai/` to `/gemini-enterprise-agent-platform/`, i.e. Vertex AI has been renamed "Gemini Enterprise Agent Platform"); (2) Google's official `google-gemini/gemini-skills` GitHub repo (Gemini Omni Flash skill + its `generate_video.py`, and the `gemini-api-dev` skill); (3) nothing else. Everything else comes from search-engine summaries of the cited pages (official pages where possible, otherwise third-party blogs, many written by competing resellers). Figures "as reported" may be stale; items older than ~3 months (before ~2026-07-08) or predating the 2026-09-24 Sora shutdown are flagged. Re-check live pricing pages before budgeting.

## Q1. Which providers/models exist now, and what can each do (duration, resolution, audio, T2V, I2V first frame, first+last frame, references, extension)?

### Takeaway
The landscape shifted sharply in mid-2026: Google replaced the Veo line with **Gemini Omni (gemini-omni-1.1-flash)**, and the Gemini-API Veo 3.1 previews shut down on 2026-10-22 (Veo survives only on Vertex/"Agent Platform"). Amazon Nova Reel reached end-of-life on 2026-09-30, Azure's last Sora build retires 2026-10-15, and OpenAI has named no successor. The credible self-serve, API-key options for a BYOK tool are **Google Gemini API (Omni 1.1 Flash)**, **xAI Grok Imagine Video 1.5**, **Runway API (Gen-4.5, Aleph 2.0)**, **Luma Agents API (Ray 3.2)**, **Black Forest Labs FLUX 3 Video** (new, Aug 2026), **Lightricks LTX API (LTX-2.5/2.3)** and **Pika API (Pika 2.5)**. Adobe Firefly is enterprise-contract only, Midjourney has no official API, and Moonvalley's direct API status is doubtful.

### Cited Findings

**Google — Gemini Omni Flash (new flagship; Gemini API + Vertex/Agent Platform)**
- Google's official skill describes `gemini-omni-1.1-flash` as doing text-to-video, first-frame-to-video, first+last-frame transitions ("`--last-frame` must be used with `--first-frame`"), video extensions "by up to 10 seconds per turn, up to a total length of 40 seconds", video editing (max 10 s input), and image- and video-referenced generation. — [google-gemini/gemini-skills: gemini-omni-flash-api SKILL.md](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-omni-flash-api/SKILL.md)
- Output options: `--aspect-ratio` 16:9 or 9:16; `--resolution` 360p (640x360), 720p (default, 1280x720), 1080p (1920x1080), 4k (3840x2160); `--duration` "any integer between 3 and 10 seconds". The skill says Omni "natively supports four output resolutions". Some third-party guides describe 1080p/4K as upscaled. — [Omni SKILL.md](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-omni-flash-api/SKILL.md); upscaling claim from [eesel.ai](https://www.eesel.ai/blog/gemini-omni-1-1-flash-pricing) (conflicting, unverified)
- Native audio: audio is generated with the video. When editing, the original audio is kept unless the uploaded video's audio stream is stripped. — [Omni SKILL.md](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-omni-flash-api/SKILL.md)
- References: image refs via `<IMAGE_REF_N>` tags, video refs via `<VIDEO_REF_N>` ("Up to 3 reference videos is ideal", ~3 s each). The official example uses 6 reference images. A reseller says "up to 10 reference images and 3 reference video clips". — [Omni SKILL.md](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-omni-flash-api/SKILL.md); [Atlas Cloud listing](https://www.atlascloud.ai/models/gemini-omni) (third-party)
- Behaviour note: "By default Gemini Omni Flash will try to create a video with a few different shots". Single-scene output must be requested in the prompt ("No scene cuts"). — [Omni SKILL.md](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-omni-flash-api/SKILL.md)
- Google's own `gemini-api-dev` skill lists `gemini-omni-1.1-flash` as the *only* current video-generation model. No Veo model appears in its "current models" list. — [gemini-api-dev SKILL.md](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-api-dev/SKILL.md)
- Timeline (third-party, partially conflicting): Omni was announced at Google I/O on 2026-05-19 ([Lushbinary](https://lushbinary.com/blog/gemini-omni-developer-guide-video-generation-editing-api/)). The API public preview (`gemini-omni-flash-preview`) opened on 2026-06-30 ([ChatForest](https://chatforest.com/builders-log/gemini-omni-flash-api-public-preview-june-30-interactions-builder-guide/)). The stable `gemini-omni-1.1-flash` reportedly went live on 2026-08-27, with the preview ID shutting down on 2026-09-30 ([Evolink](https://evolink.ai/blog/gemini-omni-api-status); [Developers Digest](https://www.developersdigest.tech/blog/gemini-omni-1-1-flash-release-guide-2026)). Google Cloud docs list a separate Vertex ID, `gemini-omni-1.1-flash-preview` ([Agent Platform model page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/omni-1-1-flash)).
- Google's Gemini consumer page says "Gemini Omni will replace Veo in the Gemini app". — [gemini.google](https://gemini.google/overview/video-generation/)

**Google — Veo 3.1 / Fast / Lite (legacy line)**
- Gemini API deprecations table: `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview` and `veo-3.1-lite-generate-preview` have shutdown date **2026-10-22**, with `gemini-omni-1.1-flash` as the recommended replacement. Veo 3.0/2.0 Gemini-API models shut down on 2026-06-30. — [Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations) (via search summary). Developers are already migrating, e.g. [mulmocast-cli PR #1620](https://github.com/receptron/mulmocast-cli/pull/1620) and [vibeframe PR #346 "refuse Veo after its 2026-10-22 shutdown"](https://github.com/vericontext/vibeframe/pull/346). A Polish guide notes the date is "on or after", per Google's wording ([promptowy](https://promptowy.com/veo-3-1-wylaczane/)).
- On Vertex (Agent Platform), Veo continues. The GA models are `veo-3.1-generate-001` and `veo-3.1-fast-generate-001` (GA 2025-11-17). Vertex preview `veo-3.1-generate-preview` was discontinued on 2026-03-03. Veo 3.1 Lite entered public preview on Vertex on 2026-04-02. — [Vertex AI release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes)
- Vertex Veo 3.1 retirement date conflicts. One search summary says the GA model page lists retirement "November 17, 2026 or later". Another found no retirement date for `veo-3.1-generate-001` and attributed the November date to Vertex AI Extensions. — [Agent Platform Veo 3.1 page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate) (**unresolved; verify**)
- The Vertex pricing page (fetched 2026-10-08) still lists Veo 3.1, Veo 3.1 Fast, Veo 3.1 Lite, Veo 3, Veo 3 Fast and Veo 2, with "Video + Audio" and "Video" (silent) SKUs. 4K is listed for Veo 3.1 and 3.1 Fast but not Lite. — [Agent Platform pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
- Veo 3.1 specs (third-party, consistent with pre-2026 Google docs): 4/6/8-second clips; 720p/1080p/4K; native audio; up to 3 reference images (another source says 10, which conflicts); first+last frame; extension in 7 s steps from the last second, chainable up to 20 times. — [Rundown](https://www.therundown.ai/tools/veo-3); [Vertex reference-image docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/use-reference-images-to-guide-video-generation); [eachlabs schema](https://www.eachlabs.ai/google/veo3-1/veo3-1-extend-video) (third-party)
- Gemini API Veo extension works only on Veo 3.1 and 3.1 Fast, not Lite. — [Gemini API Veo guide](https://ai.google.dev/gemini-api/docs/veo) (via search)
- Vertex Veo 3.1 lists us-central1 as its only region. — [Agent Platform Veo 3.1 page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate) (via search)
- No "Veo 4" exists. An August 30, 2026 tracker found no Veo 4 announcement, and the Veo-4 slot went to the new "Gemini Omni" brand. Paid "Veo 4" sites are wrappers. — [Evolink Veo 4 tracker](https://evolink.ai/blog/veo-4-release-date-2026); [DEV Community](https://dev.to/tokenmixai/veo-4-doesnt-exist-yet-but-people-are-already-selling-it-3ch9)

**Runway API**
- Current API models: `gen4.5` (T2V + I2V, 2–10 s, available via API since 2026-02-10), `aleph2` / Aleph 2.0 (video-to-video editing, 2–30 s input, up to 5 keyframe images, added 2026-06-02) and `gen4_turbo` (I2V only). Gen-3 Alpha Turbo and Gen-4 Aleph were removed from the API on 2026-07-30. — [Runway models](https://docs.dev.runwayml.com/guides/models/); [Runway API changelog](https://docs.dev.runwayml.com/api-details/api_changelog/)
- Gen-4.5: 720p output, ratios 16:9, 9:16, 4:3, 1:1, 3:4, 21:9, 10 s max. "True HDR" renders (BT.2020/HDR10) are available. — [dev.runwayml.com](https://dev.runwayml.com/); [Runway docs](https://docs.dev.runwayml.com/)
- No native audio was found for Gen-4.5 or Aleph 2.0. Runway exposes separate TTS/SFX endpoints. Its catalog also resells third-party models with audio (e.g. MiniMax H3, Veo 3.1). — [Runway API search summary / dev catalog](https://dev.runwayml.com/models/catalog) (**partly unverified**)

**Luma AI — Agents API (Ray 3.2)**
- Ray 3.2 runs on the separate **Luma Agents API** (`https://agents.lumalabs.ai/v1`, `POST /v1/generations` with `model: "ray-3.2"`, `type: "video"`). Optional `video.start_frame` / `video.end_frame` anchors are supported, along with looping and HDR. — [Luma Agents quickstart](https://docs.agents.lumalabs.ai/); [Luma Agents FAQ](https://docs.agents.lumalabs.ai/guides/faq/); [Video generation guide](https://docs.agents.lumalabs.ai/guides/videos/generation)
- Product page: up to 16 keyframes; 360p/540p/720p (default)/1080p; 16-bit HDR with EXR export. — [lumalabs.ai/ray](https://lumalabs.ai/ray)
- Duration: 5 s or 10 s per hosted endpoints (loop only at 5 s SDR without end frame). — [fal Ray 3.2 schema](https://fal.ai/models/luma/agent/ray/v3.2/text-to-video/api) (aggregator, used only as a spec cross-check)
- Luma's AI-assistant info page says Dream Machine and Ray 2 are deprecated and Ray 3.2 is the current model. Ray 3.2 reportedly arrived in June 2026 via the new Agents API, and credits do not transfer between the old and new APIs. — [Luma llm-info](https://lumalabs.ai/llm-info); [Crazyrouter guide](https://crazyrouter.com/en/blog/luma-dream-machine-ray-2-api-guide-2026) (third-party)
- Native audio for Ray 3.2: **not confirmed** by any source found.

**xAI — Grok Imagine Video (branding now "SpaceXAI API")**
- Models: `grok-imagine-video-1.5` (GA, "out of preview"; T2V + I2V + reference-to-video; native 1080p for T2V/I2V, reference-to-video capped at 720p) and the older `grok-imagine-video` (480p/720p, accepts video input). A `grok-imagine-video-1.5-lite` also appears on the rate-limits page. — [xAI video generation docs](https://docs.x.ai/developers/model-capabilities/video/generation); [xAI news: Imagine Video 1.5](https://x.ai/news/grok-imagine-video-1-5); [xAI rate limits](https://docs.x.ai/developers/rate-limits)
- Audio is included with 1.5 at no extra charge. Only the base model accepts video input, which extension and reference-to-video need. — [ofox.ai](https://ofox.ai/blog/grok-imagine-video-api-pricing-by-resolution/); [dreampixelforge](https://www.dreampixelforge.com/blog/grok-imagine-api) (third-party)
- Extension is a separate endpoint, `/v1/videos/extensions`, which continues from the last frame. The official example uses `grok-imagine-video`, not 1.5. — [xAI video extension docs](https://docs.x.ai/developers/model-capabilities/video/extension)
- Duration: commonly 1–15 s. Aspect ratios include 1:1, 16:9, 9:16, 3:2, 2:3 (some list 4:3/3:4). First+last-frame interpolation is unclear (one listing says last_frame is ignored; xAI says first/last frames can be pinned in reference-to-video mode). — [Replicate listing](https://replicate.com/xai/grok-imagine-video); [xAI references news](https://x.ai/news/grok-imagine-video-1-5-references) (**conflicting**)
- xAI's pages now use the name "SpaceXAI API", and a gateway uses the model string `spacexai/grok-imagine-video-1.5`. — [x.ai/api](https://x.ai/api); [Vercel AI Gateway](https://vercel.com/ai-gateway/models/grok-imagine-video-1.5)

**Black Forest Labs — FLUX 3 Video (new significant entrant, Germany)**
- General API access opened on 2026-08-04 via BFL's own API (api.bfl.ai) and partners. Clips run 5–20 s with synchronized native audio at 720p/1080p across 7 ratios (21:9, 2:1, 16:9, 4:3, 1:1, 3:4, 9:16). I2V takes 1–10 ordered keyframes. Modes are t2v, i2v, v2v (continuation, 5–15 s) and draft. — [RuntimeWire](https://runtimewire.com/article/black-forest-labs-flux-3-video-api-native-audio); [mlq.ai](https://mlq.ai/news/black-forest-labs-opens-flux-3-video-api-for-20-second-full-hd-clips/); [CometAPI guide](https://www.cometapi.com/how-to-use-flux-3-api/) (third-party)
- The BFL pricing table lists QHD/UHD tiers, but a third-party guide says current video docs do not list 4K output (**conflict**). — [BFL pricing](https://docs.bfl.ml/quick_start/pricing); [CometAPI](https://www.cometapi.com/how-to-use-flux-3-api/)

**Lightricks — LTX API (hosted LTX-2.5 / LTX-2.3)**
- Current API tiers are LTX-2.5 Fast/Pro and LTX-2.3 Fast/Pro. `ltx-2-fast`/`ltx-2-pro` were removed after 2026-08-15. — [docs.ltx.io pricing](https://docs.ltx.io/pricing); [invideo LTX guide (Aug 2026)](https://invideo.io/blog/ltx-ai-video-generator/)
- ltx-2-5-pro per the docs table: 720p/1080p, 24/25/48/50 fps, 6/8/10 s (marketing claims 1440p/4K, which conflicts). Synchronized audio is generated in the same pass (per hosts). Retake, extend and audio-to-video modes exist. — [LTX-2.5 model page](https://docs.ltx.io/models/ltx-2-5); [ltx.io API page](https://ltx.io/model/api); [Segmind guide](https://blog.segmind.com/ltx-2-5-pro-and-fast-guide-features-examples-how-it-compares/) (third-party)

**Pika — Pika API (Pika 2.5)**
- Pika launched an "API Club" developer membership in early August 2026 (BusinessWire, 2026-08-04). Pika 2.5 T2V/I2V are exposed as async REST endpoints with MP4 output up to 1080p. Clips are 5 s in the official example (10 s per one page, which conflicts). — [Morningstar/BusinessWire](https://www.morningstar.com/news/business-wire/20260804953897/pika-cuts-ais-3x-markup-to-nearly-zero-with-a-10-a-month-membership); [dev.pika.art Pika 2.5 T2V](https://dev.pika.art/models/pika/pika-2.5/text-to-video)
- Earlier, Pika's API was "powered by fal". — [fal blog](https://blog.fal.ai/pika-api-is-now-powered-by-fal/) (older, pre-2026)

**Amazon Nova Reel (Bedrock) — effectively dead**
- The Bedrock model card marks Nova Reel as **Legacy, with end-of-life 2026-09-30**. Nova Reel and Canvas entered Legacy on 2026-03-30. A July 2026 Reuters/Business Insider report described Amazon winding down Nova Reel, Canvas, Premier and Omni. — [Bedrock Nova Reel model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-reel.html); [Tech Insider](https://tech-insider.org/au/amazon-nova-ai-models-deprecated-2026/); [Magica](https://magica.com/news/amazon-nova-model-strategy-overhaul)
- Historic specs: 720p, 24 fps, 6 s shots, multi-shot 12–120 s (v1.1). Async-only via StartAsyncInvoke with S3 output. — [AWS blog Nova Reel 1.1](https://aws.amazon.com/blogs/aws/amazon-nova-reel-1-1-featuring-up-to-2-minutes-multi-shot-videos/) (old, 2025)

**Adobe Firefly Video API — enterprise only**
- Firefly API v3.0.0 includes text-to-video ("Generate a five second video"), model version e.g. `video1_standard`, first/last-frame image guidance, camera/shot controls, and a 202 Accepted async response. Auth uses `X-Api-Key` + `AccessToken` (OAuth server-to-server). — [Firefly API reference](https://developer.adobe.com/firefly-services/docs/firefly-api/api/)
- Access is tied to Firefly Services enterprise contracts. Users on community forums request individual-plan API access. Billing is in "Operations"/shared credits via the Admin Console. — [Adobe community feature request](https://community.adobe.com/feature-requests-405/expose-firefly-generation-image-video-via-mcp-api-so-it-can-be-driven-from-claude-and-other-ai-agents-1637240); [sudomock pricing article](https://sudomock.com/blog/adobe-firefly-api-pricing-2026) (third-party)
- Output is up to 5 s at up to 1080p per generation. — [fluxnote review](https://fluxnote.io/guides/adobe-firefly-ai-video-generator-review) (third-party)

**Midjourney — no official public API**
- As of 2026-08-18 Midjourney had not released or announced an official public API. Access is via midjourney.com/Discord subscriptions. One outlier claims an enterprise-gated API since late 2025 (**unverified**). — [Unifically](https://unifically.com/blogs/midjourney-api); [tooldirectory](https://tooldirectory.ai/tools/midjourney)
- V8.1 (default since 2026-06-10) has native image-to-video extendable to ~21 s, and V8.2 shipped 2026-07-24. — [tooldirectory](https://tooldirectory.ai/tools/midjourney); [Wikipedia: Midjourney](https://en.wikipedia.org/wiki/Midjourney)
- Unofficial wrappers (APIFrame, PiAPI, ImaginePro, useapi.net) violate the ToS and risk account bans. — [Wireflow](https://www.wireflow.ai/blog/best-midjourney-api-tools-in-2026)

**Moonvalley Marey — direct API doubtful**
- ComfyUI's official docs say the Moonvalley API service "is no longer available" and that its nodes are deprecated (undated). SOTA2 lists "API Not available". Stork (2026) claims a public API. Marey endpoints are reachable via fal. — [ComfyUI Moonvalley docs](https://docs.comfy.org/tutorials/partner-nodes/moonvalley/moonvalley-video-generation); [SOTA2](https://www.sota2.com/products/moonvalley-marey); [Stork](https://www.stork.ai/en/moonvalley) (**conflicting**)
- Marey is trained only on licensed footage and targets filmmakers. It ranked #12 on the AA T2V arena at launch at a premium price. — [TechCrunch (2025-07)](https://techcrunch.com/2025/07/08/moonvalleys-ethical-ai-video-model-for-filmmakers-is-now-publicly-available/); [Artificial Analysis on X](https://x.com/ArtificialAnlys/status/1967696860669415834) (old)

**OpenAI / Microsoft — no successor**
- The OpenAI deprecations table's "recommended replacement" column for sora-2/sora-2-pro is empty. After 2026-09-24, `/videos` requests return 404 while `GET /v1/models` still listed sora-2 (bug report). — [Versely](https://www.versely.studio/blog/sora-openai-names-no-successor); [openclaw issue #158876](https://github.com/openclaw/openclaw/issues/158876); [Pondero](https://pondero.ai/news/2026-09-24-openai-sora-api-shutdown/)
- A reported "Spud" successor has no confirmed API access. — [MindStudio](https://www.mindstudio.ai/blog/openai-shutting-down-sora-what-happened) (unverified, conflicting dates)
- Azure AI Foundry: the last build, `sora-2 2025-12-08`, has inference retirement 2026-10-15, and no replacement video model is hosted in Foundry. — [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5881436/azure-ai-foundry-sora-2-retirement-date-feels-too); [foundryR issue #15](https://github.com/farach/foundryR/issues/15); [AI4IA PR #506](https://github.com/ian-t-adams/AI4IA/pull/506)

**Other**
- Meta "Muse Video" has only a preview, with no API as of late September 2026. Meta's Model API supports video understanding only. — [Kingy AI](https://kingy.ai/news/muse-video-preview-meta-ai-native-audio/); [OrcaRouter](https://www.orcarouter.ai/blog/muse-video)
- Stability AI's hosted video API is still the 2-second Stable Video Diffusion (old). — [Stability AI](https://stability.ai/news/introducing-stable-video-diffusion-api)

### Inferences
- For a BYOK desktop tool whose users hold a plain API key, after 2026-10-22 Google's only option via simple API key is **Omni 1.1 Flash**. Veo 3.1 (including the cheap Lite tier) remains only behind Vertex/Agent Platform, which requires a GCP project and OAuth/service-account auth (see Q3). A "Veo" backend therefore means a Vertex backend.
- Feature parity with Sora 2 (T2V, first-frame I2V, 16:9/9:16, audio, ~4–12 s): Omni 1.1 Flash, Grok Imagine 1.5, FLUX 3 Video and LTX-2.5 all match or exceed it, with native audio. Runway Gen-4.5 lacks native audio. Luma Ray 3.2's audio status is unknown.
- Providers with first+last-frame support (a likely new feature for the app): Omni, Veo 3.1, Luma Ray 3.2 (start/end + up to 16 keyframes), FLUX 3 (1–10 keyframes), Adobe Firefly. Runway Gen-4.5 and Grok 1.5 are unclear.

### Gaps
- Could not open the official Omni docs page (ai.google.dev/gemini-api/docs/omni) to confirm a max-reference-image count or person-generation parameters.
- Could not confirm whether Ray 3.2 or Pika 2.5 generate native audio, nor Runway Gen-4.5's exact durations beyond "2–10 s".
- Exact Grok 1.5 duration and aspect-ratio tables come only from third parties.

## Q2. Price per second (by resolution), with sources/dates; free tiers

### Takeaway
At 720p with audio, the cheapest credible options are **Veo 3.1 Lite on Vertex ($0.05/s)**, **LTX-2.3 Fast ($0.03/s 720p)**, **Omni 1.1 Flash (~$0.10/s at 720p, ~$0.034/s at 360p draft)** and **Veo 3.1 Fast ($0.10/s)**. These are comparable to Sora 2's old $0.10/s standard price, but no one matches Sora's $0.05/s *batch* price on a flagship model. Premium tiers (Veo 3.1 Standard $0.40/s, Luma 1080p ~$0.24–0.36/s, FLUX 3 FHD $0.29/s, Grok 1080p $0.25/s) cost 2.5–4× Sora 2 standard. None of the Western APIs has a free API tier for video.

### Cited Findings
**Google (Vertex/Agent Platform pricing page, fetched 2026-10-08; prices "per 1 count", i.e. per output second)** — [Agent Platform pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
- Veo 3.1, video+audio: $0.40/s at 720p/1080p; $0.60/s at 4K. Video only: $0.20/s at 720p/1080p; $0.40/s at 4K.
- Veo 3.1 Fast, video+audio: $0.10/s (720p), $0.12/s (1080p), $0.30/s (4K). Video only: $0.08, $0.10, $0.25.
- Veo 3.1 Lite, video+audio: $0.05/s (720p), $0.08/s (1080p). Video only: $0.03, $0.05 (no 4K).
- Veo 3 / Veo 3 Fast mirror the 3.1 prices without 4K. Veo 2 is $0.50/s.
- **Gemini Omni Flash / Omni 1.1 Flash:** input $1.50/M tokens, text output (response and reasoning) $9.00/M, **video output $17.50/M tokens**. Output video "(with audio)" is charged at 1,931 tokens/s at 360p, 5,792 at 720p, 8,688 at 1080p and 17,376 at 4K. Inputs are 1,120 tokens per image and 5,792 tokens per input-video second. Only a single price tier is shown for Omni (no Flex/Batch row).
- The Gemini Developer API uses the same Veo per-second rates (3.1 $0.40/$0.60 4K; Fast $0.10/$0.12/$0.30; Lite $0.05/$0.08) and the same Omni token rates. — [Puter Gemini pricing (Sep 2026)](https://developer.puter.com/tutorials/gemini-api-pricing/); [eesel Omni pricing](https://www.eesel.ai/blog/gemini-omni-1-1-flash-pricing) (third-party quoting official). One reseller claims $0.75/s for Veo 3.1, an outlier that conflicts with Google's table.
- No free API tier: Omni API "production calls require paid access", and the free YouTube/Flow surfaces give no endpoint. Most sources say Veo also has no free API tier. — [Rundown Omni 1.1](https://www.therundown.ai/tools/gemini-omni-1-1-flash); [Atlas Cloud](https://www.atlascloud.ai/blog/tips/veo-3.1-ai-video-generator-free-or-paid)

**Runway API** (1 credit = $0.01; credits bought per project in the developer portal; consumer plans do not cover API usage; $10 minimum top-up before the first call)
- gen4.5 12 credits/s = **$0.12/s**; gen4_turbo 5 credits/s = $0.05/s; veo3.1 via Runway 40 credits/s with audio ($0.40) or 20 without; Aleph 2.0 $0.28/s. ProRes/HDR adds 5–40 credits/s. — [Runway API pricing](https://docs.dev.runwayml.com/guides/pricing/); [Apiframe guide](https://apiframe.ai/guides/runway-api-guide); [dev.runwayml.com](https://dev.runwayml.com/)

**Luma Agents API — Ray 3.2 (priced per clip, SDR, pay-as-you-go; "subject to change ahead of GA")** — [Luma Agents pricing](https://docs.agents.lumalabs.ai/guides/pricing/)
- 5 s: $0.06 (360p draft), $0.15 (540p), $0.30 (720p), $1.20 (1080p). 10 s: $0.90 (720p), $3.60 (1080p). Reframe is $0.12/s (720p) and $0.36/s (1080p). Video edit is $1.08 (720p) / $2.16 (1080p) per 5 s. HDR is reported as a 2–3× multiplier ([Rundown](https://www.therundown.ai/tools/ray-3-2), third-party).

**xAI Grok Imagine** — [xAI API pricing](https://docs.x.ai/developers/pricing); [x.ai/api](https://x.ai/api)
- `grok-imagine-video-1.5`: **$0.08/s (480p), $0.14/s (720p), $0.25/s (1080p)**, plus $0.01 per input image, with audio included. A tracker re-read xAI's pricing on 2026-10-07. — [ofox.ai](https://ofox.ai/blog/grok-imagine-video-api-pricing-by-resolution/)
- `grok-imagine-video` (base): $0.05/s (480p), $0.07/s (720p), plus $0.01/s for video input and $0.002/image.

**Black Forest Labs FLUX 3 Video (direct API)** — [BFL pricing](https://docs.bfl.ml/quick_start/pricing)
- t2v/i2v: **$0.17/s HD (720p), $0.29/s FHD (1080p)**, $0.40/s QHD, $0.80/s UHD; draft $0.06/s. v2v continuation: $0.41/s HD and $0.53/s FHD. Audio is included at no extra charge. Partial seconds round up ([daily.dev review](https://daily.dev/posts/flux-3-review-2026-black-forest-labs-multimodal-video-model-priced-per-second-axkbr9d2z), third-party).

**Lightricks LTX API (per second, prepaid; sources ~Aug 2026)** — [docs.ltx.io pricing](https://docs.ltx.io/pricing)
- LTX-2.5 Fast: $0.09 / $0.13 / $0.19 / $0.30 (720p / 1080p / 1440p / 4K). LTX-2.5 Pro: $0.12 / $0.17 / $0.25 / $0.39.
- LTX-2.3 Fast: $0.03 / $0.06 / $0.12 / $0.24. LTX-2.3 Pro: $0.04 / $0.08 / $0.16 / $0.32.
- Auto-duration jobs place a hold for the max length and release the remainder. The product FAQ numbers conflict with the docs; prefer the docs ([aireiter](https://aireiter.com/blog/ltx-2-5-api-pricing-guide)).

**Pika 2.5** — $0.04/s (720p) and $0.09/s (1080p), charged only on success, per a third-party guide. The API Club membership is $10/month with $10 of credit in the first month (third-party). — [pikaais.com](https://pikaais.com/api/) (**not confirmed on Pika's own pages**)

**Moonvalley Marey (via fal; no direct price sheet found)** — $1.50 per 5 s / $3.00 per 10 s (≈$0.30/s); AA put it at ~$18/minute. — [fal Marey T2V](https://fal.ai/models/moonvalley/marey/t2v); [Artificial Analysis on X](https://x.com/ArtificialAnlys/status/1967696860669415834)

**Amazon Nova Reel (EOL 2026-09-30)** — historically ~$0.08/s at 720p. — [Neowin (2025)](https://www.neowin.net/news/amazon-announces-nova-reel-11-which-allows-you-to-generate-videos-up-to-2-minutes-long/) (old)

**Adobe Firefly** — billed in Operations under Shared Credit terms via the Admin Console. No public per-second price. — [sudomock](https://sudomock.com/blog/adobe-firefly-api-pricing-2026)

**Sora 2 reference (now dead)** — $0.10/s at 720p standard, $0.05/s batch. Sora 2 Pro ranged from $0.30/s (720p) to $0.70/s (1080p), about half on batch. — search summary citing [OpenAI Batch guide](https://developers.openai.com/api/docs/guides/batch) and a third-party pricing article (exact page attribution uncertain; pre-shutdown pricing)

### Inferences
- Computed Omni 1.1 Flash cost per output second, from Google's token rates ($17.50/M): 360p ≈ $0.034; **720p ≈ $0.101**; 1080p ≈ $0.152; 4K ≈ $0.304. A 10 s 720p clip ≈ $1.01, and a 10 s 1080p clip ≈ $1.52. Excluded: any billed text/reasoning output tokens (charged at $9/M, magnitude unknown) and input tokens (negligible for a text prompt; 1,120 tokens ≈ $0.002 per first-frame image).
- Indicative cost of one 8 s 720p clip with audio: Veo 3.1 Lite $0.40 · Veo 3.1 Fast $0.80 · Omni $0.81 · Grok 1.5 $1.12 · FLUX 3 HD $1.36 · LTX-2.5 Fast $0.72 · LTX-2.3 Fast $0.24 · Veo 3.1 Standard $3.20 · Sora 2 standard (dead) $0.80 / batch $0.40. Silent options: Runway Gen-4.5 $0.96 · Luma Ray 3.2 10 s 720p $0.90.
- The 360p Omni "draft" tier (~$0.034/s) plus the Luma 360p draft ($0.06 per 5 s) and the FLUX 3 draft ($0.06/s) suggest a "draft cheaply, then re-render the winners" workflow, a possible replacement value proposition for the lost 50% batch discount.

### Gaps
- Could not verify whether Omni bills thinking/"reasoning" text tokens on video requests.
- Pika and Moonvalley prices are third-party only.
- Japanese yen/Korean won billing and tax treatment were not researched.

## Q3. API shape for a zero-dependency Node.js BYOK client (async/poll/webhook, result delivery and URL expiry, auth)

### Takeaway
Most providers use a simple **API key + async create → poll → download URL** pattern that a zero-dependency Node.js `fetch` client handles easily: xAI, Runway, Luma, BFL, LTX and Pika. **Gemini Omni is different.** It runs through the new **Interactions API**: Google's official sample makes one long *blocking* `interactions.create` call (default 600 s timeout), and input images/videos must first be uploaded via the **Files API**. The output arrives as a Files-API URI that must be downloaded with the API key. **Vertex Veo** needs OAuth/service-account bearer tokens, a project and a region (us-central1), and outputs to a GCS bucket or base64, so it is the least BYOK-friendly. Download promptly everywhere: result URLs are short-lived (BFL reportedly ~10 min, Runway 24–48 h).

### Cited Findings
**Google Gemini API — Omni via Interactions API**
- "All operations and state management for the Gemini Omni 1.1 Flash model … are handled via the Interactions API". "Input media files (such as reference images and videos) must be uploaded via the Files API first before being referenced"; the file URI + MIME type go into the `interactions.create` input parts. Auth is the `GEMINI_API_KEY` environment variable. — [Omni SKILL.md](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-omni-flash-api/SKILL.md)
- Google's reference script builds `response_format = {"type": "video", "delivery": "uri", "aspect_ratio", "duration", "resolution"}`. It calls `client.interactions.create(model, input, response_format[, previous_interaction_id])` synchronously, with HTTP timeout default "600 seconds (10 minutes)" (900–1200 s suggested for 4K or long extensions). It then reads `interaction.output_video.uri` and downloads via `client.files.download`. An empty output for a video-edit job "is likely due to" the regional restriction. — [generate_video.py](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-omni-flash-api/scripts/video/generate_video.py)
- Parallelism is client-side: the official script offers `--prompts-file prompts.txt --concurrency 3` and a `--batch jobs.json` thread pool. This is a local concurrency loop, not a server batch API. — [Omni SKILL.md](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-omni-flash-api/SKILL.md)
- Interactions are stored by default (paid tier retains them 55 days, free tier 1 day). `store=false` disables `previous_interaction_id` and `background=true`. — [gemini-api-dev SKILL.md](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-api-dev/SKILL.md)
- Some third-party guides show base64 inline video in the response, and the preview model ID `gemini-omni-flash-preview` differs from GA. — [Gemini Omni search summary: lushbinary/explainx](https://lushbinary.com/blog/gemini-omni-developer-guide-video-generation-editing-api/) (third-party, **conflicting**)

**Google Gemini API — Veo (until 2026-10-22)**: the `predictLongRunning` operation → poll the operation → download the file. Uses an API key. This path becomes moot after the shutdown. — [Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations)

**Google Vertex / Agent Platform — Veo**
- The official REST example uses a project+location endpoint with a gcloud/OAuth bearer access token, not an API key. Generation is a long-running operation that writes to a Cloud Storage bucket you name (`storageUri`); the bucket is optional. — [Vertex Veo text-to-video docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-text)
- A September 2026 developer PR reports that a Vertex **express-mode** API key worked for Veo when passed as a query string on the express host, with outputs as `bytesBase64Encoded` or `gcsUri`. This is a single unvetted report. — [EditForge PR #77](https://github.com/tdveal74-cell/EditForge/pull/77) (**unverified**)

**xAI**
- REST: `POST https://api.x.ai/v1/videos/generations` {model, prompt, duration, aspect_ratio, resolution[, image]} → `request_id`; poll `GET /v1/videos/{request_id}` until status is done; the result contains a video URL. Image input can be a public URL, a base64 data URI, or a Files-API `file_id`. — [xAI video generation docs](https://docs.x.ai/developers/model-capabilities/video/generation); [xAI image-to-video](https://docs.x.ai/developers/model-capabilities/video/image-to-video)
- Moderation is surfaced via a `respect_moderation` flag, so a "completed" job may have no URL. — [vercel/ai issue #12829](https://github.com/vercel/ai/issues/12829)

**Runway**
- Tasks are async: create → poll until SUCCEEDED / FAILED / CANCELED. The SDKs include a `waitForTaskOutput` helper. A third-party guide says not to poll faster than every 5 s. — [Runway SDKs](https://docs.dev.runwayml.com/api-details/sdks/); [Runway API docs](https://docs.dev.runwayml.com/)
- Output URLs are temporary CloudFront links with a `_jwt` parameter and "expire within 24-48 hours". Don't expose them to end users; download them. The page is old (~2 years). — [Runway output formats](https://docs.dev.runwayml.com/assets/outputs/)
- Over-limit submissions get status `THROTTLED` and are queued server-side in roughly submission order. — [Runway usage tiers](https://docs.dev.runwayml.com/usage/tiers/)
- Auth (background knowledge, not re-verified this session): `Authorization: Bearer <key>` plus an `X-Runway-Version` header.

**Luma Agents API**
- Base URL `https://agents.lumalabs.ai/v1`, `Authorization: Bearer`. `POST /v1/generations` → poll `GET /v1/generations/{id}` until completed/failed → download from a presigned URL. No webhook/`callback_url` was found in the Agents API docs; the old Dream Machine API had callbacks. There is no sandbox environment. — [Luma Agents quickstart](https://docs.agents.lumalabs.ai/); [Luma FAQ](https://docs.agents.lumalabs.ai/guides/faq/)

**Black Forest Labs**
- `POST` to the flux-3-video endpoint on api.bfl.ai with header `x-key` and JSON {mode: "t2v"…, prompt}. The response includes a `polling_url`, which you must poll (statuses Ready/Error/Failed). A third-party guide says the result URL expires in 10 minutes. — [BFL quick start](https://docs.bfl.ai/quick_start/get_started); [BFL integration guide](https://docs.bfl.ai/api_integration/integration_guidelines); [CometAPI](https://www.cometapi.com/how-to-use-flux-3-api/)

**LTX**
- v2 async flow: `POST https://api.ltx.io/v2/text-to-video` → job id; poll status (wait ≥5 s between checks) → video URL. Keys come from the Developer Console. `duration` is required (null = auto). The **V1 synchronous MP4-in-body endpoints stop after 2026-10-26 23:59 UTC**. — [LTX quickstart](https://docs.ltx.io/quickstart); [LTX API changelog](https://docs.ltx.io/api-changelog)

**Pika**
- Plain JSON over HTTPS, `X-API-Key` header; submit returns a queued job → poll to completed/failed → download URL. I2V needs an image URL, and local files go through an upload step. — [dev.pika.art](https://dev.pika.art/models/pika/pika-2.5/text-to-video)

**Amazon Nova Reel** — async only (StartAsyncInvoke → GetAsyncInvoke) with S3 output and AWS SigV4 auth. Now EOL. — [Bedrock API compatibility](https://docs.aws.amazon.com/bedrock/latest/userguide/models-api-compatibility.html)

**Adobe Firefly** — `X-Api-Key` + OAuth server-to-server `AccessToken`; 202 Accepted async. — [Firefly API reference](https://developer.adobe.com/firefly-services/docs/firefly-api/api/)

### Inferences
- Simplest ports of the existing "create → poll → download MP4" loop: xAI (closest to OpenAI's `/videos` shape), Runway, Luma, LTX, BFL and Pika. All use a single static key in a header.
- Omni can be supported without the SDK, but the client must implement: (a) a Files-API upload for first-frame/reference images, which changes the app's current inline-image handling; (b) one long-held HTTP request per job, or the Interactions `background` mode (unverified for Omni); (c) an authenticated download of the output file URI. The existing polling UI would need to show "generating (blocking)" rather than queued/in-progress percentages.
- Vertex Veo through a BYOK localhost tool would require users to supply a service-account JSON or gcloud token plus a project ID and a GCS bucket. That is a big UX regression for the target users (and see the regional notes below).
- None of the main providers documents first-party webhooks for these flows, which suits a localhost app (it can't receive webhooks anyway).

### Gaps
- The raw REST path/headers for Interactions (`/v1beta/interactions`?) and whether `background: true` + polling works for Omni video were not verified.
- Gemini Files API output retention for generated videos was not verified.
- The current Runway auth/version header could not be read from live docs.

## Q4. Batch / offline APIs and discounts — is there any equivalent of OpenAI's 50% Batch API for video?

### Takeaway
**No.** No international provider found offers a discounted batch tier for video generation as of October 2026. Google's Batch API (50% off) does not accept Veo/media-generation models, Vertex batch inference is "not supported" for Veo 3.1, and Omni shows no Flex/Batch price. xAI's Batch API *accepts* video jobs but bills them at standard rates; its only benefit is that batch requests don't count against per-minute limits. Runway's server-side THROTTLED queue is the closest thing to "fire-and-forget". The app's 50,000-request, 50%-off batch mode cannot be reproduced on any Western API; it would become a client-side queue with concurrency control at full price.

### Cited Findings
- Gemini Batch API cookbook: "Media gen models are not currently compatible with the Batch API, but batch image creation is possible with the Nano-Banana model." — [Gemini cookbook Batch_mode.ipynb](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Batch_mode.ipynb) (undated)
- The Vertex/Agent Platform Veo 3.1 page (`veo-3.1-generate-001`) lists batch inference as not supported. Consumption options are provisioned throughput and fixed quota. — [Agent Platform Veo 3.1](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate)
- Gemini batch mode is 50% off with a 24 h SLO, documented for Gemini (text/multimodal) models. — [Google Developers Blog](https://developers.googleblog.com/en/scale-your-ai-workloads-batch-mode-gemini-api/)
- On the Agent Platform pricing page (fetched 2026-10-08), Gemini text models have "Flex/Batch" columns and the note "Gemini models are available in batch mode at 50% discount". The Gemini Omni table shows a single token price with no Flex/Batch column, and Veo shows only "Show discount options" (CUD/provisioned). — [Agent Platform pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
- xAI's official pricing: "The batch discount applies to text and language models only. Image and video generation are supported in the Batch API but are billed at standard rates." An older article claiming 50% video batch pricing conflicts with this and is superseded. Batch requests don't count against per-minute limits. — [xAI pricing](https://docs.x.ai/developers/pricing); [xAI Batch API](https://docs.x.ai/developers/advanced-api-usage/batch-api); contradicted (older) by [Creative AI News](https://www.creativeainews.com/blog/xai-grok-batch-api-image-video-generation/)
- Luma offers Provisioned Throughput (monthly, minimum 8 units, with longer commitments discounted), but "Video (ray-3.2) bills against a separate capacity class — contact sales". — [Luma Agents pricing](https://docs.agents.lumalabs.ai/guides/pricing/)
- Runway tiers raise concurrency and caps rather than lowering per-second price. Enterprise pricing is quote-based. — [Runway usage tiers](https://docs.dev.runwayml.com/usage/tiers/)
- The only ~50% video batch discount ever found was OpenAI's Sora 2 batch tier, which died with the API on 2026-09-24. — [OpenAI Batch guide](https://developers.openai.com/api/docs/guides/batch); [Pondero](https://pondero.ai/news/2026-09-24-openai-sora-api-shutdown/)

### Inferences
- Product implication: keep the "split prompts by blank line" bulk UX, but implement it as a local job queue (persisted state, resumable, concurrency = provider limit, back-off on 429/THROTTLED). For xAI specifically, the app could optionally submit via xAI's Batch API to avoid RPM limits. There is no discount, and its latency/SLO for video is unknown.
- Cost savings must now come from model choice (Lite/Fast/draft tiers, 360p/480p previews), not batch pricing.

### Gaps
- No source found on whether Google plans Batch/Flex for Omni.
- xAI Batch video SLO/turnaround not found.

## Q5. Rate limits / concurrency and their effect on bulk generation

### Takeaway
Bulk throughput is now bounded by per-account quotas rather than a batch queue. Runway publishes clear spend-gated tiers (Tier 1 = 1–2 concurrent and 50–200 generations/day, up to Tier 5 = 20 concurrent and 25–30k/day). The Gemini API adds **spend caps per rolling 10 minutes** ($10/$50/$200 for Tiers 1–3) on top of per-model RPM, which for Omni at 720p roughly limits Tier 1 to ~10 clips per 10 minutes. xAI publishes per-model tier limits (T0–T4). Luma shares quota per client. Expect new users with fresh keys to be throttled hard. The UI should expose a concurrency setting and handle 429s gracefully.

### Cited Findings
- **Gemini API:** each model variant has its own RPM, and paid users can request increases. Spend-based caps of $10, $50 and $200 per 10 minutes for Tiers 1–3, evaluated on a rolling 10-minute window. — [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) (via search summary)
- **Veo 3.1 RPM/concurrency** figures conflict across third parties: "50 RPM production / 10 RPM preview, max 10 concurrent per project" vs "10 RPM, 2–5 concurrent (2 trial / 5 standard / 10 enterprise)". The Vertex page lists a regional quota "50 … per minute" with an ambiguous unit. — [yingtu.ai](https://yingtu.ai/en/blog/veo-3-1-api-rate-limit); [aifreeapi](https://www.aifreeapi.com/en/posts/veo-3-1-api-rate-limit); [Agent Platform Veo 3.1](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate) (**conflicting**)
- **Omni rate limits:** no published numeric limits found ("Preview tier (check console)"; varies by region/account). — [Rundown Omni Flash](https://www.therundown.ai/tools/gemini-omni-flash)
- **Runway** (official): limits are per model per project, and models in the same modality share concurrency. Tier 1: 1–2 concurrent, 50–200 generations/day, $100/month cap. Tier 2 ($50 spent): 3 concurrent, 500–1,000/day, $500/month. Tier 3 ($100): 5 concurrent, 1,000–2,000/day, $2,000/month. Tier 4 ($1,000): 10 concurrent, 5,000–10,000/day, $20,000/month. Tier 5 ($5,000): 20 concurrent, 25,000–30,000/day, $100,000/month. There is no RPM limit, and over-limit tasks are THROTTLED (queued). — [Runway usage tiers](https://docs.dev.runwayml.com/usage/tiers/)
- **xAI:** per-model limits for grok-imagine-video, grok-imagine-video-1.5 and -1.5-lite across tiers T0–T4 range from 10 to 158 (unit unclear). RPS is derived as RPM/48. Overloads return 429 / service_unavailable. — [xAI rate limits](https://docs.x.ai/developers/rate-limits); [xAI async](https://docs.x.ai/developers/advanced-api-usage/async)
- **Luma:** rate limits and concurrent-job slots belong to the client, not the individual key. Pay-as-you-go capacity is shared, with no latency SLA. — [Luma FAQ](https://docs.agents.lumalabs.ai/guides/faq/); [Luma pricing](https://docs.agents.lumalabs.ai/guides/pricing/)
- **Nova Reel** (historical): 10 concurrent jobs on-demand. — [Focus Otter on X (2024)](https://x.com/focusotter/status/1865397733663633423) (old)

### Inferences
- Gemini Tier 1 spend cap: $10 per 10 min ÷ ~$1.01 per 10 s 720p Omni clip ≈ 9–10 clips per 10 min (~55–60/hour). Tier 3 ($200) allows ≈ 1,150–1,200/hour at 720p. This assumes spend caps apply to Omni output tokens, which is not confirmed.
- Runway Tier 1 (1–2 concurrent, ≤200/day) makes a 50,000-prompt job impossible for a new key. Even Tier 5 needs ~2 days. Bulk users must be told that throughput depends on their own account tier.

### Gaps
- No official Omni RPM/concurrency figures; no BFL, LTX or Pika rate-limit data found.

## Q6. Regional availability (mainland China, HK, Japan, Korea, EU), payment, people/face restrictions, content policy

### Takeaway
None of the Western APIs officially serves **mainland China**, and the Gemini API also rejects **Hong Kong** IPs ("User location is not supported"). That is a major issue for the maintainer's Chinese user base, who will need non-Chinese billing and network access. Japan, Korea and the EU are generally served, but Google restricts EEA/UK/CH features: no video upload for Omni edits/extensions, minors' images blocked, and only Paid Services allowed. People generation is the main policy friction: Omni blocks "certain recognizable people", and xAI moderates real faces after its January 2026 deepfake controversy.

### Cited Findings
- **Gemini API** availability is limited to listed regions. Mainland China is absent, and API endpoints are blocked at the network level from China. — [Gemini available regions](https://ai.google.dev/gemini-api/docs/available-regions); [aifreeapi China guide](https://www.aifreeapi.com/en/posts/how-to-use-gemini-in-china)
- **Hong Kong:** the consumer Gemini app opened to HK on 2026-03-16/17, but a March 2026 write-up says the Gemini API is still blocked from HK IPs with "User location is not supported for the API use". Another 2026 guide lists HK as available (**conflict**). — [10beasts](https://10beasts.net/gemini-hong-kong-api-blocked-vpn/); [Google AI forum](https://discuss.ai.google.dev/t/api-access-issue-from-server-in-hong-kong/73147); [transferllm](https://transferllm.com/blog/available-regions-for-google-ai-studio-and-gemini-api-full-country-list-restrictions-and-access-guide-2026/)
- **Gemini API terms:** "You may only access the Services (or make API Clients available to users) within an available region". "You may use only Paid Services when making API Clients available to users in the European Economic Area, Switzerland, or the United Kingdom." Users must be 18+, and API Clients may not be directed to or likely accessed by under-18s. — [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)
- **Omni regional/people restrictions (official):** "Uploading videos to use for video edits or extensions is NOT available in the EEA, Switzerland, the United Kingdom, and some US states." — [Omni SKILL.md](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-omni-flash-api/SKILL.md). Also "uploading and editing images containing minors is not supported in [EEA, CH, UK]. Uploading and editing images containing certain recognizable people is not supported". Safety filters apply to prompts and outputs and vary by region. — [Gemini Omni docs](https://ai.google.dev/gemini-api/docs/omni) (via search)
- A single Vertex user reports every Omni-preview request whose output contains an adult person returning `PROHIBITED_CONTENT`, and asked for allowlisting. — [Google AI forum](https://discuss.ai.google.dev/t/request-allowlist-access-for-person-generation-gemini-omni-flash-preview-on-vertex-ai-project-beauty-15498446810/174845) (single report)
- **xAI:** official regional docs cover routing and data residency, not country eligibility. Image, video and voice APIs are not available on the US regional endpoint. Third parties say the API is blocked for mainland China (foreign card needed) and HK is accessible. — [xAI regions](https://docs.x.ai/developers/regions); [router.one](https://router.one/grok-api-china); [digitalinasia tracker](https://digitalinasia.com/which-llms-work-asia-accessibility-tracker/) (third-party)
- **xAI content policy:** all generated images/videos are automatically moderated. Third parties report blocks on real-person likeness without consent and on public figures, and geoblocking of revealing edits of real people after the January 2026 deepfake wave. — [xAI video docs](https://docs.x.ai/developers/model-capabilities/video/generation); [Lumethic](https://www.lumethic.com/en/articles/ai-generators-c2pa-watermarks); [hitpaw](https://www.hitpaw.com/ai-model-tips/grok-imagine-video-moderation.html) (third-party)
- **Luma:** no official country list. Third parties say mainland China needs a relay/proxy. — [yangmao.ai](https://yangmao.ai/en/providers/luma/china-access/)
- **Runway:** no country list found. Some resold models are geo-restricted (Seedance 2.0 launched outside the US only). — [No Film School](https://nofilmschool.com/runway-seedance-2-0)
- **Vertex Veo** runs in us-central1 only. — [Agent Platform Veo 3.1](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate)
- Payment: Runway requires prepaid credits ($10 minimum). LTX is prepaid or approved postpaid. Pika uses a $10/month membership (third-party). Gemini needs a Cloud Billing account (paid tier). — [Apiframe Runway guide](https://apiframe.ai/guides/runway-api-guide); [LTX pricing](https://docs.ltx.io/pricing); [pikaais](https://pikaais.com/api/)

### Inferences
- Users in mainland China and likely HK cannot use Google, and probably xAI, directly without network workarounds and foreign billing. The app cannot legally "fix" this. The README should state regional eligibility plainly. Japan and Korea (both in Google's region list per general knowledge; not re-verified this session) and EU users are the realistic target for the Google backend.
- EU users will lose Omni video-upload features (edit/extend from uploaded video), but basic T2V/I2V works. Japan, Korea and US are unaffected by that rule.

### Gaps
- Official country lists for Runway, Luma, BFL, LTX and Pika were not found. Japan/Korea availability for each provider was not directly confirmed.
- Old Veo `personGeneration` (allow_all/allow_adult) rules are moot after the Gemini-API Veo shutdown. Omni has no documented equivalent parameter.

## Q7. ToS on third-party BYOK clients; watermarking (SynthID, C2PA)

### Takeaway
No provider's terms found explicitly forbid a local open-source client in which each user enters their *own* key. Google's terms instead make the app's users the "developers": they must be 18+, use the API for professional/business purposes in an available region, and use Paid Services in the EEA/UK/CH. Google embeds an invisible **SynthID** watermark in Omni/Veo videos. Runway is a C2PA implementer. Grok reportedly adds a visible logo but has no confirmed C2PA. The EU AI Act Art. 50 marking duties apply from 2026-08-02.

### Cited Findings
- Gemini API Additional Terms: users must be 18+; use is "for developers building with Google AI models for professional or business purposes, not for consumer use"; access only from available regions; Paid Services only in EEA/CH/UK; users may not bypass safety measures or build competing models. An archived version barred using the Services "to power another application programming interface" (not visible in current snippets). — [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms) (the cached copy is ~163 days old, with a version effective 2026-03-23 cited in forums; **verify**)
- Paid-tier data is not used to improve Google products. Unpaid-tier data may be human-reviewed. Abuse-monitoring logs are kept 55 days. — [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)
- Omni videos "include an imperceptible SynthID digital watermark", verifiable in the Gemini app, Chrome and Search. — [Rundown Omni 1.1](https://www.therundown.ai/tools/gemini-omni-1-1-flash); [PixVerse Omni guide](https://pixverse.ai/en/blog/gemini-omni-video-model-review) (quoting Google)
- Runway adopted C2PA in June 2024 (conformance v2.2, own trust list). — [Wikipedia: Content Credentials](https://en.wikipedia.org/wiki/Content_Credentials)
- Grok: visible corner logo on outputs (image-focused test); C2PA/invisible watermark not confirmed; "thinnest" provenance story. — [Lumethic](https://www.lumethic.com/en/articles/ai-generators-c2pa-watermarks) (third-party; image-focused)
- EU AI Act Article 50 obligations apply from 2026-08-02, requiring machine-readable marking of synthetic outputs by providers. — [Tech Insider C2PA labels](https://tech-insider.org/c2pa-labels-ai-images-2026/) (third-party)
- Midjourney: unofficial API wrappers violate ToS (ban risk). — [Wireflow](https://www.wireflow.ai/blog/best-midjourney-api-tools-in-2026)

### Inferences
- The BYOK localhost design (key never written to disk) aligns with Google's model, since each user is their own API customer. The README should point users to each provider's terms: 18+, business use, region and paid tier in the EU.
- If the app adds post-processing (re-encoding, concatenating extensions), C2PA manifests may be stripped. SynthID survives re-encoding by design.

### Gaps
- Runway, Luma, xAI, BFL, LTX and Pika API terms regarding third-party clients and key sharing were not retrievable. Luma/LTX/BFL/Pika watermark behaviour on API output is unknown.

## Q8. Market standing: quality rankings, adoption, and stability/shutdown risk

### Takeaway
On blind-vote leaderboards in Aug–Sep 2026, **Google's Gemini Omni Flash is #1 among all models (including Chinese)**: AA text-to-video with audio, 1238 Elo on 2026-09-02; Arena.ai text-to-video, 1516 on 2026-09-21. Chinese models (Wan 3.0, MiniMax H3, Seedance 2.x) crowd positions 2–5. Grok Imagine 1.5 was #1 in AA image-to-video (silent) in June but fell to #4 by August. Runway Gen-4.5 led in December 2025 but was absent from AA's live board by July 2026. On stability, 2026 was brutal: OpenAI Sora (API dead 09-24), Azure Sora (10-15), Amazon Nova Reel (EOL 09-30), Gemini-API Veo 3.1 previews (10-22), Luma Dream Machine/Ray 2 (deprecated) and LTX V1 (10-26) all ended. The lesson is to build a **multi-provider adapter layer**, not a single-vendor wrapper.

### Cited Findings
- AA Text-to-Video *with audio* (mirror, 2026-09-02): #1 Gemini Omni Flash 1238, #2 Wan 3.0 1237, #3 MiniMax H3 Max (post-trained by fal) 1235, #4 MiniMax H3, #5 Dreamina Seedance 2.0 720p. — [benchmarklist AA mirror](https://benchmarklist.com/benchmarks/artificial_analysis_text_to_video/)
- AA's own "AA-Video-T2V v2.0" page (undated in snippet) lists Wan 3.0 first at 1156, then Utopai X, Dreamina Seedance 2.5 and two MiniMax H3 variants. — [Artificial Analysis T2V leaderboard](https://artificialanalysis.ai/video/leaderboard/text-to-video) (date unclear)
- Arena.ai (not AA) text-to-video snapshot on 2026-09-21: gemini-omni-1.1-flash #1 at 1516, based on 718,577 votes across 48 models. — [Arena.ai T2V](https://arena.ai/leaderboard/text-to-video)
- August 2026 snapshot: Omni Flash leads T2V with audio at 1245, ahead of MiniMax-H3 (1242) and Seedance 2.0 (1225). Grok Imagine Video 1.5 was #1 (~1473) on AA no-audio I2V in June 2026, #4 (~1328) by August, and ~1114 where audio counts. A comparison guide checked on 2026-07-18 found Runway Gen-4.5 absent from AA's live board. — [invideo (Aug 2026)](https://invideo.io/blog/best-ai-video-model/) / [rizzgen](https://www.rizzgen.ai/blogs/runway-kling-veo-ltx-wan-seedance-comparison) (attribution between these two uncertain in the search summary)
- AA's I2V page shows inconsistent Omni numbers (1368 in the FAQ vs 1178 in the table). — [AA I2V leaderboard](https://artificialanalysis.ai/video/leaderboard/image-to-video)
- Grok Imagine took #1 in AA T2V and I2V in January 2026, surpassing Runway Gen-4.5, Kling 2.5 Turbo and Veo 3.1. — [Artificial Analysis on X](https://x.com/ArtificialAnlys/status/2016749756081721561) (older)
- Runway Gen-4.5 launched on 2025-12-01 and immediately took #1 on AA (~1247 Elo). — third-party comparison surfaced in search (exact page attribution uncertain; old, pre-2026); consistent with the AA post above saying Grok later surpassed Gen-4.5
- Shutdown and churn record: OpenAI's Sora API ended 2026-09-24 with no successor ([Pondero](https://pondero.ai/news/2026-09-24-openai-sora-api-shutdown/)). The Azure sora-2 2025-12-08 build retires 2026-10-15 ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5881436/azure-ai-foundry-sora-2-retirement-date-feels-too)). Nova Reel EOL was 2026-09-30 ([Bedrock model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-reel.html)). The Gemini-API Veo 3.1 previews end 2026-10-22 and Veo 3/2 ended 2026-06-30 ([Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations)). Runway removed Gen-3 Alpha Turbo and Gen-4 Aleph on 2026-07-30 ([Runway changelog](https://docs.dev.runwayml.com/api-details/api_changelog/)). Luma deprecated Dream Machine/Ray 2 ([Luma llm-info](https://lumalabs.ai/llm-info)). LTX-2 was removed 2026-08-15 and LTX V1 endpoints end 2026-10-26 ([LTX changelog](https://docs.ltx.io/api-changelog)). The Omni preview ID was reportedly shut down 2026-09-30 ([Evolink](https://evolink.ai/blog/gemini-omni-api-status)).
- Developer adoption signals: open-source tools are switching their Google default to Omni (mulmocast-cli, vibeframe, thoughtform PRs). Aggregators rushed to resell Omni. — [mulmocast-cli PR #1620](https://github.com/receptron/mulmocast-cli/pull/1620); [vibeframe PR #332](https://github.com/vericontext/vibeframe/pull/332); [thoughtform PR #19](https://github.com/thoughtform-co/thoughtform/pull/19)
- Sora's reported shutdown reasons (unconfirmed): compute shortages, cost (~$1M/day) and a refocus on enterprise. — [Wikipedia: Sora](https://en.wikipedia.org/wiki/Sora_(text-to-video_model)); [search summary](https://pondero.ai/news/2026-09-24-openai-sora-api-shutdown/) (reported, not confirmed)

### Inferences
- **Best primary backend for Sora2App:** Gemini API + `gemini-omni-1.1-flash`. It has top quality, a simple API key, native audio, first/last frame, extension to 40 s, a 360p draft tier and ~$0.10/s at 720p (Sora-2-standard parity). Google's churn is fast (model IDs changed three times in 2026), but the company is very unlikely to exit video entirely. Main risks: no China/HK access, the new Interactions API shape, the EU upload restrictions and person-content filtering.
- **Strong secondary backends (simple REST + key):** xAI Grok Imagine 1.5 (closest API shape to OpenAI's `/videos`; batch-API submission possible; competitive quality, though corporate/branding turbulence shows in "SpaceXAI"); Runway Gen-4.5 (well-documented tiers and a server-side queue, but no native audio and 720p only); BFL FLUX 3 (newest, audio, 20 s, but young and its API stability is unproven); LTX (cheapest per second; open-weight fallback reduces lock-in).
- **Not recommended as primary:** Vertex Veo (OAuth/GCS; retirement date unclear), Luma Ray 3.2 (pricing pre-GA, new API, no audio confirmation), Pika (membership model, sparse docs), Adobe Firefly (enterprise only), Midjourney (no API), Moonvalley (API availability doubtful), Nova Reel (dead).
- Design lesson from Sora: a provider-adapter interface (create/poll/download/capabilities), model IDs kept in a data file, and deprecation warnings in the UI.

### Gaps
- No October 2026 AA leaderboard snapshot was retrievable, and Luma Ray 3.2, FLUX 3 Video and LTX-2.5 positions on AA were not found.
- No usage/adoption metrics (API call volumes, developer counts) were found for any provider.
