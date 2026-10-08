# Competitive landscape: tools and platforms for AI video generation at volume (batch, multi-model, workflow), October 2026

_All sources were accessed on 2026-10-08 unless a bullet says otherwise. GitHub star, fork and last-push figures come from the GitHub search API, queried around 05:00 UTC on 2026-10-08. Several vendor pages could not be fetched directly from this environment because of DNS failures: fal.ai, openrouter.ai, kie.ai, openart.ai and teamday.ai. For those vendors, the figures come from search-engine extracts of the pages, or from third-party reviews that cite them, and are labelled as such. Pricing for AI video changes monthly, so read every price as a snapshot._

---

## Q1. Aggregator and inference APIs that resell many video models (fal.ai, Replicate, WaveSpeedAI, Kie.ai, Runware, PiAPI, AI/ML API, EachLabs, Segmind, Together, OpenRouter)

### Takeaway
Aggregators fall into three groups:
- **Official-price, developer-grade platforms:** fal, Replicate and OpenRouter. They offer a queue or async jobs, webhooks or polling, and per-second billing. fal and Replicate are launch partners for the major models, such as Veo 3.1 at Google's list price.
- **Discount relays:** Kie.ai, WaveSpeed, APIMart and similar. They claim to be 20–60% below official prices on some models, but not all.
- **Long-tail catalogs:** PiAPI, AI/ML API, Segmind and EachLabs. Their video depth is poorly documented.

None of them exposes a truly OpenAI-identical video API across vendors. OpenRouter uses its own `/api/v1/videos` job API. Seedance, Kling and MiniMax use asynchronous protocols that do not map cleanly onto OpenAI's video API.

### Cited Findings

