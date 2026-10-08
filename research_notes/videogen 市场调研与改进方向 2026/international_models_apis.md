# International (non-China) AI Video Models and Official APIs — State as of Sep–Oct 2026

Research date: 2026-10-08. Every claim below was accessed on 2026-10-08. Where a source shows a publication or snapshot date, it is given in brackets.

Access limits on this research: WebFetch could not resolve any domain (DNS ENOTFOUND for openrouter.ai, ai.google.dev, platform.openai.com, artificialanalysis.ai and wikipedia.org). The egress proxy also refused `openrouter.ai` (HTTP 403, organization policy). That meant the live `/api/v1/videos/models` JSON and the official pricing pages could not be loaded directly. All facts here come from search-engine extracts of the cited pages. When a primary page (official docs, vendor post, leaderboard) surfaced in search, it is cited directly. Third-party blogs and resellers are labeled as such. Numbers from search extracts may lag the live pages by days or weeks.

---

## 1. OpenAI Sora: status of Sora 2 / Sora 2 Pro API and the Sora app as of Oct 2026; successor?

### Takeaway
OpenAI announced the end of Sora on 2026-03-24 and shut it down in two stages. The Sora web and iOS app closed on 2026-04-26. The Videos API and every Sora 2 alias (`sora-2`, `sora-2-pro` and their dated snapshots) were removed on 2026-09-24. OpenAI's deprecations table leaves the "recommended replacement" field blank, and as of 2026-10-08 OpenAI offers no video-generation API. Removing Sora from videogen therefore matches the market, and no OpenAI successor exists to integrate.