**fal.ai**
- fal sells prepaid credits drawn down per output, billing video per second. Its own guide lists Veo 3.1 Fast at $0.10/s and Standard at $0.20/s. One review lists Kling 3.0 Pro at $0.112/s without audio, and Wan 3 at $0.05–0.20/s depending on resolution. Reviews say adding audio roughly doubles the price on most models. — [fal guide: image-to-video generators](https://fal.ai/learn/tools/ai-image-to-video-generators); [Fal.ai review 2026 (aireiter)](https://aireiter.com/blog/fal-ai-review-2026); [BuildFastWithAI fal review](https://www.buildfastwithai.com/ai-tools/fal-ai)
- Queue time and failed generations are not billed on shared model endpoints. Dedicated serverless GPU deployments bill by the GPU-second. — [aiphotolabs fal review](https://aiphotolabs.com/reviews/fal-ai-review)
- Async support covers webhook callbacks, request IDs, status polling, logs and retries. Wireflow, which sells a competing product, calls fal's queue-plus-webhook pattern "the cleanest single-endpoint integration". It notes that chaining steps such as keyframe → video → upscaler is left to the developer. — [Wireflow: Seedance pricing, 8 platforms compared](https://www.wireflow.ai/blog/seedance-pricing-compared-2026)
- Seedance 2.0 on fal: $0.3034/s at standard 720p and $0.2419/s at Fast 720p, per a competitor's comparison. — [Wireflow](https://www.wireflow.ai/blog/seedance-pricing-compared-2026)
- A September 2026 comparison says fal's price for Kling v3 Pro without audio is half of Replicate's. — [TeamDay: AI Image & Video API Providers (Sep 2026)](https://www.teamday.ai/blog/ai-image-video-api-providers-comparison-2026) (seen only as a search extract; the page did not load)
- A 2026 listicle names fal "the best API service for media". — [Overchat: Best AI API services](https://overchat.ai/ai-hub/best-ai-api-services)

**Replicate**
- Replicate announced that it is joining Cloudflare, and says existing APIs and workflows keep working. — [Replicate blog](https://replicate.com/blog/replicate-cloudflare); [Cloudflare blog](https://blog.cloudflare.com/replicate-joins-cloudflare/)
- Webhooks are set per prediction. A `webhook_events_filter` takes start, output, logs and completed. Only terminal-state webhooks are retried, with exponential backoff, and redirects are not followed. — [Replicate docs: receive webhooks](https://replicate.com/docs/topics/webhooks/receive-webhook); [Replicate docs: set up webhooks](https://replicate.com/docs/topics/webhooks/setup-webhook)
- September 2026 prices on Replicate:
  - Kling v3 Pro: $0.224/s without audio, $0.336/s with audio.
  - Veo 3.1: $0.20/s without audio, $0.40/s with audio.
  - Veo 3.1 Lite: $0.05/s.
  - Seedance 2.0 720p: $0.18/s, against about $0.15/s from BytePlus directly and about $0.30/s on fal.

  The same comparison says Google offers Veo 3.1 directly and on fal and Replicate at the same standard price. — [TeamDay Sep 2026 comparison](https://www.teamday.ai/blog/ai-image-video-api-providers-comparison-2026) (search extract)
- Seedance 2.5 on Replicate costs $0.2312/s at 720p, which matches BytePlus ModelArk's launch token rate. Seedance 2.5 launched on 2026-07-31. — [CellCog: Seedance 2.5 pricing](https://cellcog.ai/blog/seedance-2-5-pricing/)

**OpenRouter**
- OpenRouter launched a video generation API in April 2026. Reports give 16 April ([KuCoin/ME News](https://www.kucoin.com/news/flash/openrouter-launches-video-generation-api-integrating-sora-2-veo-3-1-seedance)) or 22 April ([note.com](https://note.com/lucky_allium8251/n/n87f100b52a20?hl=en)). Day-one models were Seedance 2.0/1.5, Veo 3.1, Wan 2.7/2.6 and Sora 2 Pro. — [OpenRouter announcement](https://openrouter.ai/blog/announcements/video-generation/) (search extract)
- The API shape is `POST /api/v1/videos`, then polling the job, then downloading the MP4. `GET /api/v1/videos/models` returns each model's supported resolutions, durations, aspect ratios and pricing. Switching models mostly means changing the slug. — [OpenRouter code-first guide](https://openrouter.ai/blog/tutorials/video-generation-api/); [OpenRouter cookbook](https://openrouter.ai/docs/projects/docs/cookbook/video-generation/choose-video-model)
- A May 2026 reference says OpenRouter adds no markup to provider prices. Launch prices were about $0.10/s for Sora 2 Pro, $0.40/s for Veo 3.1 with audio, and $0.14/s for Seedance 2.0. — [note.com](https://note.com/lucky_allium8251/n/n87f100b52a20?hl=en)
- OpenRouter's video collection ranks models by weekly usage. The current leaders are HeyGen Video, Seedance 2.5 and Veo 3.1 Lite. Runway Gen-4.5 is also listed. — [OpenRouter video models collection](https://openrouter.ai/collections/video-models); [OpenRouter Runway Gen-4.5](https://openrouter.ai/runway/gen-4.5)

**Kie.ai (discount relay)**
- Kie's homepage compares its Veo 3.1 prices with official ones:

  | Veo 3.1 tier | Kie.ai | Official |
  |---|---|---|
  | Lite 1080p, per video | $0.175 | $0.64 |
  | Fast 1080p, per video | $0.325 | $0.96 |
  | Quality 1080p, per video | $1.275 | $3.20 |
  | Quality image-to-video 4K | $1.85 | $4.80 |

  Kie claims prices are typically 30–50% below official APIs. — [kie.ai homepage](https://kie.ai/) (search extract)
- Bitdoze describes Kie's Veo pricing as roughly 25% of Google's direct price. — [Bitdoze Kie guide](https://www.bitdoze.com/kie-ai-video-generation/)
- EggStriker says third-party relay prices generally track the official rate or run slightly above it, so Kie may be an outlier. EggStriker lists official Veo 3.1 Standard at $0.40/s for 1080p and $0.60/s for 4K, with audio included. — [EggStriker Aug 2026 price comparison](https://www.eggstriker.com/en/blog/ai-video-model-pricing-comparison-2026)
- Seedance 2.0 at 720p: Kie $0.205/s against WaveSpeed $0.24/s. This comes from Kinovi, a Kie competitor. — [Kinovi: Kie.ai alternatives](https://kinovi.ai/blogs/kie-ai-alternatives)
- Seedance 2.5 at 720p without video input, in a 2026-08-22 snapshot: Kie $0.315/s, WaveSpeed $0.36/s, Replicate (matching the official rate) $0.2312/s. On that snapshot the official rate is cheaper than both relays. — [CellCog](https://cellcog.ai/blog/seedance-2-5-pricing/)
- Kie retains generated media for 14 days and WaveSpeed for 7 days. Kie credits reportedly never expire. — [Kinovi](https://kinovi.ai/blogs/kie-ai-alternatives); [kie.ai](https://kie.ai/) (search extracts)

**WaveSpeedAI**
- Reported model counts conflict: 700+ ([ai-cmo](https://ai-cmo.net/tools/wavespeed-ai)), more than 1,000 ([aimojo](https://aimojo.io/tools/wavespeed-ai/)), and about 200 in an older listing.
- WaveSpeed is pay-as-you-go only. Reported rates are about $0.01/s for Wan 2.2 Ultra Fast, about $0.10/s for Sora 2, about $0.40/s for Veo 3.1, and $0.15/s for Veo 3.1 Fast (dated 2026-08-27). — [VibeDex WaveSpeed review](https://vibedex.ai/blog/wavespeed-ai-review-2026); [EggStriker WaveSpeed page](https://www.eggstriker.com/en/ai-api/wavespeed)
- Rate limits depend on top-up tier, and the sources conflict. Kinovi, a competitor, gives Bronze at 5 predictions/min and 2 concurrent, rising to 500/min and 300 concurrent after a top-up. A review gives Bronze at 10 images and 5 videos per minute with 3 concurrent. Failures from system errors are refunded automatically. — [Kinovi WaveSpeed alternatives](https://kinovi.ai/blogs/wavespeed-ai-alternatives); [VibeDex](https://vibedex.ai/blog/wavespeed-ai-review-2026)
- WaveSpeed's own blog claims webhook support and batch operations. A relay comparison reports REST and gRPC with webhook callbacks. I did not find official webhook or batch documentation. — [WaveSpeed blog](https://wavespeed.ai/blog/posts/best-deevid-ai-alternative-2026/); [EggStriker](https://www.eggstriker.com/en/ai-api/wavespeed)

**Runware**
- Billing is pay-as-you-go per clip or per second. Example rates:

  | Model | Rate |
  |---|---|
  | Grok Imagine Video 1.5 Lite, 480p | $0.02/s |
  | P-Video-2-Pro, 480p | $0.01/s |
  | Veo 3.1, 4 s at 1080p | $1.60 |
  | Kling 3.0 Pro, 6 s first-frame job | $0.672 |
  | Hailuo 2.3, 6 s at 1080p | $0.49 |

  — [Runware pricing](https://runware.ai/pricing); [Runware video generation](https://runware.ai/video-generation)
- Requests can carry an array of tasks, mixed modalities and a webhook per task. A "batch at half price" discount appears only on a third-party page (APIPod) and is unverified for Runware video. — [Runware docs](https://runware.ai/docs/platform/introduction); [APIPod Runware alternatives](https://www.apipod.ai/alternatives/runware)

**PiAPI, AI/ML API, EachLabs, Segmind, Together**
- **PiAPI:** more than 90 models, about 40 of them video. It offers Kling versions 1.0 through 3.0 Omni. Billing is credit top-up, pay per task, with no subscription. Prices run from about $0.08/s (SD Wan) to nearly $1/s (Kling professional mode). — [PiAPI on Miraheze AI wiki](https://ai.miraheze.org/wiki/PiAPI)
- **AI/ML API:** claims 400+ models under one key, including video. A listicle calls it the best general-purpose option and notes that it is OpenAI-compatible. — [AI/ML API blog](https://aimlapi.com/blog/best-ai-api-platforms-in-2026-compared-tested); [Overchat](https://overchat.ai/ai-hub/best-ai-api-services)
- **Together AI:** has added video generation, according to AI/ML API (a competitor). Pixazo calls its visual output thinner than specialist platforms. — [AI/ML API blog](https://aimlapi.com/blog/best-ai-api-platforms-in-2026-compared-tested); [Pixazo](https://www.pixazo.ai/blog/top-ai-image-video-generation-api-platforms)
- **Segmind:** private GPU clusters per project and auto-scaling. A reviewer calls its per-second billing pricey. **EachLabs:** ships a visual workflow builder and is aimed at experienced developers. I found no EachLabs video pricing. Both assessments come from a single review written by a competitor. — [Pollo: fal alternatives](https://pollo.ai/hub/best-fal-ai-alternatives)

**"OpenAI-compatible" video endpoints**
- **LLM Gateway** is the closest literal match to `/v1/videos`. It offers a job-creation POST, a status GET, a file GET and signed callbacks, across Veo, Seedance and Kling. — [LLM Gateway docs](https://docs.llmgateway.io/features/video-generation); [LLM Gateway blog](https://llmgateway.io/blog/generate-videos-api)
- **Bifrost** can unify video only over upstreams that are compatible with OpenAI's video API. An open feature request says Seedance, Kling and MiniMax use async protocols that do not fit that model. — [Bifrost issue #7004](https://github.com/maximhq/bifrost/issues/7004)
- **Atlas Cloud** offers one OpenAI-style key and base URL for Seedance 2.0 and Kling 3.0. It is not confirmed that this includes a `/v1/videos` route. **VideoRouter** advertises cross-provider failover. — [Atlas Cloud](https://www.atlascloud.ai/blog/tips/wan-2.7-vs-seedance-2.0-vs-kling-3.0-which-video-api-should-developers-choose); [VideoRouter](https://videorouter.sh/)
- A community project wraps the Dreamina (即梦) CLI as an OpenAI-protocol API, so users can spend their 即梦 membership credits from their own workflows. — [JimengCli_api](https://github.com/xiaozhichao2025/JimengCli_api)

### Inferences
- **Who developers default to.** In the English-language ecosystem the default is fal, with Replicate second:
  - Reviews and listicles favour fal.
  - fal and Replicate are named alongside Google's direct API at official Veo pricing.
  - Most n8n bulk-video templates call fal (see Q3).
  - OpenRouter is the fastest-growing "one key" option for teams already using it for LLMs.

  Chinese open-source tools mostly integrate official Chinese clouds (Volcengine Ark, DashScope) plus relays. Nomi lists APIMart, Kie.ai, Volcengine and ModelScope. Toonflow is sponsored by APIMart. MoneyPrinterTurbo supports WaveSpeed, MuAPI, OFox and 胜算云. See Q4.
- **Discounts are model-specific, not universal.** The deepest relay discounts are on Veo (Kie). On Seedance 2.5, BytePlus official or Replicate was cheaper than Kie and WaveSpeed in the August snapshot. A batch tool that shows each provider's price per row, as videogen's per-row estimate does, therefore has real value.
- **videogen's adapters skip the default developer endpoints.** The generic "OpenAI-compatible" adapter will not reach fal, Replicate, Kie, WaveSpeed or Runware, because each uses its own async job schema. Only LLM Gateway, and possibly AI/ML API, claim OpenAI-style video. A fal adapter, and possibly a Replicate adapter, would cover the de facto developer endpoints.
- **The aggregators already provide batch plumbing.** Webhooks, request IDs, retries and "failed jobs are not billed" are standard (fal, Replicate, Runware, WaveSpeed). videogen's crash-safe local queue adds value on top of these, not instead of them. It persists state across app restarts, which webhooks to a 127.0.0.1 app cannot easily do.

### Gaps
- I could not open the live pricing pages for fal, OpenRouter or Kie.ai (DNS failure). The fal and Kie figures come from search extracts and third-party reviews.
- I found no official documentation for WaveSpeed's webhook or batch API, or for its "pricing API".
- EachLabs, Segmind and Together AI have no verifiable video model list or price data in 2026 sources.
- Whether AI/ML API's video endpoints follow OpenAI's `/v1/videos` schema could not be verified.
- Market share or volume data showing which aggregator is the "de facto" choice does not exist publicly. The inference rests on review consensus and template usage.

---

## Q2. Multi-model creator platforms (Freepik/Magnific, Krea, Higgsfield, OpenArt, LTX Studio, Google Flow, Runway, Invideo, Hedra, Leonardo, Pollo, Artlist, Adobe Firefly, CapCut/Dreamina 即梦, Kling, plus LibTV and TapNow)

### Takeaway
Creator platforms are converging on the same feature set:
- multi-model catalogs
- credit-based subscriptions
- character or "ingredient" consistency
- storyboards or scene builders
- upscaling
- edit and extend
- increasingly, agents, MCP or CLI access (OpenArt MCP & CLI, the 即梦 CLI, Google's Flow Agent)

Spreadsheet-style batch is rare and usually manual. Freepik has no API, and one review says TapNow lacks batch.

Effective cost per second varies widely. Google Flow's bundled Veo credits can be several times cheaper per second than the Veo API for heavy users. Higgsfield's Cinema Studio and low-tier Runway plans cost more than the raw API.

### Cited Findings

**Google Flow (Veo 3.1 and Gemini Omni)**
- Plans:
  - Free: 50 credits per day.
  - Plus: $4.99/mo, 200 credits.
  - Pro: $19.99/mo, 1,000 credits.
  - Ultra: $99.99/mo for 10,000 credits, or $199.99/mo for 25,000. One guide instead lists Ultra at $249.99 for 25,000 credits.

  Credits do not roll over, and top-up packs of 2,500–20,000 credits are available. — [CostGoat: Google Flow pricing (Oct 2026)](https://costgoat.com/pricing/google-flow); [SaaSCRMReview](https://saascrmreview.com/google-flow-pricing/); [veo3ai.io](https://www.veo3ai.io/blog/veo-3-pricing-2026)
- Credits per generation:

  | Generation type | Most plans | Ultra |
  |---|---|---|
  | Veo 3.1 Lite | 10 | 5 |
  | Veo 3.1 Fast | 20 | 10 |
  | Veo 3.1 Quality | 100 | 100 |
  | Gemini Omni Flash, 4 s at 720p | 7 | — |
  | Gemini Omni Flash video edit | 40 | — |
  | 4K upscale | — | 50 |

  4K upscaling is an Ultra feature. — [CostGoat](https://costgoat.com/pricing/google-flow); [diyai.io](https://diyai.io/ai-tools/video-generation/google-veo-pricing/)
- Features:
  - Scenebuilder sequences clips.
  - "Ingredients" keep characters and visuals consistent, but are not available on Veo 3.1 Quality.
  - Clip extension works only on Veo 3.1 Lite.
  - Omni Flash can edit uploaded footage (up to 60 s and 1 GB per file, 10 s selection per edit).
  - A Flow Agent asks before spending credits, under daily quotas Google does not publish.

  — [SaaSCRMReview Flow review](https://saascrmreview.com/google-flow-review/); [tooldirectory.ai](https://tooldirectory.ai/tools/google-flow); [felloai](https://felloai.com/google-flow/)
- The Veo 3.1 Lite API costs $0.05/s at 720p and $0.08/s at 1080p. — [CostGoat Veo pricing](https://costgoat.com/pricing/google-veo)
- Unofficial batch automation of Flow exists:
  - gflow-cli (MIT, ★264, last push 2026-10-07): "Drive Google Flow from the command line… scripted, batched", and it ships an MCP server.
  - Chrome extensions automate batch Veo or Grok generation through the web UI (★49 and ★46).

  — [ffroliva/gflow-cli](https://github.com/ffroliva/gflow-cli); [trgkyle/veo-automation-user-guide](https://github.com/trgkyle/veo-automation-user-guide); [trgkyle/grok-automation-user-guide](https://github.com/trgkyle/grok-automation-user-guide)

**Higgsfield**
- Plan prices conflict between sources:
  - **Version 1:** Starter, Plus and Ultra at $19, $59 and $129 per month, with 270, 1,200 and 3,000 credits. This was checked on 2026-08-19 and a 2026-09-17 capture matches it. — [Scopeful](https://www.scopeful.org/blog/higgsfield-pricing-2026); [Krea blog on Higgsfield pricing](https://www.krea.ai/blog/higgsfield-pricing-explained-2026-unlimited-credits-and-real-monthly-costs)
  - **Version 2:** $15 for 200 credits, and $49 (or $39 billed annually) for 1,000 credits. — [Higgsfield blog](https://higgsfield.ai/blog/credits-vs-unlimited-ai-video-generation)
- Subscription credits do not roll over. Credit packs expire after 90 days. — [Scopeful](https://www.scopeful.org/blog/higgsfield-pricing-2026)
- Cinema Studio costs 25 credits for 5 s at 720p, 50 credits for 5 s at 1080p, and 100 credits for 10 s at 1080p. Higgsfield's blog gives these as about $1.25, $2.50 and $5.00. The cost appears on the Generate button before you confirm. Re-rolls and upscales are charged. — [Higgsfield blog: credits explained](https://higgsfield.ai/blog/ai-video-credits-explained); [Blotato](https://www.blotato.com/blog/higgsfield-pricing)
- One reviewer reports that a default run produces 4 variations at 1080p and costs 60–80 credits. — [Hackceleration review](https://hackceleration.com/higgsfield-review)
- Soul ID (character identity) training costs 25 credits, per a June 2026 table. Batch size is set before generation. — [Voyager](https://voyager.so/blog/higgsfield-pricing); [Higgsfield help center](https://higgsfield.ai/creator-hub/help-center/getting-started/what-is-higgsfield)
- Higgsfield aggregates 15+ video models and 70+ named camera presets. — [Flashloop](https://www.flashloop.ai/alternatives/higgsfield); [Fuser](https://fuser.studio/articles/higgsfield-alternatives)

**Runway**
- The Unlimited plan closed to new subscribers on 2026-06-01. Legacy Unlimited runs until 2026-11-30, after which monthly subscribers move to Max ($95, 9,500 credits) unless they cancel. Sources agree that no current tier is uncapped. — [eesel](https://www.eesel.ai/blog/runway-ai-pricing); [Scopeful Runway](https://www.scopeful.org/tools/runway)
- Plans:

  | Plan | Price per month | Credits per month |
  |---|---|---|
  | Standard | $12 annual / $15 monthly | 625 |
  | Pro | $28 annual / $35 monthly | 2,250 |
  | Max | $95 | 9,500 |

  — [eesel](https://www.eesel.ai/blog/runway-ai-pricing)
- Gen-4.5 costs 12 credits per second and Aleph 2.0 (editing) costs 28 credits per second. API credits cost $0.01 each, so Gen-4.5 via the API is about $0.12/s. App credits and API credits are separate accounts. — [Runway API pricing docs](https://docs.dev.runwayml.com/guides/pricing/); [eesel](https://www.eesel.ai/blog/runway-ai-pricing)

**Krea**
- Plans as of 2026-09-30:

  | Plan | Price per month | Compute units |
  |---|---|---|
  | Basic | $9 | 5,000 |
  | Pro | $35 | 20,000 |
  | Max | $105 | 60,000 |
  | Business (up to 50 seats) | $200 | 80,000 |

  Pro unlocks all video models and Nodes. — [Photta Krea pricing](https://www.photta.app/pricing-and-reviews/krea-ai)
- Nodes chains tools and runs several models in parallel for comparison. The API node editor supports batch jobs with branching logic. Krea Agent generates images in batches of up to 8. A third party says Pro allows 4 parallel video generations, and Max adds "expanded concurrency and queueing". — [Krea Nodes](https://www.krea.ai/features/nodes); [Krea API](https://www.krea.ai/features/api); [Krea Agent](https://www.krea.ai/blog/what-is-krea-agent)
- In a February 2026 test at comparable price points, Krea delivered 37 Kling generations against 120 for Higgsfield and 125 for OpenArt. — [Photta](https://www.photta.app/pricing-and-reviews/krea-ai) (via search extract)

**Freepik, now Magnific**
- Freepik rebranded to Magnific on 2026-04-28 and kept existing Spaces and subscriptions. — [Wireflow](https://www.wireflow.ai/blog/freepik-spaces-is-now-magnific)
- Premium+ costs $33.75/mo billed annually and includes 600,000 credits per year. "Unlimited" covers only selected models. For video that means Wan 2.2 at 480p, Hailuo 2.3 Fast at 768p and Kling 2.5 at 720p. — [Magnific pricing](https://www.magnific.com/pricing); [eesel](https://www.eesel.ai/blog/freepik-ai-pricing)
- Reviews describe it as web-only with no API, and a competitor's table lists its batch processing as "manual only". A review headline frames "Freepik Spaces / Freepik Lists" as a bulk production tool for agencies; I did not read the body. — [nemovideo](https://www.nemovideo.com/blog/freepik-ai-video-generator-review); [kingy.ai](https://kingy.ai/news/freepik-spaces-freepik-lists-review-the-bulk-creative-production-tool-agencies-have-been-waiting-for/)

**OpenArt, Pollo, Invideo, LTX Studio, Hedra, Leonardo, Adobe Firefly**
- **OpenArt:**
  - Video models include Gemini Omni, Veo 3.1, Kling 3.0 and Seedance 2.5. Sora 2 has been retired.
  - Clips run up to 30 s at 4K.
  - "OpenArt MCP & CLI" lets AI agents reach the whole catalog, with new models synced automatically.

  — [OpenArt AI video generator](https://openart.ai/ai-video-generator/); [OpenArt MCP & CLI](https://openart.ai/mcp/) (search extracts)
- **Pollo AI:** lists Veo, Sora, Kling, Seedance, Wan, MiniMax H3, Runway, Luma and Pika, plus its own cheaper models. One review counts Seedance 2.5 at about 30 credits per clip. — [AI Miracle Pollo review](https://aimiracle.ai/ai-tool-review/pollo-ai-review)
- **Invideo:** its model index lists Veo 3.1, Sora 2, Kling, Wan, PixVerse, Hailuo and Seedance. It differentiates on automating script, stock footage and voiceover. One source lists Plus at $17/mo. — [Invideo AI models](https://invideo.io/ai-models/); [parallax.kr](https://parallax.kr/en/blog/best-multi-model-ai-video-platforms-2026)
- **Adobe Firefly:** partner video models listed on 2026-08-18 include Gemini Omni Flash, Kling 3.0 and 3.0 Omni, Marey, Ray2 and Ray3, Runway Gen-4 and 4.5, and Veo 2 and 3.1. Adobe tells users to check each partner model's terms before commercial use. A separate help page covers partner models in "Firefly Creative Production for Enterprise". — [Adobe help: partner models](https://helpx.adobe.com/firefly/web/create-mood-boards/firefly-boards/partner-models-to-generate-videos.html); [Adobe enterprise help](https://helpx.adobe.com/firefly/web/work-with-enterprise-features/creative-production/partner-models-in-firefly-creative-production-for-enterprise.html); [xainflow](https://www.xainflow.com/blog/adobe-firefly-ai-natives-third-party-models-creative-cloud)
- **LTX Studio:** launched by Lightricks in February 2024. The platform is not open source, and LTX-2.3 is its flagship model. It also integrates Nano Banana, GPT Image 2, Veo and Seedance. — [Wikipedia](https://en.wikipedia.org/wiki/LTX_Studio); [LTX Studio](https://ltx.dev/studio); [vidmuse review](https://vidmuse.ai/blog/ltx-studio-review)
- **Hedra:** specialises in talking-character performance (a character image plus a script or audio). A user found it weak for movement or props. — [The Rundown](https://www.therundown.ai/tools/hedra); [Christy Tucker](https://christytuckerlearning.com/ai-image-to-video-experiments-with-hedra/)
- **Leonardo:** image-first, with only "partial" multi-model support. Plus costs $20/mo. — [parallax.kr](https://parallax.kr/en/blog/best-multi-model-ai-video-platforms-2026); [Leonardo pricing article](https://leonardo.ai/news/how-much-do-ai-video-generation-platforms-cost)
- **Pipeline-style platforms:** Iris is listed as supporting batch, scheduling and webhook pipelines. Magic Hour runs Kling, Veo 3.1, Sora 2, LTX 2.3, Wan 2.2 and Seedance 2.0 behind one API key. — [parallax.kr](https://parallax.kr/en/blog/best-multi-model-ai-video-platforms-2026)

**Chinese platforms: 即梦/Dreamina, LibTV, TapNow**
- 即梦 runs Seedance 2.5. Sources disagree on the launch, giving 2026-07-31 or August 2026. — [即梦 Seedance 2.5 page](https://jimeng.jianying.com/tools/seedance-2-5); [readaitime](https://jimeng.readaitime.com/)
- Membership prices conflict:
  - Standard: ¥199 or ¥239 per month for 2,210 credits.
  - Advanced: ¥499 or ¥649 per month for 6,160 credits.

  One source says a 15 s Seedance 2.0 video costs 120 credits. — [aitoollab](https://www.aitoollab.cn/articles/jimeng-ai-complete-guide-2026/); [stevenvideo](https://www.stevenvideo.com/blog/seedance-2-pricing-guide-zh)
- The **即梦 CLI (`dreamina`)** launched around April 2026. It installs with one curl command and logs in with a 即梦 account. It has 8 generation commands:
  - text-to-image and text-to-video
  - image-to-image and image-to-video
  - image upscaling
  - multimodal (Seedance 2.0 flagship mode)
  - multi-frame
  - first/last-frame video

  Claude Code, Codex or scripts can call it for batch runs. Seedance 2.0 via the CLI reportedly requires VIP membership. — [53AI](https://www.53ai.com/news/MultimodalLargeModel/2026040187324.html); [toolin.ai](https://toolin.ai/blog/jimeng-cli-seedance-agent); [JimengCli_api](https://github.com/xiaozhichao2025/JimengCli_api)
- **LibTV** (from LiblibAI) launched on 2026-03-18. It combines an infinite canvas, node workflows and agents (OpenClaw), and runs Seedance 2.0. Pricing starts at about ¥59/mo. **TapNow** is built on the Tapflow node canvas and schedules Hailuo, Veo, Wan and Sora. It gives 200 free credits plus 40 per week, and Standard includes 1,500 credits per month. One enterprise review says TapNow does not support batch generation. — [ai-bot.cn LibTV](https://ai-bot.cn/sites/73776.html); [Sohu comparison](https://www.sohu.com/a/1001050009_122492876); [Zhihu comparison](https://zhuanlan.zhihu.com/p/2038156945153111106)

**Effective $/second compared with the raw API** (my arithmetic from the figures above; it assumes full use of credits)
- **Google Flow, assuming 8 s Veo clips:**
  - Pro ($0.02/credit): Lite about $0.025/s, Fast about $0.05/s, Quality about $0.25/s.
  - Ultra 10k ($0.01/credit): Lite about $0.006/s, Fast about $0.0125/s, Quality about $0.125/s.
  - For comparison, the API costs $0.05–0.08/s for Lite, about $0.10/s for Fast on fal, and $0.20–0.40/s for Standard.
  - So Flow Ultra Fast is roughly 8× cheaper per second than API Fast for a heavy user.
- **Higgsfield Cinema Studio:** $1.25 per 5 s at 720p works out to about $0.25/s, and $2.50 per 5 s at 1080p to about $0.50/s. Kling 3.0 Pro via API costs $0.11–0.22/s, and Seedance 2.5 at 720p via API about $0.23/s.
- **Runway Gen-4.5:**
  - Standard monthly ($15 / 625 credits × 12 credits/s): about $0.29/s.
  - Pro monthly: about $0.19/s.
  - Max: about $0.12/s, the same as the API.
- **即梦 Seedance 2.0:** at ¥199–239 for 2,210 credits and 120 credits per 15 s, that is about ¥0.72–0.87/s. This is in the same range as the official Seedance 2.0 API (about $0.11–0.15/s per [EggStriker](https://www.eggstriker.com/en/blog/ai-video-model-pricing-comparison-2026) and [TeamDay](https://www.teamday.ai/blog/ai-image-video-api-providers-comparison-2026)). The CNY to USD conversion is not done here.

### Inferences
- **Feature matrix by platform** (from the bullets above):
  - Variations or batch size per prompt: Higgsfield, Krea (parallel models).
  - Storyboard or scene builder: Flow Scenebuilder, LTX Studio, LibTV.
  - Character consistency: Higgsfield Soul ID, Flow Ingredients.
  - Upscaling: Flow 4K, Higgsfield, the 即梦 CLI.
  - Edit and extend: Flow Omni edit and extension, Runway Aleph.
  - Team or workspace: Krea Business with 50 seats, Figma Weave Team, Flora seats.
  - API, MCP or CLI: Runway API, Krea API, OpenArt MCP/CLI, 即梦 CLI.
  - True spreadsheet-driven bulk runs with per-row parameters and cost: essentially absent from creator platforms. It appears only in n8n templates, unofficial Flow automation and open-source tools.
- **The pricing threat to videogen's BYOK proposition.** For Veo specifically, Google's consumer subscription (Flow Ultra) is far cheaper per second than any API. This explains why unofficial "batch Google Flow" tools exist (gflow-cli, Chrome extensions). Those tools carry terms-of-service risk, but they show demand for "batch over subscription credits". For Seedance, 即梦 membership pricing is close to API pricing, so BYOK API batch is competitive there.
- **The direction of travel.** Agent and CLI access to consumer accounts (即梦 CLI, OpenArt MCP & CLI, the Flow Agent) is the newest trend in 2026. Creator platforms are going headless to serve coding agents, which narrows the gap between "creator UI" and "developer batch tool".

### Gaps
- Not researched in enough depth to cite: Artlist (AI video features and pricing), CapCut's international AI video features, Kling/可灵 web-app batch features and membership pricing, Hedra pricing, Invideo's plan details beyond one price point, and Pollo's subscription tiers.
- Official pricing pages for Higgsfield, Krea, Flow and 即梦 were not fetched. All figures are third-party snapshots, several of them conflicting, and the conflicts are noted above.
- The Flow $/s arithmetic assumes 8 s clips and full credit use. Actual clip length per credit charge was not verified.
- Whether Higgsfield, Krea or Flow offer a native CSV or spreadsheet bulk import was not verified. I found no evidence that they do.

---

## Q3. Node and workflow tools (ComfyUI with Partner Nodes and Comfy Cloud, Weavy/Figma Weave, Flora, Krea Nodes, Freepik Spaces, n8n and Make templates)

### Takeaway
Node tools handle "batch" as graph re-runs or branching, and handle cost as a credit or dollar budget, with the cost shown per node before a run. None of them offers videogen's row-level budget, estimate and keep/reject accounting. n8n templates are the closest functional analogue to videogen's CSV batch: a Google Sheets row becomes a fal or Vertex call, polling, a Drive upload and a link written back. They require self-assembly, and FFmpeg steps need a self-hosted n8n.

### Cited Findings
- **ComfyUI:** 136,531 stars, GPL-3.0, last push 2026-10-08. — [Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI)
- **Partner Nodes** are priced in credits:
  - Flux 3 text-to-video: 51.29 credits/s at 720p and 87.50 at 1080p.
  - Seedance 2.0: priced per 1K tokens, from 2.112 credits.
  - HeyGen: 3.02–36.21 credits/s.
  - The LTXV API nodes have been retired.

  — [Comfy docs: Partner Node pricing](https://docs.comfy.org/tutorials/partner-nodes/pricing)
- **Comfy Cloud nodes** include MiniMax H3 text-to-video, image-to-video and first/last-frame. They are billed per GPU-second in credits, with the cost shown on the node before the run, and need no subscription. A pending pull request computes about 0.273 credits per GPU-second, or $0.001295, which implies about $0.0047 per credit. The PR thread reports an earlier over-quoting bug of about 43%. — [Comfy Cloud nodes docs](https://docs.comfy.org/cloud-nodes/overview); [ComfyUI PR #15935](https://github.com/Comfy-Org/ComfyUI/pull/15935)
- **Comfy Cloud plans (third-party figures):**
  - Free: 400 credits/mo, or 5 free runs, depending on the source.
  - Standard: $20/mo, 4,200 credits.
  - Creator: $35/mo, 7,400 credits.
  - Pro: $100/mo, 21,100 credits.

  Comfy Desktop is free, and credits are needed only for Partner Nodes. The excerpt from the official page conflicts with these figures. — [aitrendtool](https://aitrendtool.com/tools/comfyui); [comfy.org pricing](https://comfy.org/pricing/); [comfyui.org](https://comfyui.org/en/comfy-cloud-new-features-and-pricing)
- My arithmetic: at about $0.0047 per credit, Flux 3 text-to-video at 720p comes to about $0.24/s through Partner Nodes.
- **Figma Weave (formerly Weavy):**
  - Plans:

    | Plan | Annual billing | Monthly billing | Credits per month |
    |---|---|---|---|
    | Free | $0 | $0 | 150 |
    | Starter | $19 | $24 | 1,500 |
    | Professional | $36 | $45 | 4,000 (3-month rollover) |
    | Team | $48 per user | $60 per user | 4,500 per user, shared pool |

  - Video costs about 30 credits per 5 s clip, per Luma's estimate.
  - API access is limited; one review says there is none, while Enterprise reportedly allows your own API keys and "run workflows via API" is "coming soon".
  - Weave tools inside Figma Design are in beta.

  — [Luma: Weave pricing](https://lumalabs.ai/news/weave-pricing); [Scopeful](https://www.scopeful.org/tools/figma-weave); [Toolso](https://toolso.ai/tool/weavy); [uxmagic review](https://uxmagic.ai/blog/figma-weave-review)
- **Flora:**
  - 50+ models on one canvas.
  - "Techniques" publish a multi-step workflow as a reusable package or a link-based app.
  - Seats cost $18 (Starter), $50 (Pro) and $200 (Max) per month. The free tier has no video, API or MCP.
  - Usage switched to a dollar budget that resets monthly with no rollover, dated by one source to May 2026.

  — [makerstack review](https://makerstack.co/reviews/flora-review/); [aionx pricing guide](https://aionx.co/ai-comparisons/flora-pricing-guide/); [university-365](https://www.university-365.com/post/flora-flora-the-generative-ai-canvas-that-runs-50-or-more-models-scored-5-3-on-the-u365-ci-first)
- **Krea Nodes:** chain tools, run models in parallel, branch batch jobs through the API. Included with Pro at $35. — [Krea Nodes](https://www.krea.ai/features/nodes); [Krea API](https://www.krea.ai/features/api)
- **Freepik Spaces:** now under the Magnific brand. No API, and batch is described as manual. — [Wireflow](https://www.wireflow.ai/blog/freepik-spaces-is-now-magnific); [Wireflow Spaces alternative](https://www.wireflow.ai/freepik-spaces-alternative)
- **n8n templates:**
  - Template 14549 ("Generate bulk Veo 3 videos from Google Sheets via Vertex AI"): each row sets prompt, resolution (720p or 1080p), aspect ratio and duration (4, 6 or 8 s). A checkbox triggers the run. The workflow polls, uploads to Drive, writes the link back and logs errors to the sheet. — [n8n 14549](https://n8n.io/workflows/14549-generate-bulk-veo-3-videos-from-google-sheets-via-vertex-ai/)
  - Template 5034: Kling 2.1 on fal, described as "4x cheaper than veo3". — [n8n 5034](https://n8n.io/workflows/5034-create-ai-generated-videos-4x-cheaper-than-veo3-with-google-sheets-and-falai/)
  - Templates 4881 and 4877: Sheets → GPT → fal Veo 3. — [n8n 4881](https://n8n.io/workflows/4881-turn-google-sheets-ideas-into-ai-videos-with-gpt-4o-and-falai-veo-3/); [n8n 4877](https://n8n.io/workflows/4877-automated-video-creation-using-google-veo3-and-n8n-workflow/)
  - Template 3438 (quote videos) needs self-hosted n8n, because FFmpeg is unsupported on n8n Cloud. — [n8n 3438](https://n8n.io/workflows/3438-automatically-create-cinematic-quote-videos-with-ai-and-upload-to-youtube/)
  - Template 11710 extends and merges Kling clips. — [n8n 11710](https://n8n.io/workflows/11710-extend-and-merge-ugc-viral-videos-using-kling-21-then-publish-on-social-media/)
  - Paid Veo3/n8n workflows are also sold on Etsy. — [Etsy listing](https://www.etsy.com/listing/4364283635/ai-video-creation-workflow-veo3-n8n)
- **Chinese canvas tools:** LibTV and TapNow follow the same pattern: infinite canvas, node workflows and agents. See Q2. Among open-source tools, Toonflow (★16.6k) explicitly copies "the canvas-based approach similar to LibTV and TapNow". — [HBAI-Ltd/Toonflow-app](https://github.com/HBAI-Ltd/Toonflow-app)

### Inferences
- **Node canvases optimise for exploration, not throughput.** They make the recipe reusable (Flora Techniques, Weave workflows, Krea templates). They do not make "run this recipe over 500 rows with a budget cap, then triage the results" easy. That job falls to n8n, scripts or tools like videogen.
- **Cost transparency at the node level is now expected.** Comfy shows cost on the node before a run, Higgsfield on the Generate button, and the Flow Agent asks before spending. Cost at the batch level, with budgets, is still uncommon, which is a point in videogen's favour.
- **The n8n templates are videogen's closest functional competitor for the "spreadsheet → bulk clips" job.** videogen's advantages over them are no assembly, a local gallery with keep/reject, crash-safe resume and Chinese provider coverage. The n8n templates' advantages are cloud scheduling, Google Drive and Sheets integration, and publishing steps.

### Gaps
- I found no specific Make.com bulk-video templates.
- Official Comfy Cloud plan figures conflict with third-party listings, and the credit-to-USD rate is derived from a pending PR, not an official statement.
- The date of Figma's Weavy acquisition was not re-verified in this session. My recollection is that it was announced in October 2025; treat that as unverified. Sources only confirm the "formerly Weavy" rebrand and a beta integration with Figma Design.
- Batch caps per run in Krea Nodes, Flora and Weave could not be verified.

---

## Q4. Open-source GitHub projects closest to videogen: stars, activity, features, licenses, and why the popular ones are popular

### Takeaway
Open-source AI video tooling in 2026 is dominated by end-to-end "one sentence/script → finished video" pipelines and by the Chinese short-drama/漫剧 wave. Most of those projects were created in January–March 2026, after Seedance 2.0. The closest comparables to videogen on positioning (local-first, BYOK, multi-provider batch with cost tracking) are:
- **ArcReel** (cost tracking, multi-provider, resumable pipeline)
- **moyin-creator** (batch queue with retry and key rotation)
- **LocalMiniDrama** (local Node/Electron, BYOK, DashScope, Volcengine, Gemini and Kling)
- **Nomi** (local-first BYOK desktop app with MCP and a timeline)
- **huobao-drama** (batch video with a pre-generation confirmation, and zh/en/ja/ko UI)

None of them combines a crash-safe multi-lane queue, budgets, spreadsheet/CSV import and "cost per kept clip" under MIT. Several are AGPL or non-commercial.

### Cited Findings
Stars are as of 2026-10-08, from the GitHub search API. "Pushed" is the date of the last push. Sources are the repo pages linked in each row.

**A. Short-drama/漫剧 and story-to-video pipelines (closest feature overlap)**

| Repo | Stars / forks | Created → pushed | License | Notes |
|---|---|---|---|---|
| [HBAI-Ltd/Toonflow-app](https://github.com/HBAI-Ltd/Toonflow-app) | 16,643 / 2,952 | 2026-01-29 → 2026-10-05 | MIT (moved from Apache-2.0 in June 2026) | Infinite canvas, AI agents, node workflows, smart storyboards, BYOK, local ComfyUI, MCP plus a plugin marketplace, Windows and macOS (Apple Silicon) installers plus Docker, 21 UI languages. No batch, queue or cost tracking is documented. |
| [chatfire-AI/huobao-drama](https://github.com/chatfire-AI/huobao-drama) | 15,838 / 2,932 | 2026-01-05 → 2026-10-05 | CC BY-NC-SA 4.0 (commercial use needs permission) | Video via Seedance 2.0 (Standard/Fast/Mini), MiniMax H3 and Wan 3.0. Batch character and batch video generation, a pre-generation confirmation (shot count, duration, model, resolution), one-click retry of failures, `@character` reference images, FFmpeg concat and subtitles, macOS and Windows installers plus Docker, zh/en/ja/ko UI, v4.0.x. No cost tracking. |
| [waooAI/waoowaoo](https://github.com/waooAI/waoowaoo) | 14,416 / 3,147 | 2026-01-22 → 2026-09-21 | NOASSERTION | "Industry-first professional AI Agent platform for controllable film & video production". |
| [dramaclaw/dramaclaw](https://github.com/dramaclaw/dramaclaw) | 6,731 / 825 | 2026-03-27 → 2026-10-08 | NOASSERTION | General AIGC video engine, from script to film. Self-hosted, FastAPI and React. |
| [Forget-C/Jellyfish](https://github.com/Forget-C/Jellyfish) | 6,621 / 1,138 | 2026-03-06 → 2026-07-30 | Apache-2.0 | Unified async task center (status, cancel, recovery), batch pre-checks plus batch shot generation, asset consistency center, Docker Compose (MySQL, Redis). No cost tracking. |
| [ArcReel/ArcReel](https://github.com/ArcReel/ArcReel) | 5,354 / 1,048 | 2026-02-07 → 2026-10-08 | AGPL-3.0 plus a commercial license | Multi-provider text, image, video and TTS. "在生成前后查看费用与实际用量" (view costs and actual usage before and after generation). Resumable pipeline, reference-image reuse across shots, multi-grid storyboards, 剪映/JianYing draft export, Docker only, built on the Claude Agent SDK. |
| [MemeCalculate/moyin-creator](https://github.com/MemeCalculate/moyin-creator) | 4,660 / 941 | 2026-02-09 → 2026-08-27 | AGPL-3.0 plus a commercial license | BYOK, batch image and video, "multi-task parallel queue with automatic retry", API keys rotated round-robin, Character Bible, validates Seedance 2.0 limits (9 images, 3 videos, 3 audio clips), Electron on Windows, v0.1.8. |
| [shuyu-labs/BigBanana-AI-Director](https://github.com/shuyu-labs/BigBanana-AI-Director) | 2,272 / 328 | 2026-01-31 → 2026-10-06 | NOASSERTION | "Script-to-Asset-to-Keyframe" industrial workflow. |
| [xuanyustudio/LocalMiniDrama](https://github.com/xuanyustudio/LocalMiniDrama) | 1,965 / 470 | 2026-02-10 → 2026-10-02 | MIT | Same JS stack as videogen (Node.js, Electron 28, SQLite). BYOK across DashScope, Volcengine/Seedance 2.0, Kling (including Omni), Gemini Imagen/Veo, Vidu, NanoBanana, Ollama and OpenAI-compatible endpoints. Batch image and video with skip-existing, 3 retries per step for rate limits, `@图片N` multi-references, tail-frame continuity, HTML storyboard and SRT export, Windows .exe, v1.2.8. No cost tracking. |
| [LingGuoAI/LingGuo-Drama](https://github.com/LingGuoAI/LingGuo-Drama) | 1,554 / 264 | 2026-02-24 → 2026-08-21 | none | Go. |
| [alibaba/lumenx](https://github.com/alibaba/lumenx) | 1,334 / 312 | 2026-02-05 → 2026-08-11 | MIT | Alibaba. Novel → video, with character customisation and storyboards. |
| [gzxx-2025/aid-studio](https://github.com/gzxx-2025/aid-studio) | 817 | created 2026-07-19 | — | Multi-model, self-deployable. |
| [TypeTale/TypeTale](https://github.com/TypeTale/TypeTale) | 858 | — | — | Free AIGC video software for 小说推文 (novel promo videos). |

**Agent skill packs riding the same wave**
- [Seedance2-Storyboard-Generator](https://github.com/liangdabiao/Seedance2-Storyboard-Generator): ★2,537
- [zenstory-ai/drama-skills](https://github.com/zenstory-ai/drama-skills): ★2,595, MIT
- [eternityspring/shuohao-skills](https://github.com/eternityspring/shuohao-skills): ★4,236
- [dexhunter/seedance2-skill](https://github.com/dexhunter/seedance2-skill): ★4,224
- [Emily2040/seedance-2.0](https://github.com/Emily2040/seedance-2.0): ★7,543, MIT, "production pipeline for quad-modal AI filmmaking"

**B. Topic or keyword → short video automation (the classic category)**

| Repo | Stars / forks | Pushed | License | Notes |
|---|---|---|---|---|
| [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | 129,174 / 20,212 | 2026-10-08 | MIT | Topic → script, voiceover, footage, subtitles, BGM. Stock footage (Pexels, Pixabay, Coverr) plus generative video (MiniMax H3, Volcengine Seedance, WaveSpeed, OFox, MuAPI, 胜算云). WebUI, API, CLI and agent interfaces. CLI `--batch-file` takes JSON/JSONL with up to 100 tasks, and a failure doesn't stop the run. Docker, Windows one-click .7z, auto-upload to TikTok, Instagram and YouTube. |
| [ATH-MaaS/Pixelle-Video](https://github.com/ATH-MaaS/Pixelle-Video) | 28,739 / 4,178 | 2026-06-14 | Apache-2.0 | ComfyUI-based fully automated short-video engine. |
| [linyqh/NarratoAI](https://github.com/linyqh/NarratoAI) | 11,309 / 1,557 | 2026-09-17 | MIT | LLM commentary and auto-editing (解说/剪辑). |
| [HKUDS/ViMax](https://github.com/HKUDS/ViMax) | 12,568 / 1,892 | 2026-09-30 | MIT | Agentic video generation: director, screenwriter, producer and generator in one. |
| [YILS-LIN/short-video-factory](https://github.com/YILS-LIN/short-video-factory) | 5,546 / 774 | 2026-09-29 | AGPL-3.0 | Cross-platform desktop app for product-marketing shorts, "AI batch automatic clipping". |
| [alecm20/story-flicks](https://github.com/alecm20/story-flicks) | 2,531 | 2025-03-12 (stale) | — | — |
| [rushindrasinha/youtube-shorts-pipeline](https://github.com/rushindrasinha/youtube-shorts-pipeline) | 2,312 | — | — | — |

**C. Agentic and "coding-agent as video studio" (the fastest-growing 2026 category)**

| Repo | Stars / forks | Created → pushed | License | Notes |
|---|---|---|---|---|
| [calesthio/OpenMontage](https://github.com/calesthio/OpenMontage) | 65,111 / 8,261 | 2026-03-29 → 2026-10-03 | AGPL-3.0 | "12 production pipelines, 100+ tools, 700+ agent skill… files". |
| [hypit-ai/hypit](https://github.com/hypit-ai/hypit) | 20,110 | 2026-07-29 → 2026-10-04 | NOASSERTION | "ship 100 variants in one command". |
| [palmier-io/palmier-pro](https://github.com/palmier-io/palmier-pro) | 14,525 | → 2026-10-05 | GPL-3.0 | macOS video editor "built for AI", MCP, Seedance 2. |
| [krillinai/OpenCreator](https://github.com/krillinai/OpenCreator) | 12,624 | — | Apache-2.0 | — |
| [Vincentwei1021/video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) | 10,746 | — | — | — |

**D. Local-first BYOK desktop "AI video studio" (closest positioning)**

| Repo | Stars / forks | Created → pushed | License | Notes |
|---|---|---|---|---|
| [aqm857886159/Nomi](https://github.com/aqm857886159/Nomi) | 550 / 124 | 2026-05-04 → 2026-10-08 | AGPL-3.0-only (earlier releases Apache-2.0) | "Open-source AI video workbench… Local-first: projects, prompts, and keys stay on your machine. No account, no telemetry." Providers: Seedance, Kling, Wan, Hailuo, Nano Banana and GPT Image via APIMart, Kie.ai, Volcengine, ModelScope, a Dreamina membership, any OpenAI-compatible relay, or local ComfyUI. MCP server with 24 tools and 3 autonomy levels, storyboard with locked reference cards, real timeline and MP4 export. Unsigned macOS DMG and Windows setup.exe. No batch queue or cost tracking is described. |
| [VelornLabs/velorn](https://github.com/VelornLabs/velorn) | 500 | → 2026-09-26 | GPL-3.0 | AI-native timeline editor, ComfyUI, MCP, Electron. |
| [BeatAPI/BeatDesign](https://github.com/BeatAPI/BeatDesign) | 114 | created 2026-08-20 | Apache-2.0 | "Local-first AI canvas and timeline. Any MCP agent. Open-source alternative to Higgsfield." |
| [Blizaine/Maestro](https://github.com/Blizaine/Maestro) | 713 | — | — | 100% local, WanGP, installed via Pinokio. |
| [ClabstreamTeam/Open-Higgsfield-AI](https://github.com/ClabstreamTeam/Open-Higgsfield-AI) | 183 | — | — | — |
| [Dooy/chatgpt-web-midjourney-proxy](https://github.com/Dooy/chatgpt-web-midjourney-proxy) | 6,797 / 1,605 | → 2026-09-29 | MIT | One UI for chat plus Midjourney, Suno, Luma, Runway, Kling, Sora, Veo 3, Seedance, MiniMax H3. Web, PWA and Windows/macOS/Linux. |

**E. Narrow batch tools (closest to videogen's core job)**

| Repo | Stars | License | Notes |
|---|---|---|---|
| [ffroliva/gflow-cli](https://github.com/ffroliva/gflow-cli) | 264 | MIT | Unofficial Google Flow batch CLI plus MCP. |
| [TFboy1/oh-my-minimaxh3-director](https://github.com/TFboy1/oh-my-minimaxh3-director) | 140 | — | MiniMax H3 automatic storyboards, batch generation, one-click 剪映 merge. |
| [feyzilim/clipfactory](https://github.com/feyzilim/clipfactory) | 104 | Elastic 2.0 | "batch generation" of B-roll shorts. |
| [SamurAIGPT/Text-To-Video-AI](https://github.com/SamurAIGPT/Text-To-Video-AI) | 837 | MIT | Uses muapi. |
| [swf-cmd/videogen](https://github.com/swf-cmd/videogen) | 0 | — | Pushed 2026-10-08 (the client project). |

### Inferences
- **What makes the popular ones popular:**
  1. **Outcome framing.** "One sentence → finished video" (MoneyPrinterTurbo, huobao-drama's "一句话生成完整短剧", LingGuo-Drama, BigBanana) rather than "a better job runner".
  2. **Riding a model wave.** Most short-drama repos and Seedance skill repos were created between 2026-01 and 2026-03, and many reference Seedance 2.0 in their description. These include huobao-drama, Toonflow, moyin-creator, LocalMiniDrama, Emily2040/seedance-2.0, awesome-seedance and seedance2-skill.
  3. **Character and asset consistency** is a headline feature in almost every short-drama tool.
  4. **Desktop installers or one-click packages** (huobao-drama, Toonflow, moyin-creator, LocalMiniDrama, Nomi, the MoneyPrinterTurbo .7z).
  5. **Chinese-first READMEs with Chinese provider coverage** (Volcengine, DashScope, 即梦).
  6. **Agent, MCP and skill hooks.** These account for most new 2026 star growth: OpenMontage at 65k in about six months, hypit at 20k in about two months, and many skill repos with 2–7k stars.
- **Most relevant comparables for videogen, ranked by overlap:**
  1. **ArcReel:** multi-provider, cost before and after generation, resumable pipeline. It is AGPL, Docker-only and drama-oriented.
  2. **moyin-creator:** parallel queue, retry, key rotation, batch video. AGPL, Windows-only.
  3. **LocalMiniDrama:** same Node/Electron stack, near-identical provider mix (DashScope, Volcengine, Gemini), MIT. No cost tracking or queue design.
  4. **Nomi:** the same "local-first BYOK, no account" pitch, plus MCP and a timeline. No batch or cost features.
  5. **huobao-drama:** batch video with a pre-generation summary, and the same 4 UI languages. Non-commercial license.
  6. **MoneyPrinterTurbo:** a 100-task JSON batch CLI and the canonical popularity benchmark.
- **License is a quiet differentiator.** Four of the six closest comparables are AGPL or non-commercial: ArcReel, moyin-creator, Nomi and huobao-drama. videogen's MIT license matters to agencies and studios that want to embed or modify the tool.

### Gaps
- Star-history curves (growth rate) were not retrieved, because star-history.com was not queried. Only point-in-time stars are given.
- Release dates and latest versions for Toonflow, ArcReel, Nomi and Jellyfish are not shown on their README pages.
- Features of waoowaoo, dramaclaw, BigBanana, LingGuo-Drama, printfilm (★4,686, created 2026-09-10) and OpenMontage were not read in detail beyond their repo descriptions.
- Several popular repos have NOASSERTION licenses on GitHub (waoowaoo, dramaclaw, BigBanana, hypit). Their actual terms were not verified.

---

## Q5. Which capabilities are table stakes in October 2026 for a serious AI video production tool?

### Takeaway
Across aggregators, creator platforms, node tools and leading open-source projects, the expected baseline is:
- multi-model access
- an async queue with retries and no charge for failures
- reference images and character consistency
- first/last frames
- storyboard or multi-shot sequencing
- upscaling
- edit and extend
- cost shown before running
- output to an editor (timeline, concat, subtitles or 剪映 draft)

Agent access (MCP or CLI) has moved from novelty to expected within 2026.

### Cited Findings
- **Multi-model access under one account or key** is universal on creator platforms and aggregators: Higgsfield 15+ video models, Krea 64+ models, Flora 50+ models, OpenArt, Pollo, Invideo, Adobe Firefly partner models, and OpenRouter, fal, Replicate and WaveSpeed. — [Flashloop](https://www.flashloop.ai/alternatives/higgsfield); [tooljunction Krea](https://www.tooljunction.io/ai-tools/krea); [university-365 Flora](https://www.university-365.com/post/flora-flora-the-generative-ai-canvas-that-runs-50-or-more-models-scored-5-3-on-the-u365-ci-first); [parallax.kr](https://parallax.kr/en/blog/best-multi-model-ai-video-platforms-2026)
- **Async jobs, webhooks or polling, retries, and no charge for failures:**
  - fal: queue, webhooks, failed and queued time not billed — [aiphotolabs](https://aiphotolabs.com/reviews/fal-ai-review)
  - Replicate: webhook retries — [Replicate docs](https://replicate.com/docs/topics/webhooks/receive-webhook)
  - Runware: per-task webhooks — [Runware docs](https://runware.ai/docs/platform/introduction)
  - WaveSpeed: automatic refunds for system errors — [Kinovi](https://kinovi.ai/blogs/wavespeed-ai-alternatives)
  - Open source: moyin-creator's parallel queue with auto-retry ([repo](https://github.com/MemeCalculate/moyin-creator)), Jellyfish's async task center with recovery ([repo](https://github.com/Forget-C/Jellyfish)), huobao-drama's one-click retry ([repo](https://github.com/chatfire-AI/huobao-drama))
- **Reference images and character consistency:**
  - Higgsfield Soul ID — [Voyager](https://voyager.so/blog/higgsfield-pricing)
  - Flow Ingredients — [SaaSCRMReview](https://saascrmreview.com/google-flow-review/)
  - huobao-drama `@character` references — [repo](https://github.com/chatfire-AI/huobao-drama)
  - moyin-creator Character Bible — [repo](https://github.com/MemeCalculate/moyin-creator)
  - Nomi locked reference cards — [repo](https://github.com/aqm857886159/Nomi)
  - ArcReel reference reuse across shots — [repo](https://github.com/ArcReel/ArcReel)
  - LocalMiniDrama `@图片N` — [repo](https://github.com/xuanyustudio/LocalMiniDrama)
  - Seedance 2.0 accepts up to 9 images, 3 videos and 3 audio references — [moyin-creator](https://github.com/MemeCalculate/moyin-creator)
  - OmniChar proposes an open `.char` character format (★510) — [repo](https://github.com/omnichar/OmniChar)
- **First/last frame:** 即梦 CLI first/last-frame command ([53AI](https://www.53ai.com/news/MultimodalLargeModel/2026040187324.html)); Comfy Cloud MiniMax H3 first/last-frame node ([Comfy docs](https://docs.comfy.org/cloud-nodes/overview)); LocalMiniDrama tail-frame continuity ([repo](https://github.com/xuanyustudio/LocalMiniDrama)).
- **Storyboard, multi-shot and scene sequencing:** Flow Scenebuilder ([tooldirectory](https://tooldirectory.ai/tools/google-flow)); LTX Studio ([ltx.io](https://ltx.io/studio)); every short-drama repo in Q4.
- **Upscaling:** Flow 4K upscale at 50 credits ([CostGoat](https://costgoat.com/pricing/google-flow)); 即梦 CLI image upscaling ([53AI](https://www.53ai.com/news/MultimodalLargeModel/2026040187324.html)); Higgsfield charges for upscales ([Blotato](https://www.blotato.com/blog/higgsfield-pricing)); Comfy Flux Video Upscale node ([Comfy pricing](https://docs.comfy.org/tutorials/partner-nodes/pricing)).
- **Edit, extend and video-to-video:**
  - Runway Aleph 2.0 at 28 credits/s — [Runway API docs](https://docs.dev.runwayml.com/guides/pricing/)
  - Flow Omni Flash edits and Lite extension — [diyai](https://diyai.io/ai-tools/video-generation/google-veo-pricing/)
  - Seedance 2.5 "omni-reference, video edit + extend", per a Higgsfield prompt-skill repo — [OSideMedia/higgsfield-ai-prompt-skill](https://github.com/OSideMedia/higgsfield-ai-prompt-skill)
  - Kie lists lower Seedance 2.5 rates "with reference video" — [CellCog](https://cellcog.ai/blog/seedance-2-5-pricing/)
- **Cost visibility before running:** Higgsfield shows cost on the Generate button ([Higgsfield blog](https://higgsfield.ai/blog/ai-video-credits-explained)); Comfy shows cost on the node ([Comfy Cloud docs](https://docs.comfy.org/cloud-nodes/overview)); the Flow Agent asks before spending ([CostGoat](https://costgoat.com/pricing/google-flow)); huobao-drama has a pre-generation confirmation ([repo](https://github.com/chatfire-AI/huobao-drama)); ArcReel shows cost before and after ([repo](https://github.com/ArcReel/ArcReel)); OpenRouter exposes per-model pricing through `/videos/models` ([OpenRouter guide](https://openrouter.ai/blog/tutorials/video-generation-api/)).
- **Variations per prompt:** Higgsfield's default of 4 variations ([Hackceleration](https://hackceleration.com/higgsfield-review)); Krea's parallel multi-model compare ([Krea Nodes](https://www.krea.ai/features/nodes)).
- **Output to an editor:** ArcReel 剪映 drafts ([repo](https://github.com/ArcReel/ArcReel)); huobao-drama FFmpeg concat and subtitles ([repo](https://github.com/chatfire-AI/huobao-drama)); Nomi timeline ([repo](https://github.com/aqm857886159/Nomi)); palmier-pro and velorn AI-native editors ([palmier-pro](https://github.com/palmier-io/palmier-pro), [velorn](https://github.com/VelornLabs/velorn)); oh-my-minimaxh3-director one-click 剪映 merge ([repo](https://github.com/TFboy1/oh-my-minimaxh3-director)).
- **Agent access (MCP, CLI, skills):** OpenArt MCP & CLI ([openart.ai/mcp](https://openart.ai/mcp/)); 即梦 CLI ([toolin.ai](https://toolin.ai/blog/jimeng-cli-seedance-agent)); Toonflow MCP ([repo](https://github.com/HBAI-Ltd/Toonflow-app)); Nomi's MCP server with 24 tools ([repo](https://github.com/aqm857886159/Nomi)); gflow-cli MCP ([repo](https://github.com/ffroliva/gflow-cli)); MoneyPrinterTurbo's agent and CLI interfaces ([repo](https://github.com/harry0703/MoneyPrinterTurbo)); OpenMontage, a coding agent as a studio ([repo](https://github.com/calesthio/OpenMontage)).
- **Desktop installers are standard among popular open-source studios:** huobao-drama (macOS and Windows), Toonflow (Windows and macOS), Nomi (DMG and setup.exe), moyin-creator and LocalMiniDrama (Electron on Windows). — repo links in Q4.

### Inferences
- **Must-have tier**, because it appears in nearly every serious tool across categories: multi-model access, an async queue with retry, reference/character consistency, first/last frame, cost shown before running, and at least basic assembly (concat or export to an editor).
- **Expected tier**, present in most leaders and a frequent reason to choose one tool over another: storyboard or multi-shot, upscaling, edit/extend/V2V, variations per prompt, a desktop installer, and MCP or CLI access.
- **Differentiator tier**, still uncommon: hard budgets per batch, spreadsheet/CSV bulk import with template variables, keep/reject triage with yield metrics, per-region provider lanes, and crash-safe resume across restarts.
- **Where videogen sits.** It covers part of the must-have tier: multi-model, queue and retry, first/last frames and cost preview. It lacks reference images and assembly. It has most of the differentiator tier but little of the expected tier.

### Gaps
- No quantitative survey (user polls or feature-usage data) on which features buyers rank highest was found. The "table stakes" tiers are inferred from how often features appear across products.
- Whether "variations per prompt" is offered natively by the APIs (an n > 1 parameter) or only by platforms was not verified.

---

## Q6. Where videogen is differentiated, and where it is exposed

### Takeaway
videogen's defensible niche is **"throughput accounting" for BYOK users**:
- spreadsheet/CSV/template-driven bulk runs of up to 1,000 rows
- a crash-safe persistent queue with per-provider and per-region lanes
- hard budgets and per-row estimates
- a keep/reject gallery with cost per kept clip
- MIT license, zero dependencies, portable ZIPs, 4 UI languages

No creator platform or open-source tool found combines these. The exposure is equally clear: no reference/character consistency, no assembly or export, no MCP or CLI, no fal or Replicate adapters, and 0 stars against short-drama tools with 2–16k stars.

### Cited Findings
- **Spreadsheet-driven bulk generation**
  - Elsewhere it exists only as self-assembled n8n templates (Google Sheets → Vertex or fal → Drive) — [n8n 14549](https://n8n.io/workflows/14549-generate-bulk-veo-3-videos-from-google-sheets-via-vertex-ai/) — or as unofficial Flow and Grok browser automation — [gflow-cli](https://github.com/ffroliva/gflow-cli); [veo-automation](https://github.com/trgkyle/veo-automation-user-guide).
  - Freepik/Magnific batch is described as manual, with no API — [nemovideo](https://www.nemovideo.com/blog/freepik-ai-video-generator-review).
  - TapNow reportedly lacks batch — [Sohu](https://www.sohu.com/a/1001050009_122492876).
  - MoneyPrinterTurbo's batch is a 100-task JSON CLI, not a spreadsheet UI — [repo](https://github.com/harry0703/MoneyPrinterTurbo).
- **Cost accounting**
  - ArcReel shows "费用与实际用量" (cost and actual usage) before and after generation, but documents no budgets — [ArcReel](https://github.com/ArcReel/ArcReel).
  - huobao-drama confirms shot count, duration, model and resolution before generating, with no cost tracking — [huobao-drama](https://github.com/chatfire-AI/huobao-drama).
  - Toonflow, Nomi, LocalMiniDrama, moyin-creator and Jellyfish document no cost tracking — repo pages in Q4.
  - Creator platforms show cost per generation, and Flora uses monthly dollar budgets — [Higgsfield blog](https://higgsfield.ai/blog/ai-video-credits-explained); [aionx Flora](https://aionx.co/ai-comparisons/flora-pricing-guide/).
  - I found no tool reporting "cost per kept clip" or another yield metric.
- **Queue robustness**
  - moyin-creator offers a parallel queue, retry and key rotation — [repo](https://github.com/MemeCalculate/moyin-creator).
  - Jellyfish's async task center supports recovery — [repo](https://github.com/Forget-C/Jellyfish).
  - ArcReel has a resumable pipeline — [repo](https://github.com/ArcReel/ArcReel).
  - LocalMiniDrama retries each step 3 times — [repo](https://github.com/xuanyustudio/LocalMiniDrama).
  - I found no open-source tool with per-provider or per-region concurrency lanes.
  - Aggregator concurrency limits are real and tier-dependent: WaveSpeed Bronze allows 2–3 concurrent tasks ([Kinovi](https://kinovi.ai/blogs/wavespeed-ai-alternatives)), and Krea Pro allows 4 parallel videos ([Krea](https://www.krea.ai/features/api)). Lane-aware scheduling therefore has practical value.
- **License and packaging**
  - Close comparables are AGPL or non-commercial: ArcReel, moyin-creator, Nomi, huobao-drama and short-video-factory.
  - MIT peers include Toonflow, LocalMiniDrama, lumenx and MoneyPrinterTurbo.
  - — repo pages in Q4.
- **Provider coverage**
  - videogen covers DashScope Wan 3, Volcengine/BytePlus Seedance 2.5, Gemini, OpenRouter and OpenAI-compatible endpoints.
  - huobao-drama covers Seedance 2.0, MiniMax H3 and Wan 3.0 ([repo](https://github.com/chatfire-AI/huobao-drama)).
  - LocalMiniDrama adds Kling, Vidu and Veo ([repo](https://github.com/xuanyustudio/LocalMiniDrama)).
  - Nomi reaches models through APIMart, Kie.ai, ModelScope and Dreamina ([repo](https://github.com/aqm857886159/Nomi)).
  - MoneyPrinterTurbo covers MiniMax H3, WaveSpeed, MuAPI and OFox ([repo](https://github.com/harry0703/MoneyPrinterTurbo)).
  - fal and Replicate use their own job schemas, not OpenAI's ([Bifrost #7004](https://github.com/maximhq/bifrost/issues/7004); [Replicate docs](https://replicate.com/docs/reference/http)).
- **Seedance 2.5 economics.** On the 2026-08-22 snapshot, the official BytePlus/Replicate rate at 720p ($0.2312/s) was below Kie ($0.315/s) and WaveSpeed ($0.36/s). A tool calling Ark directly, as videogen does, is cost-competitive for Seedance. — [CellCog](https://cellcog.ai/blog/seedance-2-5-pricing/)

### Inferences
- **Differentiation to emphasise:**
  1. "Batch accounting" (budgets, per-row estimates, cost per kept clip), which no comparable offers.
  2. Spreadsheet/CSV/template-variable bulk runs in a GUI, with no n8n assembly.
  3. Crash-safe, lane-aware queueing that respects per-provider and per-region concurrency.
  4. An MIT license in a field crowded with AGPL and non-commercial terms.
  5. Zero-dependency portable ZIPs, against Electron or Docker stacks.
  6. Shared Chinese and global provider coverage (Ark, DashScope, Gemini, OpenRouter).
- **Highest-risk gaps against table stakes:**
  1. Reference images and character consistency, which nearly every short-drama tool and creator platform headlines.
  2. Assembly and export: concat, subtitles, a 剪映/CapCut draft, or a timeline.
  3. MCP or CLI headless access, which is how 2026 star growth is happening (OpenMontage, hypit, Nomi, 即梦 CLI, OpenArt MCP).
  4. Adapters for the de facto developer aggregators (fal, Replicate, and possibly Kie or WaveSpeed for Chinese users seeking discounts).
  5. Upscaling and edit/extend.
- **Positioning risk.** The popular open-source tools market an outcome ("一句话生成完整短剧", one sentence to a complete short drama). videogen's pitch reads as infrastructure ("batch workbench"). A route to adoption may be to pitch videogen as the "render farm and cost controller" that pairs with script and storyboard tools. Agent skill repos and short-drama tools could hand off a shot list as CSV. This is speculative, but consistent with how fast skill repos are growing (2–7k stars within weeks).
- **Volume economics.** For Veo-heavy users, consumer subscriptions (Flow Ultra) beat BYOK API prices per second by a wide margin. videogen's BYOK value is strongest for Seedance, Wan and Kling via official Chinese clouds and for agency or commercial use, not for Veo hobbyists.

### Gaps
- No user-research data (surveys, issue threads) was gathered on whether target users value budgets and cost-per-kept-clip enough to switch tools.
- videogen's own feature claims were taken from the brief and not re-verified against the codebase in this research pass.
- Whether any closed-source tool, such as an agency SaaS, offers "cost per kept clip" or yield analytics could not be confirmed either way.