### Cited Findings
- OpenAI announced the Sora shutdown on Tuesday 2026-03-24 and gave no further details on why — [TechCrunch, 2026-03-24](https://techcrunch.com/2026/03/24/openais-sora-was-the-creepiest-app-on-your-phone-now-its-shutting-down/); [The Hill](https://thehill.com/policy/technology/5799879-openai-sora-video-app-shutdown/)
- The shutdown had two stages. The Sora web and app went dark on 2026-04-26, and the Sora API followed on 2026-09-24 — [The Decoder](https://the-decoder.com/openai-sets-two-stage-sora-shutdown-with-app-closing-april-2026-and-api-following-in-september/)
- The API removal covers the whole Videos API plus `sora-2`, `sora-2-pro` and their dated snapshots — [TechJack Solutions](https://techjacksolutions.com/ai-brief/openai-videos-api-sora-2-deprecated-september-2026/); [ecorpit migration guide](https://ecorpit.com/sora-2-videos-api-shutdown-migration-cost-2026/)
- A third-party summary dated 2026-07-17 says OpenAI's official deprecations page then listed "the Videos API, sora-2, and sora-2-pro" for removal on 2026-09-24 — [GlobalGPT, "Sora 2 cost in 2026"](https://www.glbgpt.com/hub/how-much-does-sora-2-cost/). The official page is [developers.openai.com/api/docs/deprecations](https://developers.openai.com/api/docs/deprecations), which could not be fetched directly.
- The deprecation used OpenAI's standard six months' notice for generally available models. The recommended-replacement cell for the Videos API and each Sora 2 alias is empty — [Pondero, 2026-09-24](https://pondero.ai/news/2026-09-24-openai-sora-api-shutdown/)
- Third-party trackers conclude that OpenAI has no internal successor to Sora — [Twin AI Labs](https://twinailabs.com/en/blog/sora-api-shutdown-september-2026); [BeingGuru](https://beingguru.com/openai-shuts-down-the-sora-api-with-no-replacement-in-sight/)
- OpenAI's media work continues only in still images. GPT Image 2.5 ("ChatGPT Images 2.5") was released on ChatGPT on 2026-09-08 — [Wikipedia: GPT Image](https://en.wikipedia.org/wiki/GPT_Image)
- Reasons reported in the press but **not confirmed by OpenAI**:
  - Running costs of about $1M per day, and users falling from about 1M at peak to under 500k — [MindStudio](https://www.mindstudio.ai/blog/why-openai-killed-sora-ai-video-generation-future)
  - Compute redirected to coding and enterprise products, with Sora kept as a world-model research project — [The Decoder](https://the-decoder.com/openai-sets-two-stage-sora-shutdown-with-app-closing-april-2026-and-api-following-in-september/)
- Sources disagree on whether Sora 2 survives inside ChatGPT's paid tier. Pondero says it does — [Pondero](https://pondero.ai/news/2026-09-24-openai-sora-api-shutdown/). GenLovers says Sora did not survive inside ChatGPT — [GenLovers](https://genlovers.com/models/sora)
- Last known Sora 2 API prices, for historical comparison:
  - `sora-2`: $0.10/s at 720p
  - `sora-2-pro`: $0.30/s at 720p, $0.50/s at 1024p
  - Source: [eesel, 2025 guide](https://www.eesel.ai/blog/sora-2-in-the-api-pricing)
  - A July 2026 listing adds `sora-2-pro` at $0.70/s for 1080p with Standard processing — [GlobalGPT](https://www.glbgpt.com/hub/how-much-does-sora-2-cost/)
  - invideo's August 2026 table also gives $0.10–$0.70/s — [invideo, Aug 2026](https://invideo.io/blog/ai-video-model-pricing/)
- Third-party guides tell users to export their data through `sora.chatgpt.com/sunset` before the final deletion window. Whether that window is still open on 2026-10-08 could not be confirmed — [Twin AI Labs](https://twinailabs.com/en/blog/sora-api-shutdown-september-2026); [ecorpit](https://ecorpit.com/sora-2-videos-api-shutdown-migration-cost-2026/)
- `sora-2-pro` still shows a legacy score on Arena's text-to-video lab view (1368 in the 2026-09-21 snapshot), well below the leaders at about 1516 — [Arena text-to-video leaderboard](https://arena.ai/leaderboard/text-to-video?rankBy=labs)

### Inferences
- Sora is retired on every surface. Any Sora wording left in videogen's docs, migrations or presets can go, and no OpenAI video provider is waiting to be added.
- The request shape OpenAI's Videos API popularized (POST `/v1/videos`, then poll, then download) lives on in OpenRouter's `/api/v1/videos` and in "OpenAI-compatible video" proxies. Videogen's generic OpenAI-compatible video provider is still useful, but the canonical OpenAI endpoint behind it no longer exists.
- Commentary after the shutdown repeatedly advises developers to "put video generation behind your own interface so you can swap providers". Videogen's multi-provider lanes fit that advice.

### Gaps
- A claim that `/v1/videos` requests return HTTP 410 from 2026-09-25 appeared in a search summary, but it could not be tied to a specific source. Unverified.
- The OpenAI deprecations page could not be loaded directly. The blank replacement field is known only through third-party quotes.
- Whether the Sora data-export window (`sora.chatgpt.com/sunset`) is still open is unknown.

---

## 2. Quality leaderboards (Artificial Analysis Video Arena, Arena/LMArena), Sep–Oct 2026: top ~10

### Takeaway
Google's **Gemini Omni (1.1) Flash** is the international leader, ranked #1 on Arena text-to-video (2026-09-21) and #1 or #2 on Artificial Analysis (AA) with audio. Otherwise the top tier is mostly Chinese (Wan 3.0, Seedance 2.0/2.5, MiniMax H3, Vidu Q4, Kling 3.0). The international models that place are:
- Black Forest Labs **FLUX 3 Video**, #3 on Arena text-to-video
- xAI **Grok Imagine Video 1.5**, #4 on Arena text-to-video and top-3 on Arena image-to-video in June
- Meta **Muse Video**, #9 on Arena, no API
- **Utopai X**, #2 on AA text-to-video, no API

**Veo 3.1 has fallen outside the top 10** on AA (about 14th on text-to-video with audio). **Runway Gen-4.5**, AA's #1 in December 2025, is reported missing from AA's live boards by mid-2026.

### Cited Findings
**Artificial Analysis — text-to-video (AA-Video-T2V v2.0; scale pinned so Kling 3.0 1080p Pro = 1000)**
- Overall v2.0 table (cached; exact date unclear) — [AA T2V leaderboard](https://artificialanalysis.ai/video/leaderboard/text-to-video):
  1. Wan 3.0 (Alibaba) — 1156±9
  2. Utopai X — 1149±10
  3. Dreamina Seedance 2.5 — 1143±9
  4. MiniMax H3 (768p) — 1137±9
  5. MiniMax H3 Max — 1130±10
- Snapshot "last updated September 29, 2026", quoted by a third-party blog — [OrcaRouter blog](https://www.orcarouter.ai/de/blog/utopai-x-debut):
  - Wan 3.0 — 1157 (6,391 samples; released Aug 2026; AA price $12.00/min)
  - Utopai X — 1150 (5,455 samples; released Sep 2026; "No API available")
  - Seedance 2.5 — 1143
  - MiniMax H3 768p — 1138
  - The same blog describes Utopai X as a post-trained MiniMax H3 (third-party claim).
- Utopai's own release claims Utopai X ranks "No. 2 globally on Artificial Analysis' Text-to-Video Leaderboard With Audio, with an Elo score of 1,150" and is the top US-based developer there. Utopai X is offered only inside Utopai's PAI platform — [Utopai press release via Webull](https://www.webull.com/news/15668417926267904)
- AA embed, with-audio view (undated) — [AA embed](https://artificialanalysis.ai/embed/text-to-video-leaderboard/leaderboard/text-to-video):
  1. Gemini Omni Flash — 1233
  2. Wan 3.0 — 1229
  3. MiniMax H3 Max (post-trained by fal) — 1227
  - Lower down the same view: Kling 3.0 1080p Pro 1095 (about #12), Kling 3.0 720p Std 1089 (about #13), Veo 3.1 1088 (about #14).
  - A mirror snapshot dated 2026-09-02 has Gemini Omni Flash 1238 vs Wan 3.0 1237 — [benchmarklist](https://benchmarklist.com/benchmarks/artificial_analysis_text_to_video/)
- AA announced that "Google's Gemini Omni Flash debuts at #1 on the Artificial Analysis Text to Video and Image to Video Leaderboards, edging out ByteDance's Seedance 2.0 on both" (summer 2026; exact date not visible) — [Artificial Analysis on X](https://x.com/ArtificialAnlys/status/2076747075036045645?lang=en)
- History:
  - At launch in Dec 2025, Runway Gen-4.5 scored 1,247 Elo, #1 on AA text-to-video — [Runway on X](https://x.com/runwayml/status/1995493447604552001)
  - It led Veo 3 (1,226), Kling 2.5 (1,225) and Sora 2 Pro (1,206) — [AI CERTs News](https://www.aicerts.ai/news/runway-gen-4-5-tops-generative-video-rankings/)
  - Third-party pages say Gen-4.5 no longer appeared on AA's live text-to-video or image-to-video arenas as of 2026-07-18 and 2026-08-07. This surfaced in search alongside [imaginetovideo](https://imaginetovideo.com/runway-gen-4-5) and [bonega.ai](https://bonega.ai/en/blog/runway-gen-4-5-artificial-analysis-benchmark-2026). Unverified on AA itself.

**Artificial Analysis — image-to-video (AA-Video-I2V v1.0)** — [AA I2V leaderboard](https://artificialanalysis.ai/video/leaderboard/image-to-video)
1. MiniMax H3 Max — 1195±9
2. MiniMax H3 (open weights) — 1181±8
3. Vidu Q4 Preview — 1179±10
4. Gemini Omni Flash — 1178±7
5. Dreamina Seedance 2.0 720p — 1176±7
- Veo 3.1 is about #12 (1082) on an AA image-to-video snapshot — [AA I2V](https://artificialanalysis.ai/video/leaderboard/image-to-video)
- Mirror snapshot dated 2026-07-27: Gemini Omni Flash 1200 vs Seedance 2.0 720p 1199 — [benchmarklist I2V](https://benchmarklist.com/benchmarks/artificial_analysis_image_to_video/)
- Open-weights image-to-video view: MiniMax H3 leads, then MAGI-2 Preview (1093) and Lightricks LTX-2.5 Fast (1038) — [AA I2V open weights](https://artificialanalysis.ai/video/leaderboard/image-to-video/open-weights)

**Arena (formerly LMArena) — text-to-video, snapshot 2026-09-21 (718,577 votes, 48 models)** — [Arena T2V](https://arena.ai/leaderboard/text-to-video); [benchmarklist mirror](https://benchmarklist.com/benchmarks/arena_ai_text_to_video/)
1. gemini-omni-1.1-flash (Google) — 1516±15
2. gemini-omni-flash (Google) — 1513±9
3. flux-3-video (Black Forest Labs) — 1493±17
4. grok-imagine-video-1.5-agent ("SpaceXAI") — 1492±18
5. dreamina-seedance-2.0-720p (ByteDance) — 1479±8
6. wan3.0 (Alibaba) — 1476±13
7. dreamina-seedance-2.5-720p (ByteDance) — 1474±9
8. minimax-h3 (MiniMax; community license) — 1460±9
9. muse-video (Meta) — 1456±15
- Lab view: Alibaba's happyhorse-1.0 is at 1427 and OpenAI's sora-2-pro at 1368. The next entry, pixverse-v5.6, is far behind at 1240.
- Arena's changelog shows wan3.0 added on 2026-09-04 and grok-imagine-video-1.5-agent on 2026-09-10 — [Arena leaderboard changelog](https://arena.ai/company/leaderboard-changelog)
- Arena posted that Gemini Omni 1.1 Flash "landed #1 in the Text-to-Video Arena and #2 in the Image-to-Video Arena", 20 points above FLUX 3 Video at #3 (1495) — [Arena on X](https://x.com/arena/status/2093015572212846673)

**Arena — image-to-video (latest snapshot found: 2026-06-23, about 1.35M votes, 42 models)** — [Arena I2V](https://arena.ai/leaderboard/image-to-video)
1. dreamina-seedance-2.0-720p — about 1474
2. gemini-omni-flash — about 1469
3. grok-imagine-video-1.5-preview-720p — about 1466
4. happyhorse-1.0 — about 1444
5. wan2.7-i2v — about 1434
6. grok-imagine-video-720p — about 1422
- The leader changed over 2026: a Google entry led on 2026-01-21, xAI on 2026-02-10 and 2026-03-06, and ByteDance on 2026-05-12 — [Arena I2V cached snapshots](https://arena.ai/leaderboard/image-to-video)

**Conflicting aggregator**
- llm-stats (updated 2026-10-04) claims "Kling v3 leads with 1934". This does not match AA or Arena scales — [llm-stats](https://llm-stats.com/leaderboards/best-ai-for-video-creation)

### Inferences
- Combined top ~10 across both arenas, Sep–Oct 2026. Chinese vendors are marked (CN). "API" means a public developer API exists.
  1. Gemini Omni 1.1 Flash (Google; API)
  2. Wan 3.0 (CN)
  3. Seedance 2.0/2.5 (CN)
  4. MiniMax H3 / H3 Max (CN)
  5. FLUX 3 Video (BFL; API)
  6. Grok Imagine Video 1.5 (xAI; API)
  7. Utopai X (US; **no API**)
  8. Vidu Q4 (CN)
  9. Meta Muse Video (**no API**)
  10. Kling 3.0 (CN)
- Veo 3.1, Runway Gen-4.5, Luma Ray 3.2, LTX-2.5 and Pika are no longer in the top 10.
- Of the international models that place, videogen already reaches Gemini Omni (direct and through OpenRouter), FLUX 3 Video and Grok Imagine 1.5 (OpenRouter only). It has no direct xAI or BFL integration, which leaves cheaper direct pricing and the edit, extend and keyframe endpoints out of reach (see Q3).
- Leaderboard order changes from week to week, and scores within each other's confidence intervals are effectively tied. A "Leaderboard rank" hint in model pickers would go stale quickly and should be date-stamped.

### Gaps
- The live AA and Arena pages could not be loaded. No AA snapshot dated October 2026 was retrieved. The AA without-audio text-to-video top 10 is only partly known.
- No Arena image-to-video snapshot from September or October 2026 was found. Gemini Omni 1.1 Flash is #2 per Arena's post, but the full order is unknown.
- That Utopai X is a post-trained MiniMax H3 is a third-party claim.

---

## 3. Vendor-by-vendor: public developer API, capabilities and list prices (per second)

### Takeaway
Every international leader except Meta Muse Video, Utopai X, Midjourney and Moonvalley (no public self-serve API found) now ships an async REST API. Pricing is per output second and tiered by resolution.

The capability set is converging on the following. Videogen currently supports only T2V, I2V, first/last frame and native audio from this list.
- text-to-video (T2V) and image-to-video (I2V)
- first/last frame
- **multiple reference images**: Veo up to 3; Grok 1.5 1–7; Omni up to 8–10 on partner surfaces
- **keyframes**: Grok up to 4; Luma Ray 3.2 16–64; Aleph up to 5
- **extend**
- **natural-language video edit / V2V**
- native audio
- 1080p/4K output or upscaling

Typical list prices in Oct 2026, by tier:

| Tier | Typical price | Examples |
|---|---|---|
| Draft | $0.01–$0.06/s | Luma 360p draft, FLUX draft, Omni 360p, Veo Lite without audio |
| Mainstream 720p | $0.05–$0.17/s | |
| 1080p | $0.08–$0.29/s | |
| 4K | $0.30–$0.80/s | |

### Cited Findings

**Google — Veo 3.1 (Gemini API, and Vertex AI / "Gemini Enterprise Agent Platform")**

Models and IDs:
- Model IDs on the Gemini API are `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview` and `veo-3.1-lite-generate-preview` (Lite added 2026-03-31). A 2026-06-15 changelog entry told integrators to switch to these preview IDs or to the GA versions on Gemini Enterprise Agent Platform — [Gemini API release notes](https://ai.google.dev/gemini-api/docs/changelog)
- The GA Vertex model page for `veo-3.1-generate-001` marks first/last-frame input, extension and reference images as "Supported" — [Google Cloud Veo 3.1 model page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate)
- Veo 3, Veo 3 Fast and Veo 2 were retired on the Gemini API on 2026-06-30, with Veo 3.1 as the replacement (third-party guide citing Google's deprecations page) — [FrameSurfer](https://framesurfer.com/blogs/veo-3-pricing)

Capabilities:
- Output is 8-second clips at 720p, 1080p or 4K with native audio. 4K is not available on Lite.
- Up to 3 reference images ("ingredients": character, object or scene).
- First and last frame.
- Extension continues from the final second (24 frames) of a Veo-generated clip. Extension is not available on Lite and is limited to 720p.
- Source: [Gemini API Veo docs](https://ai.google.dev/gemini-api/docs/veo); [Google Developers Blog — Veo 3.1 in Gemini API](https://developers.googleblog.com/introducing-veo-3-1-and-new-creative-capabilities-in-the-gemini-api/)
- AI Studio lists durations of 4, 6 or 8 s — [AI Studio Veo page](https://aistudio.google.com/models/veo-3)
- The "Ingredients to Video" update added native 9:16 and improved 1080p and 4K output on Flow, the Gemini API and Vertex AI (date not visible in the extract) — [blog.google](https://blog.google/innovation-and-ai/technology/ai/veo-3-1-ingredients-to-video/); [FoneArena](https://www.fonearena.com/blog/473509/google-veo-3-1-native-916-video-improved-1080p-and-4k-output-gemini-api.html)
- Google's video overview steers fast conversational editing to Gemini Omni Flash, and keeps Veo 3.1 for "high-fidelity cinematic videos… specific capabilities like scene extension, last-frame control" — [Gemini API video overview](https://ai.google.dev/gemini-api/docs/video)

Prices on the Gemini API (third-party compilations that cite Google's page):

| Model | 720p | 1080p | 4K |
|---|---|---|---|
| Veo 3.1 Standard | $0.40/s | $0.40/s | $0.60/s |
| Veo 3.1 Fast | $0.10/s | $0.12/s | $0.30/s |
| Veo 3.1 Lite | $0.05/s | $0.08/s | not offered |

- Lite without audio is listed from $0.03/s.
- Sources: [invideo, Aug 2026](https://invideo.io/blog/ai-video-model-pricing/); [veo3ai.io](https://www.veo3ai.io/blog/veo-3-pricing-2026); [CostGoat, Oct 2026](https://costgoat.com/pricing/google-veo)
- Google Cloud's price page shows Veo 3.1 with audio at "$0.40 / 1 count" (720p/1080p) and "$0.60 / 1 count" (4K). The page does not define the unit — [Google Cloud Agent Platform pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing); unit ambiguity noted by [camclo3d](https://camclo3d.com/blog/veo-3-pricing). Luma's article reads "per count" as per attempt — [Luma](https://lumalabs.ai/news/veo-pricing). The other sources treat it as per second.

Veo 4:
- No Veo 4 had been announced as of August/September sources. Google I/O 2026 ended without one, and DeepMind's page still listed Veo 3.1 (Oct 2025) as the latest — [AIReiter, Aug 2026](https://aireiter.com/blog/veo-4)

**Google — Gemini Omni Flash / Omni 1.1 Flash (Gemini API Interactions API)**

Launch and access:
- Announced at Google I/O on 2026-05-19 as the first Omni model. It takes text, image, audio and video references and supports conversational editing, with 3–10 s clips — [9to5Google, 2026-05-19](https://9to5google.com/2026/05/19/gemini-omni-create-anything-model-video/); [TechCrunch, 2026-05-19](https://techcrunch.com/2026/05/19/googles-gemini-omni-turns-images-audio-and-text-into-video-and-thats-just-the-start/); [Google blog](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-omni/)
- Developer preview (`gemini-omni-flash-preview`) opened on 2026-06-30. GA as `gemini-omni-1.1-flash` came on 2026-08-27 (third-party; some sources still call it a preview) — [geotoolbox](https://geotoolbox.ai/blog/gemini-omni); [TeamDay](https://www.teamday.ai/models/gemini-omni-flash)
- Omni Pro has been teased with no date — [Build Fast with AI](https://www.buildfastwithai.com/blogs/gemini-omni-google-ai-video-model-review)

Capabilities:
- Google's model table lists output of 3–10 s at 360p, 720p, 1080p or 4K and 24 fps. Uploaded video for edit or extension can be up to 10 s — [Gemini Omni Flash model page](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash)
- The model runs only through the Interactions API. Reference media is uploaded through the Files API and referenced in the input parts. Prompts address references with placeholders such as `<IMAGE_REF_0>`. Multi-turn editing uses `previous_interaction_id` — [Gemini API Omni docs](https://ai.google.dev/gemini-api/docs/omni)
- Omni 1.1 Flash "introduces scene extension, first-and-last-frame interpolation, video references, faster 360p prototyping, and upscaling to 4K" — [Design Arena on X](https://x.com/DesignArena/status/2093068655756190104)
- Reference limits vary by surface: up to 8 reference images plus 1 reference video on ElevenLabs, and up to 10 reference images on Runway — [ElevenLabs](https://elevenlabs.io/video/gemini-omni-flash); [Runway](https://runway.com/product/models/gemini-omni)
- Extension appends only, with no prepend or mid-clip extension (third-party review) — [The Rundown](https://www.therundown.ai/tools/gemini-omni-1-1-flash)

Price:
- Video output costs $17.50 per 1M tokens, at 5,792 tokens per second of 720p, which is about **$0.10/s at 720p**. Input costs $1.50 per 1M tokens. There is no free tier — [eesel](https://www.eesel.ai/blog/gemini-omni-flash-pricing)
- One source gives separate GA rates: about $0.034/s at 360p, $0.152/s at 1080p and $0.304/s at 4K — [eesel, Omni 1.1 pricing](https://www.eesel.ai/blog/gemini-omni-1-1-flash-pricing)

**Runway (Runway Dev API)**

Models and capabilities:
- Gen-4.5 handles text-to-video and image-to-video (`model: 'gen4.5'`, `imageToVideo.create`, `waitForTaskOutput`). The docs also list Seedance 2.5, Aleph 2.0 and GPT Image 2 — [Runway API docs](https://docs.dev.runwayml.com/); [Getting started](https://docs.dev.runwayml.com/guides/using-the-api/)
- Aleph 2.0 (`aleph2`) is a video-to-video edit model. It reached the API on 2026-06-02. Inputs run 2–30 s, with up to 5 keyframe images.
- The older `gen4_aleph` was removed from the API on 2026-07-30.
- Source for both: [Runway API changelog](https://docs.dev.runwayml.com/api-details/api_changelog/)
- Aleph 2.0 shipped in the web app on 2026-05-21 — [Runway changelog](https://runway.com/changelog)
- The Media Router launched on 2026-07-23 through Runway Dev, which had opened "earlier this month" with third-party models (Seedance, Gemini Omni Flash, GPT Image 2, ElevenLabs).
  - It picks a model by quality, speed or cost.
  - The router adds no fee.
  - A dry-run mode shows which model would be selected without charging for a generation.
  - Admins can block individual third-party models.
  - Source: [TechCrunch, 2026-07-23](https://techcrunch.com/2026/07/23/runway-bets-on-ai-model-routing-as-generative-media-gets-crowded/)
- TechCrunch also noted that Runway had not released a new frontier model in months and had been asked about Gen-5. No Gen-5 launch was found up to early-September changelog extracts — [TechCrunch](https://techcrunch.com/2026/07/23/runway-bets-on-ai-model-routing-as-generative-media-gets-crowded/)

Price:
- API credits cost $0.01 each. Gen-4.5 is 12 credits/s, so **$0.12/s**. Older guides quote 25 credits/s — [Sume](https://www.sume.com/blog/runway-credits-per-video); [camclo3d](https://camclo3d.com/blog/runway-pricing)
- Aleph 2.0 is 28 credits/s ($0.28/s) with a 56-credit minimum (reseller-reported) — [Atlas Cloud](https://www.atlascloud.ai/blog/tips/runway-aleph)
- OpenRouter lists the same rates: Gen-4.5 $0.12/s and Aleph 2.0 $0.28/s — [OpenRouter Runway](https://openrouter.ai/runway)

Operational details:
- Output URLs expire within 24–48 h, and the docs say to copy outputs to your own storage. `runway://` upload URIs last 24 h. Input URLs must be HTTPS with a hostname, return no 3xx redirect, and stay at or under 2048 characters — [Runway outputs](https://docs.dev.runwayml.com/assets/outputs/); [Runway inputs](https://docs.dev.runwayml.com/assets/inputs/)

**Luma (Ray 3.2; Luma Agents API)**

Capabilities:
- Ray 3.2 launched with the first API access to a Ray3-family model (about 2026-06-09) — [Luma announcement](https://lumalabs.ai/news/introducing-ray-3-2)
- Keyframe control is up to 16 keyframes at launch, or up to 64 keyframes at arbitrary frame indexes depending on the surface — [Luma learning center](https://lumalabs.ai/learning-center/articles/ray-3-2-introduction-and-core-concepts)
- It also offers 20 s video editing, character controls and HDR/EXR output (review) — [The Rundown](https://www.therundown.ai/tools/ray-3-2)
- The Agents API uses POST `/v1/generations`, then GET `/v1/generations/{id}`, then a download from presigned URLs. There are official CLI, Go and Python SDKs — [Luma Agents quickstart](https://docs.agents.lumalabs.ai/); [luma-agents-cli](https://github.com/lumalabs/luma-agents-cli)

Price (Ray 3.2, SDR) — [Luma pricing docs](https://docs.agents.lumalabs.ai/guides/pricing/); table reproduced by [WaveSpeed](https://wavespeed.ai/blog/cost-and-billing/luma-ai-pricing/):

| Resolution | Per 5 s | Per 10 s |
|---|---|---|
| 360p draft | $0.06 | $0.18 |
| 540p | $0.15 | $0.45 |
| 720p | $0.30 | $0.90 |
| 1080p | $1.20 | $3.60 |

- Per second, that is about $0.06/s at 720p and about $0.24/s at 1080p.
- Reframe is $0.12/s at 720p.
- Video-to-video edit is $2.16 per 5 s at 1080p.
- The docs say video rates "may change before general availability".

**xAI — Grok Imagine Video (docs.x.ai; branded "SpaceXAI API" on x.ai)**

Prices:

| Model | 480p | 720p | 1080p | Inputs |
|---|---|---|---|---|
| `grok-imagine-video` | $0.05/s | $0.07/s | — | image $0.002 each; video $0.01/s |
| `grok-imagine-video-1.5` | $0.08/s | $0.14/s | $0.25/s | image $0.01 each; preset-voice audio input free |

- Sources: [docs.x.ai grok-imagine-video](https://docs.x.ai/developers/models/grok-imagine-video); [docs.x.ai grok-imagine-video-1.5](https://docs.x.ai/developers/models/grok-imagine-video-1.5)
- Both models are limited to 10 requests/s. The Video Extension API is on promotional pricing — [docs.x.ai](https://docs.x.ai/developers/models/grok-imagine-video-1.5)
- The xAI API landing page uses the "SpaceXAI API" title and quotes video "from $0.08/sec" for 1.5 — [x.ai/api](https://x.ai/api)
- Imagine Video 1.5 is out of preview and GA as `grok-imagine-video-1.5` — [xAI news](https://x.ai/news/grok-imagine-video-1-5)

Capabilities:
- The generation modes share `/v1/videos/generations`. Edit and extend have dedicated endpoints.
- 1.5 supports reference-to-video (reference images and/or a preset voice).
- Last-frame pinning interpolates from a first image to the pinned last frame.
- `keyframes` takes up to 4 `{image, timestamp_s}` entries on a 1/3-second grid.
- Source: [docs.x.ai video generation](https://docs.x.ai/developers/model-capabilities/video/generation)
- Wrapper-reported limits:
  - Reference-to-video: 1–7 reference images, 1–15 s, at 480p or 720p.
  - Edit: output capped at 8.7 s.
  - Extend: continues a 2–15 s clip by 2–10 s.
  - Sources: [Atlas Cloud R2V](https://www.atlascloud.ai/models/xai/grok-imagine-video-v1.5/reference-to-video); [Atlas Cloud edit](https://www.atlascloud.ai/models/xai/grok-imagine-video/edit-video); [Replicate extension](https://replicate.com/xai/grok-imagine-video-extension)

**Black Forest Labs — FLUX 3 Video**

Launch:
- Announced on 2026-07-23 with gated early access. It became a paid API around 2026-08-04, with a dashboard and partner platforms — [MLQ.ai](https://mlq.ai/news/black-forest-labs-opens-flux-3-video-api-for-20-second-full-hd-clips/); [llm-stats](https://llm-stats.com/blog/research/flux-3-video-launch)

Price — [BFL model page](https://bfl.ai/models/flux-3-video); [BFL pricing docs](https://docs.bfl.ml/quick_start/pricing):

| Mode | HD (720p) | 1080p | 2K | 4K |
|---|---|---|---|---|
| Text-/image-to-video | $0.17/s | $0.29/s | $0.40/s | $0.80/s |
| Video-to-video (continue/extend/edit) | from $0.41/s | — | — | $0.95/s |

- A draft tier costs $0.06/s, and "Draft Enhance" re-renders an approved draft at full quality.
- One credit is $0.01, and audio is included in the price.
- Text-/image-to-video runs 5–20 s. Continuation runs 5–15 s.
- Volume discounts and SLAs are available on request.
- Sources disagree on V2V HD/FHD: $0.41/$0.53 in the FAQ vs $0.43/$0.54 in the docs — [daily.dev review](https://daily.dev/posts/flux-3-review-2026-black-forest-labs-multimodal-video-model-priced-per-second-axkbr9d2z)
- Also sold through Runware and Vercel AI Gateway (from $0.06/s) — [Runware](https://runware.ai/flux-3-video); [Vercel AI Gateway](https://vercel.com/ai-gateway/models/flux-3-video)

**Meta — Muse Video**
- Early preview on 2026-07-07, alongside Muse Image ("coming soon to creators and in Meta AI").
- No public API and no release date as of late-September coverage.
- Meta's Model API page lists Muse Spark and Muse Image ($0.01/image) but no Muse Video.
- Sources: [OrcaRouter](https://www.orcarouter.ai/blog/muse-video-release-date-api-leak); [AIReiter](https://aireiter.com/blog/meta-muse-video); [Meta Model API](https://developer.meta.com/ai/products/meta-model-api/)

**Midjourney**
- No official self-serve public API as of July 2026. Generation happens only in Discord and the web app, and the terms of service prohibit automation — [Apiframe, Jul 2026](https://apiframe.ai/blog/best-midjourney-apis); [ImaginePro](https://platform.imaginepro.ai/midjourney-api); [Wireflow](https://www.wireflow.ai/blog/best-midjourney-api-tools-in-2026)
- Video Model V1 launched in June 2025 — [release timeline](https://hidekazu-konishi.com/entry/image_and_video_generation_model_release_timeline.html)

**Adobe Firefly**
- The Firefly API (Firefly Services) includes a video endpoint that produces a 5-second clip from text. The model is set by header, with the listed value `video1_standard` — [Firefly API reference](https://developer.adobe.com/firefly-services/docs/firefly-api/api/)
- Access is enterprise-only through sales, with no public price (community thread) — [Adobe Community](https://community.adobe.com/questions-404/does-adobe-firefly-ai-supports-text-to-video-api-calls-1639384)
- The web app offers partner models (Kling, Luma Ray, Runway Gen-4.5, Sora 2, Veo) per a 2026-07-18 check. There is no confirmation that these are available through the API — [Feisworld](https://www.feisworld.com/blog/adobe-firefly-video-generation-partner-models)

**Moonvalley (Marey)**
- No official API docs or pricing were found. The only results were thin, templated comparison pages listing "Public API ✗, Webhooks ✗". Weak evidence — [NeuronFeed](https://neuronfeed.com/compare/lovescape-vs-moonvalley)

**Lightricks — LTX (hosted API and open weights)**

Prices — [LTX API pricing](https://ltx.io/model/api/pricing):

| Model | 720p | 1080p | 1440p | 4K |
|---|---|---|---|---|
| LTX-2.5 Fast | $0.09/s | $0.13/s | $0.19/s | $0.30/s |
| LTX-2.5 Pro | $0.12/s | $0.17/s | $0.25/s | $0.39/s |

- Some reviews say Pro stops at 1080p.
- Audio-to-video is billed by input audio duration. There are no per-request fees. Auto-duration jobs hold credit for the maximum clip length and release the rest — [LTX pricing explainer](https://ltx.io/blog/ltx-api-pricing-explained)
- LTX-2.3 Fast costs $0.03/s at 720p — [AIReiter](https://aireiter.com/blog/ltx-2-5-api-pricing-guide)
- Open weights are free to self-host for entities under about $10M annual revenue — [The Rundown](https://www.therundown.ai/tools/ltx-2)

**Pika**
- Pika has pivoted to an aggregator API: the "Pika API Club" at dev.pika.art, at $10/month, with 70+ models on one key (press, 2026-08-04) — [Las Vegas Sun](https://lasvegassun.com/news/2026/aug/04/pika-cuts-ais-3x-markup-to-nearly-zero-with-a-10-a/)
- Pika's pricing page lists most models at $0.04/s for 720p and $0.06/s for 1080p. Default limits are 60 requests/min and 10 concurrent jobs, with volume discounts above 10k seconds/month — [Pika pricing](https://mcp.pika.art/pricing)
- Pika 2.5 makes 5 s clips at 720p or 1080p (reseller guide) — [Apiframe Pika guide](https://apiframe.ai/guides/pika-labs-api-guide)

**Avatar / talking-head video**

HeyGen:
- The API uses a prepaid wallet from $5. Free API credits ended in February 2026.
- Avatar video costs $0.0167/s (Avatar III Digital Twin) to $0.0667/s (Avatar V).
- Photo Avatar IV/V is $0.05/s.
- Cinematic Avatar is $7 per clip.
- Translation is $1–$4 per source minute.
- Source: [RealtimeAvatar](https://realtimeavatar.ai/blog/heygen-api-pricing-explained); [G2](https://www.g2.com/articles/heygen-api-pricing)
- On OpenRouter, "HeyGen Video" (listed 2026-09-30, from $0.01/s, with no talking-head or lip-sync step) and "Avatar IV" are available — [OpenRouter HeyGen](https://openrouter.ai/heygen)

Synthesia:
- No published API per-minute rate.
- Sources disagree on whether API access needs Creator ($89/month) or Enterprise — [eesel](https://www.eesel.ai/blog/synthesia-pricing); [AutoGPT](https://autogpt.net/synthesia-api/)

Hedra:
- Pay-per-use API wallet, no free tier, and a free cost-estimate endpoint.
- 11 third-party models behind one key, with SDKs and an MCP server — [Hedra developer API](https://www.hedra.com/blog/hedra-developer-api)
- Hedra's 2026-09-25 cost test (10 s, 1080p, native audio, from a start frame) — [Hedra blog](https://www.hedra.com/blog/video-model-api-cost-comparison):

| Model | Cost per clip |
|---|---|
| LTX-2.3 Fast | $0.60 |
| Seedance 1.5 Pro | $1.13 |
| Kling V3 Pro | $1.68 |
| Wan 3.0 | $2.00 |
| Seedance 2.0 | $5.27 |
| Seedance 2.5 | $7.91 |

  - That is a 13x spread for the same output spec.
  - Veo 3.1 caps at 8 s, and MiniMax H3 has no 1080p setting.

### Inferences
- **Capability standards emerging in Oct 2026:**
  1. T2V and I2V: universal.
  2. First/last frame: Veo, Grok 1.5, Omni 1.1, OpenRouter `frame_images`.
  3. **Multiple reference images / "ingredients"**: Veo (3), Grok 1.5 (1–7), Omni, Runway (Omni on Runway up to 10), OpenRouter `input_references`.
  4. **Keyframes beyond first/last**: Grok (4), Luma (16–64), Aleph (5).
  5. **Extend**: Veo, Omni, Grok, FLUX 3.
  6. **Video edit / V2V**: Aleph 2.0, Omni, Grok, FLUX 3, Luma.
  7. Native audio, plus audio or voice references: Grok preset voices, Omni, Seedance through OpenRouter.
  8. **Draft tiers plus an upscale or "enhance" step**: FLUX Draft Enhance, Omni 360p prototyping with 4K upscale, Luma 360p draft, Veo 1080p/4K upscaling.
- **Gaps against videogen:** reference images, extend, V2V edit, keyframes and draft-then-upscale are each supported by at least 3–4 international vendors. These are now standard rather than niche.
  - The keep/reject gallery is a natural place for "extend this", "edit this" and "upscale this" actions.
  - CSV/template batch import could gain `ref_image_1..n` columns.
- **Direct-provider gaps worth weighing:**
  - xAI direct: top-5 quality, cheapest per second among the leaders at $0.05–$0.14 for 720p, plus edit, extend and keyframes.
  - BFL direct: FLUX 3 draft at $0.06/s and Draft Enhance.
  - Runway Dev: Aleph V2V, and the Media Router as a meta-provider.
  - Luma Agents API: keyframes and HDR.
  - LTX API: cheapest 1080p/4K, and open weights.
  - Vertex AI: enterprise Veo GA IDs and the cloud-storage output path.
- Low priority: Midjourney, Meta Muse, Utopai X and Moonvalley (no public API), and Adobe (sales-gated).
- Avatar/talking-head providers (HeyGen, Synthesia, Hedra Character) use script-, voice- and avatar-centric request shapes. That is a different product axis from shot-based batch generation. HeyGen Video's #1 OpenRouter usage rank suggests demand for it, but videogen already reaches it through OpenRouter.

### Gaps
- Official per-second pricing pages for Google, Runway, BFL and Luma could not be opened, so the numbers come from search extracts and third-party reproductions.
- These are unconfirmed:
  - Omni per-resolution GA prices
  - Runway Gen-4.5's exact max duration and resolution on the API
  - Luma Ray 3.2 4K/HDR prices
  - Synthesia API pricing
- Moonvalley Marey: no primary-source API information found.
- Grok's exact REST paths for edit and extend were not visible. Sources also conflict on last-frame support on 1.5 (official docs say yes; Vercel's older page says it is ignored).
- No primary source was found for the Gemini Omni regional restrictions (EEA/CH/UK) on uploaded-video edit and extend.

---

## 4. Batch/discounted async APIs, webhooks/callbacks, idempotency keys, result-retention guarantees

### Takeaway
No major international video vendor was found offering a discounted batch API for video. Google's 50% Batch discount is documented for Gemini token models only, and one source says Omni Flash gets no batch discount. Vertex batch-prediction docs list text models only.

Webhooks are spreading through aggregators:
- OpenRouter has `callback_url` with HMAC signing.
- Luma's legacy Dream Machine API has `callback_url`.
- Wrapper platforms (Runware, Apiframe) offer webhooks.
- No official webhook was found for the Runway or Gemini Veo APIs.

Idempotency keys are essentially absent from first-party video APIs. Result retention is short: Runway URLs last 24–48 h and Gemini API Veo files about 2 days (third-party). Auto-download is therefore a requirement rather than a convenience.

### Cited Findings
- **Batch:**
  - The Gemini Batch API offers "a 50% discount compared to the standard API" for asynchronous non-urgent requests — [Gemini cookbook, Batch mode](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Batch_mode.ipynb)
  - Google Cloud's pricing footnote scopes that discount to "Gemini models". The Veo table shows only standard rates ($0.40 or $0.60 per count), with an unexpanded "Show discount options" control — [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
  - An analysis of Gemini Omni Flash reports "no Batch API discount for this model" — [eesel](https://www.eesel.ai/blog/gemini-omni-flash-pricing)
  - Vertex batch-prediction docs found cover text-only partner models (Llama, gpt-oss, Qwen, DeepSeek, embeddings). No Veo appears — [Vertex Llama batch](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/llama-batch)
  - Volume discounts exist instead of batch APIs: BFL offers volume discounts and SLAs on request, and Pika discounts above 10k s/month — [BFL](https://bfl.ai/models/flux-3-video); [Pika pricing](https://mcp.pika.art/pricing)
- **Webhooks:**
  - OpenRouter's video API accepts `callback_url`.
    - It must be HTTPS and overrides the workspace default.
    - A signing secret adds an `X-OpenRouter-Signature` header, to be verified on the raw body.
    - Deliveries can repeat, so handlers must dedupe.
    - Source: [OpenRouter video generation docs](https://openrouter.ai/docs/guides/overview/multimodal/video-generation); [OpenRouter tutorial](https://openrouter.ai/blog/tutorials/video-generation-api/)
    - Event names `video.generation.completed` / `failed` and HMAC-SHA256 come from a third-party integration issue — [TanStack/ai #707](https://github.com/TanStack/ai/issues/707)
    - OpenRouter's Aleph 2.0 API page lists `callback_url` as a request field — [OpenRouter Aleph 2.0](https://openrouter.ai/runway/aleph-2)
  - Luma's Dream Machine API takes `callback_url` and POSTs the Generation object, with 3 retries 100 ms apart and a 5 s timeout — [Luma changelog: Callbacks](https://docs.lumalabs.ai/changelog/callbacks-and-credits-balance). The newer Luma Agents API docs show polling only — [Luma Agents quickstart](https://docs.agents.lumalabs.ai/)
  - No official Runway webhook documentation was found. Wrappers add their own: Apiframe `webhook_url`, Runware `webhookURL` — [Apiframe Gen-4.5](https://apiframe.ai/models/runway-gen4.5); [Runware webhooks](https://runware.ai/docs/models-api/webhooks)
- **Idempotency:**
  - The only video-specific idempotency header found is in Comfy Router's Kling endpoints ("reuse on retries") — [Comfy docs](https://docs.comfy.org/development/comfy-router/models/kling/kling-video-o1/code)
  - The IETF Idempotency-Key draft is at -07 (2025-10-15) — [IETF draft](https://greenbytes.de/tech/specs/draft-ietf-httpapi-idempotency-key-header-07.html)
  - No Google, Runway, xAI, Luma, BFL or OpenRouter video idempotency key was found in search results.
- **Retention:**
  - Runway output URLs expire within 24–48 h. "Do not expose them directly in your product" — [Runway outputs](https://docs.dev.runwayml.com/assets/outputs/)
  - Gemini API Veo outputs are stored for about 2 days. Each extension counts as a new generation with its own 2-day window (third-party; not seen on Google's pages) — [MindStudio](https://www.mindstudio.ai/blog/what-is-google-veo-3-1-flagship-video); [Apiyi](https://help.apiyi.com/en/veo-3-1-extend-video-api-guide-en.html)
  - Vertex AI outputs can be written into the customer's own Google Cloud environment — [MindStudio](https://www.mindstudio.ai/blog/what-is-google-veo-3-1-flagship-video)
  - Gemini Omni stored interactions (needed for follow-up edits) are kept 55 days on paid tiers and 1 day on free (third-party guide) — [Agentpedia](https://agentpedia.codes/blog/gemini-omni-flash-developer-guide)
  - OpenRouter BYOK: "A video provider keeps the generated video until you download it". A ZDR declaration does not cover video generation, and a ZDR-enforcing guardrail blocks video models on your key — [OpenRouter BYOK docs](https://openrouter.ai/docs/guides/overview/auth/byok)
  - kie.ai (a reseller) keeps videos 14 days — [kie.ai Runway quickstart](https://docs.kie.ai/runway-api/quickstart)
- **Cost pre-flight endpoints are spreading:**
  - Hedra's free estimate endpoint returns the exact price of a request body — [Hedra](https://www.hedra.com/blog/hedra-developer-api)
  - Runway's Media Router has a dry run — [TechCrunch](https://techcrunch.com/2026/07/23/runway-bets-on-ai-model-routing-as-generative-media-gets-crowded/)
  - OpenRouter's models listing exposes pricing and allowed values per model — [OpenRouter cookbook](https://openrouter.ai/docs/projects/docs/cookbook/video-generation/choose-video-model)

### Inferences
- Provider batch APIs are a low-value gap for videogen today: none of the major international video APIs found discount batch video. Videogen's client-side queue with lanes is the practical "batch" layer.
- Webhooks matter little to a local-first desktop app with no public endpoint, where polling is fine. They become relevant only for a future server or headless deployment. If built, signature verification and dedupe are needed because OpenRouter redelivers.
- Short retention (24–48 h on Runway, about 2 days on Gemini) confirms that videogen's crash-safe queue plus auto-download is a real differentiator. A queue resumed after a long outage could find results expired, so the UI should surface an "expired before download" state.
- Because no vendor offers idempotency keys, videogen's own job-level dedupe (for example, not resubmitting a paid job after a crash between submit and persist) is the only protection against double-billing.
- Live pricing and allowed values from OpenRouter's `/api/v1/videos/models` could feed videogen's cost estimates. Hedra- and Runway-style "estimate" or "dry run" endpoints show the market expects pre-flight cost checks.

### Gaps
- Whether the Google Cloud "Show discount options" control reveals any Veo batch or flex price is unknown, since the page was not expanded.
- No official confirmation was found of the Gemini API's 2-day Veo retention. Whether Gemini API long-running operations support push notifications or webhooks is unverified (the search budget ran out before this query).
- xAI, BFL and LTX webhook and retention policies were not found.

---

## 5. OpenRouter video generation API: what's been added since launch

### Takeaway
OpenRouter launched `/api/v1/videos` in mid-April 2026, with the blog post dated 2026-04-15 and press coverage on 2026-04-16 and 04-22. It launched with about 4 model families: Veo 3.1, Seedance 2.0/1.5, Wan 2.6/2.7 and Sora 2 Pro.

Since then it has added:
- a unified schema with `frame_images` (first/last) and `input_references` (reference-to-video, including audio and video references for supporting providers)
- `callback_url` webhooks with signed deliveries and a workspace default
- a `/api/v1/videos/models` capability and pricing endpoint
- Python SDK support
- Kling, Runway (Gen-4.5 and Aleph 2.0 edit), xAI Grok Imagine, HeyGen (Video and Avatar IV, 2026-09-30), Veo 3.1 Lite and Seedance 2.5

BYOK is documented for video only in ZDR caveats. No video batch API was found.

### Cited Findings
- Launch post "Announcing Video Generation" was first published 2026-04-15 and updated 2026-06-24.
  - "We provide one schema that works across every model, including resolution, duration, aspect ratio, audio gen, frame images, and reference images."
  - Initial models: Seedance 2.0/1.5, Veo 3.1, Wan 2.7/2.6, Sora 2 Pro.
  - Source: [OpenRouter blog](https://openrouter.ai/blog/announcements/video-generation/)
- Press dated the launch to 2026-04-16 (UTC+8) — [KuCoin](https://www.kucoin.com/news/flash/openrouter-launches-video-generation-api-integrating-sora-2-veo-3-1-seedance). A Japanese write-up says 2026-04-22, counting Sora 2 Pro, Veo 3.1 / 3.1 Fast, Wan 2.6/2.7 and Seedance 2.0/1.5, with Kling Video O1 added shortly after — [note.com](https://note.com/lucky_allium8251/n/n87f100b52a20?hl=en)
- The same write-up said OpenRouter adds no markup to provider prices. Its May 2026 reference prices: Veo 3.1 with audio about $0.40/s, Seedance 2.0 about $0.14/s, and Sora 2 Pro "about $0.10/s". The Sora figure conflicts with OpenAI's $0.30+/s list price — [note.com](https://note.com/lucky_allium8251/n/n87f100b52a20?hl=en)
- Flow: POST `/api/v1/videos` returns a job ID, which you poll before downloading the MP4. Durations differ by model (Veo 3.1 takes 4/6/8 s, Wan 2.6 takes 5/10 s), and an unsupported value returns an error — [OpenRouter tutorial](https://openrouter.ai/blog/tutorials/video-generation-api/)
- `frame_images` entries need `frame_type: first_frame | last_frame`. `input_references[]` uses the same entry shape without `frame_type`. When both are present, `frame_images` wins — [OpenRouter video docs](https://openrouter.ai/docs/guides/overview/multimodal/video-generation); [Reference-to-video cookbook](https://openrouter.ai/docs/projects/docs/cookbook/video-generation/reference-to-video)
- Audio and video references are honored only by providers that support them (for example BytePlus Seedance 2.0 and later). Others use image references and ignore the rest — [OpenRouter video docs](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- A third-party integration reports that `input_references` accepts only public HTTPS URLs — [NodeTool PR #5946](https://github.com/nodetool-ai/nodetool/pull/5946). Providers can't fetch URLs behind redirects or bot checks. A third-party integration issue quotes this as an OpenRouter warning; the search extract did not show whether it was [PraisonAI #5173](https://github.com/MervinPraison/PraisonAI/issues/5173) or [TanStack/ai #707](https://github.com/TanStack/ai/issues/707)
- `callback_url` webhooks with an `X-OpenRouter-Signature` header and redelivery semantics — [OpenRouter video docs](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- The models listing endpoint reports per-model resolutions, durations, aspect ratios, pricing and model-specific parameters, and OpenRouter calls it the source of truth — [Choose a video model](https://openrouter.ai/docs/projects/docs/cookbook/video-generation/choose-video-model)
- The Python SDK has a `VideoGeneration` module — [OpenRouter Python SDK](https://openrouter.ai/docs/client-sdks/python/sdks/videogeneration/README). There is also an official "openrouter-video" agent skill — [OpenRouter skills](https://openrouter.ai/skills/openrouter-video)
- Shared `ProviderOptions` schema across `/audio/speech`, `/audio/transcriptions`, `/images` and `/videos` (undated changelog entries) — [OpenRouter changelog](https://openrouter.ai/docs/changelog); "every modality, one API" positioning — [OpenRouter blog](https://openrouter.ai/blog/insights/every-modality-one-api/)
- Model catalog growth:
  - The collection page shows "10 models, ranked by top weekly usage. Top models: HeyGen Video, Veo 3.1 Lite, and Seedance 2.5" — [OpenRouter video collection](https://openrouter.ai/collections/video-models)
  - A cookbook example lists 13 slugs — [Choose a video model](https://openrouter.ai/docs/cookbook/video-generation/choose-video-model)
  - Kling v3.0 Pro is #10 in video rankings with 10K requests — [OpenRouter video rankings](https://openrouter.ai/rankings/video)
  - Videogen's own catalog snapshot reports about 26 models (client brief, not independently verified).
- Model additions:
  - Kling v3.0 Std: 3–15 s, 16:9 / 9:16 / 1:1, from $0.126/s — [OpenRouter Kling v3.0 Std](https://openrouter.ai/kwaivgi/kling-v3.0-std/api)
  - Runway Gen-4.5 at $0.12/s and Aleph 2.0 at $0.28/s. The Aleph listing says it takes "text, images, and video" as input, but its API page shows only `input_references` (images), `seed` and `callback_url`. Video-input support is unresolved — [OpenRouter Runway](https://openrouter.ai/runway); [OpenRouter Aleph 2.0](https://openrouter.ai/runway/aleph-2)
  - A May 2026 article said Runway, Pika and Luma were "not yet supported", so Runway was added after May — [note.com](https://note.com/lucky_allium8251/n/n87f100b52a20?hl=en)
  - HeyGen Video (listed 2026-09-30, from $0.01/s) and Avatar IV — [OpenRouter HeyGen](https://openrouter.ai/heygen)
  - xAI Grok Imagine Video — [OpenRouter Grok Imagine Video](https://openrouter.ai/x-ai/grok-imagine-video)
- BYOK: the BYOK guide covers video only to say that ZDR does not cover video generation and that ZDR guardrails block video models on your key. No announcement of BYOK for video was found — [OpenRouter BYOK](https://openrouter.ai/docs/guides/overview/auth/byok)
- The cookbook warns that every submission is a billable job and recommends previewing requests first — [OpenRouter text-to-video cookbook](https://openrouter.ai/docs/cookbook/text-to-video)

### Inferences
- Videogen's OpenRouter provider most likely lacks:
  1. `input_references` (reference-to-video, including audio and video references for Seedance)
  2. `callback_url`
  3. the Aleph 2.0 edit model (if video input works)
  4. HeyGen Avatar IV
  5. reading live pricing and allowed values from `/api/v1/videos/models` into cost estimates and form validation
- Item 1 is the highest-leverage gap, because one schema field unlocks reference-to-video across Veo, Seedance, Kling, Grok and others at once.
- The public-HTTPS-URL requirement for `input_references` (third-party report) conflicts with videogen's local-first model, since local images would need hosting or data URIs. Data-URI support for `input_references` needs testing.
- OpenRouter's catalog now overlaps heavily with direct APIs. Direct integrations make sense only where OpenRouter lacks features (edit, extend, keyframes, draft tiers) or prices differ.

### Gaps
- The live `/api/v1/videos/models` JSON could not be retrieved (proxy 403), so the exact current model count, per-model `input_references` support and whether any model accepts video input are unverified.
- No dated changelog entries were found for when `input_references` or `callback_url` were added. Both were present by the 2026-06-24 blog update at the latest (inference from the update date).
- Whether BYOK works for video provider keys (Google, BytePlus and others) is undocumented in what was found.
- No OpenRouter video batch API or idempotency key was found.

---

## 6. Per-second price movement, 2025 → Oct 2026

### Takeaway
Top-quality list prices fell roughly 5–7x in about 15 months. Veo 3 with audio cost $0.75/s in mid-2025. The October 2026 quality leader, Gemini Omni Flash, costs about $0.10/s at 720p, and Grok Imagine 1.5 costs $0.14/s at 720p.

Pricing also split into three bands:
- **Draft** at $0.01–$0.06/s: Luma 360p draft about $0.012/s, Omni 360p about $0.034/s, Veo 3.1 Lite without audio $0.03/s, FLUX 3 draft $0.06/s
- **Mainstream 720p/1080p** at $0.05–$0.29/s
- **Premium/4K** at $0.30–$0.80/s

Premium flagship pricing at 1080p has not fallen: Veo 3.1 Standard is still $0.40/s.

### Cited Findings
- **2025 data points:**
  - In September 2025, Google cut Veo 3 with audio from $0.75/s to $0.40/s and Veo 3 Fast from $0.40/s to $0.15/s. Without audio: Veo 3 $0.20/s, Fast $0.10/s. 1080p and 9:16 were added at the same time — [Google Developers Blog](https://developers.googleblog.com/veo-3-and-veo-3-fast-new-pricing-new-configurations-and-better-resolution/); [The Decoder](https://the-decoder.com/google-veo-3-adds-1080p-916-video-and-drops-prices-by-half/)
  - Sora 2 API (from October 2025): `sora-2` $0.10/s at 720p; `sora-2-pro` $0.30/s at 720p and $0.50/s at 1024p — [eesel, 2025](https://www.eesel.ai/blog/sora-2-in-the-api-pricing)
  - Luma Dream Machine API (Ray 2), reported per clip: about $0.60 per 5 s Ray 2 Flash 720p (about $0.12/s), and about $0.95–$1.05 per 5 s Ray 2 at 1080p or 4K. These figures are labeled "reported, not official" by a guide about 90 days old. The search extract did not show which of these pages it came from: [Apiframe Luma guide](https://apiframe.ai/guides/luma-api-guide) or [WaveSpeed Luma pricing](https://wavespeed.ai/blog/cost-and-billing/luma-ai-pricing/)
  - Runway Gen-4.5 at launch (Dec 2025) was quoted at up to 25 credits/s ($0.25/s) in some guides. It is now 12 credits/s ($0.12/s) — [Sume](https://www.sume.com/blog/runway-credits-per-video); [eesel Runway](https://www.eesel.ai/blog/runway-ai-pricing)
- **2026 data points:**
  - Veo 3.1 Lite (2026-03-31): $0.05/s at 720p, $0.08/s at 1080p, $0.03/s without audio — [Gemini API release notes](https://ai.google.dev/gemini-api/docs/changelog); [CostGoat](https://costgoat.com/pricing/google-veo)
  - Veo 3.1 Fast: $0.10/$0.12/$0.30 (720p/1080p/4K). Standard: $0.40/$0.40/$0.60 — [invideo, Aug 2026](https://invideo.io/blog/ai-video-model-pricing/)
  - Gemini Omni Flash: about $0.10/s at 720p. Reported GA per-resolution rates: $0.034 (360p), $0.152 (1080p), $0.304 (4K) — [eesel](https://www.eesel.ai/blog/gemini-omni-flash-pricing); [eesel 1.1](https://www.eesel.ai/blog/gemini-omni-1-1-flash-pricing)
  - Grok Imagine Video: $0.05–$0.07/s. Version 1.5: $0.08/$0.14/$0.25 — [docs.x.ai](https://docs.x.ai/developers/models/grok-imagine-video-1.5)
  - FLUX 3 Video (Aug 2026): $0.17–$0.80/s, with a $0.06/s draft tier — [BFL](https://bfl.ai/models/flux-3-video)
  - LTX-2.5 Fast: $0.09–$0.30/s. LTX-2.3 Fast: $0.03/s at 720p — [LTX pricing](https://ltx.io/model/api/pricing); [AIReiter](https://aireiter.com/blog/ltx-2-5-api-pricing-guide)
  - Luma Ray 3.2: about $0.06/s at 720p and about $0.24/s at 1080p — [Luma pricing docs](https://docs.agents.lumalabs.ai/guides/pricing/)
  - Pika aggregator API: most models $0.04/s at 720p, $0.06/s at 1080p — [Pika pricing](https://mcp.pika.art/pricing)
  - HeyGen Video on OpenRouter: from $0.01/s — [OpenRouter HeyGen](https://openrouter.ai/heygen)
  - Kling v3.0 Std on OpenRouter: from $0.126/s — [OpenRouter](https://openrouter.ai/kwaivgi/kling-v3.0-std/api)
  - Wan 3.0 on AA: $12.00/min, which is $0.20/s — [OrcaRouter citing AA](https://www.orcarouter.ai/de/blog/utopai-x-debut)
  - invideo's August 2026 survey found the cheapest official price at $0.02/s (Pruna) and the highest at $0.70/s (Sora 2 Pro), a 35x gap. Billing comes in five units: per second, credits, tokens, per video and metered inputs. MiniMax-H3 2K costs about $0.13/s — [invideo](https://invideo.io/blog/ai-video-model-pricing/)
  - Hedra (2026-09-25): a 13x spread for an identical 10 s 1080p clip with audio, from $0.60 to $7.91 — [Hedra](https://www.hedra.com/blog/video-model-api-cost-comparison)

### Inferences
- **Trajectory, from the data above:**
  - Leader-quality 720p fell from $0.75/s (Veo 3, mid-2025) to $0.40/s (Veo 3, Sept 2025) to about $0.10–$0.14/s (Gemini Omni Flash and Grok 1.5, Q3 2026).
  - The cheapest usable tier fell from about $0.10/s (Veo 3 Fast without audio, Sora 2, Sept–Oct 2025) to $0.01–$0.05/s in 2026.
  - 4K became a priced tier at $0.30–$0.80/s.
- **Implications for videogen's budgets and cost estimates:**
  - Price rules need resolution × audio × tier × mode (T2V, V2V, extend) dimensions, because V2V costs about 2.4x T2V on FLUX.
  - Some prices are token-based (Gemini Omni) or credit-based (Runway).
  - Some vendors round partial seconds up (BFL) or bill by input duration (LTX audio-to-video, Grok edit).
  - A static price table goes stale within weeks, so pulling live prices (OpenRouter models endpoint) plus a date-stamped fallback table is warranted.
- The emergence of draft tiers suggests a "draft batch, then promote keepers to full quality or upscale" workflow. That fits videogen's batch, gallery and keep/reject design, and would require extend, upscale or "enhance" endpoints.

### Gaps
- No official 2025 Runway API rate card was retrieved to confirm the 25 → 12 credits/s change. It is supported only by third-party guides.
- Exact date and price of the Veo 3 launch on the Gemini API ($0.75/s) come from the September 2025 price-cut posts. The original launch date (around July 2025) was not separately verified.
- Omni per-resolution GA prices come from a single third-party source.
- Several price points are reseller or aggregator figures, which can carry markup (one report says resellers quote 2–3x over official rates).
