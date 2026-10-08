# Aggregator / Unified-API Platforms for Video Generation (state as of 2026-10-08)

> Method note: outbound page fetches were blocked by this environment's egress policy (WebFetch/curl to openrouter.ai, fal.ai etc. returned DNS/403), so every finding below comes from web-search result summaries of the cited pages, not from reading the pages in full. Numbers are therefore "as reported by the cited page"; many prices come from third-party comparison blogs (often written by competing resellers). Items older than ~3 months or conflicting are flagged inline. Treat all prices as indicative and re-check live pages before budgeting.

## 1. Which platforms carry which video models, and how fast do they add new ones?

### Takeaway
Video is now a first-class category on the big Western aggregators: OpenRouter launched a dedicated video API on 2026-04-15 and by October carries Veo 3.1 (Std/Fast/Lite), Seedance 2.0/2.5, Kling v3/O1, Wan 2.6/2.7/3.0, Hailuo, Grok Imagine and HeyGen. fal.ai and Replicate have the broadest catalogs, and WaveSpeedAI, Runware, Segmind, Atlas Cloud, CometAPI and Kie.ai push hard on Chinese models. Fast aggregators add new flagship models on launch day or within days (Wan 3.0 was live on fal, OpenRouter and Vercel at its 2026-08-24 wide launch). The cloud marketplaces are poor fits. Azure Foundry has no video model left after Sora. Bedrock only has Luma Ray 2 (Nova Reel is reportedly legacy). Vertex shows only Google's own Veo.

### Cited Findings
**OpenRouter**
- OpenRouter announced video generation on 4/15/2026 (a news report says 4/16 UTC+8). Day-one models were Seedance 2.0 and 1.5, Veo 3.1, Wan 2.7 and 2.6, and Sora 2 Pro. — [OpenRouter blog: Announcing Video Generation](https://openrouter.ai/blog/announcements/video-generation/); [KuCoin news](https://www.kucoin.com/news/flash/openrouter-launches-video-generation-api-integrating-sora-2-veo-3-1-seedance)
- The video collection page ranks models by seconds generated over the trailing 7 days. A search summary of the page as updated in October 2026 gave the top three as HeyGen Video, Seedance 2.5 and Veo 3.1 Lite. — [OpenRouter video models collection](https://openrouter.ai/collections/video-models); [HeyGen Video on OpenRouter](https://openrouter.ai/heygen/heygen-video-1)
- Models on OpenRouter's late-September 2026 image-to-video comparison: Veo 3.1, Veo 3.1 Fast and Veo 3.1 Lite; Seedance 2.5, 2.0, 2.0 Fast and 2.0 Mini; Kling v3.0 Pro, v3.0 Standard and Video O1. — [OpenRouter blog: Image-to-Video Models Compared](https://openrouter.ai/blog/insights/image-to-video-models-compared/)
- Further listings: Wan 3.0 (2–30 s, 480p/720p/1080p); MiniMax Hailuo (`minimax/hailuo-3-max`, `minimax/hailuo-2.3`); Grok Imagine Video. — [OpenRouter Kling v3.0 Pro](https://openrouter.ai/kwaivgi/kling-v3.0-pro); [Choose a Video Model cookbook](https://openrouter.ai/docs/cookbook/video-generation/choose-video-model); [Grok Imagine Video](https://openrouter.ai/x-ai/grok-imagine-video)
- An unofficial Open WebUI integration listing claimed 16 OpenRouter video models. It is undated and not authoritative. — [Open WebUI post](https://openwebui.com/posts/openrouter_integration_gpt_52_o3_o1_350_models_wit_9ac806c5)

**fal.ai**
- Third-party counts of fal's catalog differ. One counts 985 endpoints, about 450 of them video. Another says 600+ hosted models. — [Vercel/AI SDK search summary citing teamday & others](https://www.teamday.ai/blog/ai-image-video-api-providers-comparison-2026)
- Wan 3.0 was live on fal on day 0 of the 2026-08-24 wide launch (the public beta via Alibaba started 2026-08-06). It was not exclusive: OpenRouter, Envato and Leonardo carried it the same week. — [Lovis Odin on X](https://x.com/OdinLovis/status/2091728262695465217); [llm-stats Wan 3.0 launch](https://llm-stats.com/blog/research/wan-3.0-launch)
- fal carries Kling 3.0 (Std/Pro, voice control) and Seedance 2.0 (fast, reference-to-video, 720p and 1080p standard). — [fal Kling 3 page](https://fal.ai/kling-3); [Infer: Seedance 2.0 pricing](https://tryinfer.com/pricing/seedance-2-0-pro)
- fal deprecates old endpoints as models move on. The Veo 3 and Veo 3 Fast endpoints were deprecated when Veo 3.1 was added. The `ltx-video-v097` endpoint page is marked "no longer supported". — [usagepricing fal 2026-08-13](https://usagepricing.com/blueprint/activity/fal-ai-2026-08-13-launch); [fal ltx-video-v097](https://fal.ai/models/fal-ai/ltx-video-v097/api)

**Replicate (now Cloudflare)**
- As of September 2026, Replicate "official" models include Veo 3.1, Veo 3.1 Fast, Veo 3.1 Lite, Kling v3 Pro, Kling 2.1, Seedance 2.0 and Wan. — [teamday Sep 2026 pricing comparison](https://www.teamday.ai/blog/ai-api-pricing-comparison-2026)
- Cloudflare announced on 2025-11-17 that it would acquire Replicate. A secondary source says the deal closed in early 2026; no official close notice was found. Replicate said "The API isn't changing." — [BusinessWire](https://www.businesswire.com/news/home/20251117400765/en/Cloudflare-to-Acquire-Replicate-to-Build-the-Most-Seamless-AI-Cloud-for-developers); [Cloudflare blog](https://blog.cloudflare.com/replicate-joins-cloudflare); [rywalker research](https://rywalker.com/research/replicate)
- Cloudflare's own model catalog lists `veo-3.1` and `veo-3.1-fast`, reached as external providers through AI Gateway. — [Cloudflare AI models](https://developers.cloudflare.com/ai/models/)

**Other Western/global aggregators**
- **WaveSpeedAI:** claims 1,000+ models. A review that checked the pricing page on 2026-10-06 listed Wan 3.0, Veo 3.1 Fast, Seedance 2.0/2.5 and Kling 3.0 Std. — [WaveSpeed models](https://wavespeed.ai/models); [WaveSpeed pricing](https://wavespeed.ai/pricing); [Seedance 2.5 on WaveSpeed](https://wavespeed.ai/seedance-2-5-api)
- **Runware:** its "best video models" collection includes Veo 3.1 Fast and Seedance 2.0 Fast. Its video page shows Seedance 1.0 Pro Fast. Model IDs use AIR form, e.g. `bytedance:2@2`, `google:3@3`. — [Runware best video models](https://runware.ai/collections/best-video-models); [Runware video API](https://runware.ai/video-generation-api)
- **Together AI:** carries Wan 2.7 (`Wan-AI/wan2.7-t2v`; launch post ~168 days old), Seedance 2.5 and 2.0, MiniMax H3, HappyHorse 1.0/1.1, Vidu Q1/2.0 (Vidu 2.0 is "not available on Serverless") and Veo 3.0 (third-party listing; Veo 3.0 itself was retired). — [Together Wan 2.7 blog](https://www.together.ai/blog/wan-2-7-now-available-on-together-ai); [Together models](https://www.together.ai/models); [Vidu 2.0](https://www.together.ai/models/vidu-2-0)
- **Novita AI:** Kling v3.0 Std/Pro plus 4K variants, Seedance 1.5 Pro, Wan 2.6/2.7 (incl. VideoEdit), PixVerse V4.5 and Hunyuan Video Fast. — [Novita Kling v3.0 4K](https://blogs.novita.ai/kling-v3-0-4k-api-novita-ai/); [Novita video-api tag](https://blogs.novita.ai/tag/video-api/)
- **Segmind:** ~146 video models covering Kling (3.0, O3), Wan (2.7), Veo, LTX, HunyuanVideo, Mochi, PixVerse and Luma. Its Veo 3 guide is dated 2026-05-14, so check whether the endpoint is now 3.1. — [Segmind video tag](https://www.segmind.com/models/tags/video); [Segmind blog](https://blog.segmind.com/tag/video/)
- **DeepInfra:** open-weight models only, e.g. FastWan 1.3B/5B, Wan2.1-T2V-14B and LTX-2.3 distilled. No Kling or Veo was found. — [DeepInfra text-to-video docs](https://docs.deepinfra.com/apis/text-to-video); [DeepInfra LTX-2.3](https://deepinfra.com/FastVideo/LTX-2.3-Distilled-Diffusers/api)
- **AI/ML API (aimlapi.com):** says it supports "multiple video models". The docs example uses MiniMax video-01, and no current catalog or prices were retrieved. — [AIMLAPI video models docs](https://docs.aimlapi.com/api-references/video-models.md)
- **Eden AI:** pitches a unified interface, but its comparisons reference Kling 2.1 Master (outdated). No current video catalog was found. — [Eden AI best video APIs](https://www.edenai.co/post/best-ai-video-generation-apis)
- **Kie.ai:** lists Seedance 2.0, Veo 3.1 (Lite/Fast/Quality), Kling and Grok Imagine. — [Kie.ai homepage](https://kie.ai/); [bitdoze Kie video guide](https://www.bitdoze.com/kie-ai-video-generation/)
- **PiAPI:** carries Seedance 2.5 (max 720p in the PiAPI contract) and Kling. — [PiAPI Seedance 2.5 specs](https://piapi.ai/ar/blogs/seedance-2-5-api-specifications); [PiAPI Kling blog (2025)](https://piapi.ai/en/blogs/kling-api-pricing-features-documentation)
- **Atlas Cloud:** says it has 300+ or 400+ models (its own pages disagree), claims "Seedance 2.5 first on Atlas Cloud", and carries Seedance 2.0 Mini/Fast, Kling O3 and Wan 2.6. — [Atlas Cloud models overview](https://atlascloud.ai/docs/models/overview); [Atlas cheapest Seedance/Kling/Wan](https://www.atlascloud.ai/blog/guides/cheapest-api-provider-seedance-kling-wan)
- **CometAPI:** Seedance 2.5, Veo 3.1 / 3.1 Fast and Vidu Q3. — [CometAPI AI video API pricing](https://www.cometapi.com/ai-video-api-pricing/)
- **Evolink:** Seedance 2.5/2.0, Wan and HappyHorse. — [Evolink pricing](https://evolink.ai/es/pricing); [Evolink Wan pricing guide](https://evolink.ai/blog/wan-api-pricing-guide)

**Chinese aggregators / 中转**
- **硅基流动 SiliconFlow:** the CN price page lists Wan2.2-I2V-A14B and Wan2.2-T2V-A14B at ¥2.00 per video (snapshot ~99 days old). The international site cites Wan2.1-I2V-14B-720P-Turbo at $0.21 per video. Only open-weight Wan is listed, with no Kling/Veo/Seedance. — [SiliconFlow CN pricing](https://www.siliconflow.cn/pricing); [SiliconFlow cheapest video models article](https://www.siliconflow.com/articles/cheapest-video-multimodal-models)
- **302.AI:** documents Seedance 2.5, 2.0 and 1.5-pro; Kling 3.0 std, Kling omni 3.0 and official-format Kling; Veo (no price found). — [302.AI Seedance 2.5 doc](https://doc.302.ai/498568203e0); [302.AI Kling v3.0 std doc](https://doc.302.ai/416447877e0); [302.AI Kling official API format](https://302.ai/product/detail/kling-t2v-official-api)
- Other relays such as 云雾, 速创 and 多米API sell Veo 3.1, Kling and Jimeng (即梦) through relay endpoints. Most are documented only on apifox pages or in promotional articles. — [速创 Veo 3.1 CSDN tutorial](https://blog.csdn.net/weixin_57978701/article/details/153400432); [多米API 可灵](https://duomiapi.com/doc/66); [apifox relay docs](https://dld7cnfq12.apifox.cn/419972286e0)

**Cloud marketplaces**
- **Azure AI Foundry:** in a May 2026 Microsoft Q&A thread, a Microsoft moderator acknowledged "the absence of an alternative hosted video generation model within Foundry at this time". Retirement dates for sora-2 versions conflict (6/2/26 vs 10/15/26). — [MS Q&A on Sora 2 retirement](https://learn.microsoft.com/en-us/answers/questions/5881436/azure-ai-foundry-sora-2-retirement-date-feels-too); [MS Q&A on sora v2025-05-02](https://learn.microsoft.com/en-sg/answers/questions/5790204/azure-openai-sora-model-sora-v2025-05-02-retiring)
- **AWS Bedrock:** hosts Luma Ray 2 (`luma.ray-v2:0`), ~5–9 s at 540p/720p. Image-to-video was added July 2025, in us-west-2 at launch. A 2026 third-party catalog lists Amazon Nova Reel as "Legacy". No new 2026 Bedrock video model was found. — [AWS Luma docs](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-luma.html); [AWS what's new July 2025](https://aws.amazon.com/about-aws/whats-new/2025/07/image-to-video-generation-luma-ais-ray2-amazon-bedrock); [Bedrock catalog 2026 (third-party)](https://hidekazu-konishi.com/entry/amazon_bedrock_model_catalog_2026.html)
- **Vertex AI:** Media Studio and the video SKUs list Google's own Veo and "Gemini Omni Flash". No Kling or Seedance partner model was found. Veo endpoint retirements recommended migration before 2026-06-30. — [Vertex AI release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes); [Gen AI video SKUs](https://cloud.google.com/skus/sku-groups/gen-ai-video-models)

### Inferences
- For "many models via one key", the realistic catalog leaders are fal, Replicate, WaveSpeed, OpenRouter and Segmind. OpenRouter's catalog is smaller (roughly a dozen to 20 curated video models) but covers the main frontier families: Veo, Seedance, Kling, Wan, Hailuo and Grok.
- None of the cloud marketplaces is a useful multi-model backend for this tool. Azure has nothing, Bedrock has only Luma Ray 2, and Vertex has only Veo.
- Sora 2 Pro was on OpenRouter at launch. After the 2026-09-24 OpenAI shutdown it presumably dropped off (not verified). Aggregators do not protect against an upstream vendor shutting a model down, but they let the user switch models without new keys.
- SiliconFlow's domestic video catalog is narrow (open-weight Wan only). It would serve mainland users for Wan but cannot replace a frontier multi-model aggregator.

### Gaps
- No official, dated model count for OpenRouter video, fal video or Replicate video. The pages could not be fetched.
- AI/ML API, Eden AI and Novita: current video catalogs were not retrievable.
- Whether Sora 2 / Sora 2 Pro listings on aggregators were removed after 2026-09-24 is unverified.
- Runway, Luma Ray 3, Pixverse, Vidu Q3 and LTX-2 availability per aggregator was not systematically verified.

## 2. Price vs. vendor direct price (markup or discount) for reference models

### Takeaway
Pricing splits into three bands:
- **About parity with direct:** OpenRouter (stated no-markup policy, but a ~5.5% fee on credit purchases), fal for Veo and Wan, Replicate for Veo.
- **About 2× direct on some models:** Replicate, Novita and 302.AI on Kling 3.0; fal on Seedance 2.0. PiAPI's Seedance 2.5 looks about 3× OpenRouter's rate.
- **Below official:** Kie.ai, CometAPI, Atlas Cloud and many Chinese relays. Their below-official rates come with substantive trust and reliability risk (see Q6).

### Cited Findings
**Direct baselines (for comparison only)**
- **Veo 3.1 on the Gemini API (Aug 2026):** Standard $0.40/s at 720p/1080p and $0.60/s at 4K, audio included. Fast is $0.10/s (720p) and $0.12/s (1080p). Lite is $0.05/s (720p) and $0.08/s (1080p). — [invideo Aug 2026 normalized pricing](https://invideo.io/blog/ai-video-model-pricing/)
  - Conflict: some blogs still quote ~$0.75/s, which looks like stale Veo 3 pricing. — [magichour](https://magichour.ai/blog/veo-3-pricing)
  - Video-only rates of $0.20/s (Standard), $0.08 (Fast) and $0.03 (Lite 720p) also appear. — [Atlas Veo pricing](https://www.atlascloud.ai/blog/tips/veo-3.1-api-pricing)
- **Kling 3.0 direct:** $0.084/s silent and $0.126/s with audio at 720p; $0.112 and $0.168 at 1080p. — [teamday Sep 2026](https://www.teamday.ai/blog/best-ai-video-models-2026)
  - Kling 3.0 Turbo is 0.8 units, or $0.112/s, with audio at 720p. — [Kling dev pricing](https://kling.ai/dev/pricing)
  - Conflict: invideo says the only official per-second rate is ¥0.8/s for Turbo at 720p and that the rest is sold via plan credits. — [invideo](https://invideo.io/blog/ai-video-model-pricing/)
- **Seedance 2.0 on BytePlus:** $0.76 per 5 s 720p clip (≈$0.152/s); Fast is $0.60 (≈$0.12/s). This implies about $7.00 and $5.60 per million tokens. — [BytePlus ModelArk docs](https://docs.byteplus.com/docs/ModelArk/1544106)
  - Volcengine reportedly charges ¥46 per million tokens. — [technode Mar 2026](https://technode.com/2026/03/05/bytedances-seedance-2-0-video-model-costs-about-0-14-per-second/)
  - Seedance 2.5 is reportedly $10.70 per million tokens (secondary source). — [saascrmreview](https://saascrmreview.com/seedance-pricing/)
- **Wan 3.0 on Alibaba:** list price $0.10/s at 720p and $0.20/s at 1080p. A 30% promo ran Aug 24–Sep 23, 2026 and has ended. — [seeddance.io comparison](https://www.seeddance.io/blog/ai-video-api-pricing-comparison); [technode on Wan 3.0 discount](https://technode.com/?p=198260)
  - Conflict: teamday gives $0.083/s for US/EU. — [teamday](https://www.teamday.ai/blog/best-ai-video-models-2026)

**Aggregator prices (per second unless noted)**

| Model | OpenRouter | fal | Replicate | Others |
|---|---|---|---|---|
| Veo 3.1 Std (audio) | $0.20–$0.60 range ([OR](https://openrouter.ai/blog/insights/image-to-video-models-compared/)) | $0.40; $0.60 at 4K ([tracker, Aug 2026](https://usagepricing.com/blueprint/activity/fal-ai-2026-08-13-launch)) | $0.40 audio / $0.20 silent ([teamday, checked 2026-09-23](https://www.teamday.ai/blog/ai-api-pricing-comparison-2026)) | CometAPI $0.32 ([CometAPI](https://www.cometapi.com/ai-video-api-pricing/)); Kie Quality 1080p $1.275/video vs "official $3.20" ([Kie](https://kie.ai/)) |
| Veo 3.1 Fast | $0.08–$0.30 | $0.15 audio / $0.10 silent (older rate) | $0.15 audio / $0.10 silent | WaveSpeed from $0.10; CometAPI $0.08 (720p); Kie 1080p $0.325/video |
| Veo 3.1 Lite | $0.03–$0.08 | n/a | $0.05 | Kie 1080p $0.175/video |
| Kling 3.0 Std (silent/audio) | $0.084 / $0.126 ([OR](https://openrouter.ai/kwaivgi/kling-v3.0-std)) | fal page "from $0.168" (conflict) ([fal](https://fal.ai/kling-3)) | – | Novita $0.168 / $0.252 ([Novita](https://blogs.novita.ai/ru/kling-v3-0-on-novita/)); 302.AI 5 s = 0.84 / 1.26 PTC → $0.168 / $0.252 ([302 doc](https://doc.302.ai/416447877e0)); WaveSpeed $0.084; Kie $0.07 silent ([bitdoze](https://www.bitdoze.com/kie-ai-video-generation/)) |
| Kling 3.0 Pro (silent/audio) | $0.112 / $0.168 ([OR](https://openrouter.ai/kwaivgi/kling-v3.0-pro)) | $0.112 / $0.168 ([teamday](https://www.teamday.ai/blog/ai-api-pricing-comparison-2026)) | $0.224 / $0.336 ("2× FAL") | Novita $0.224 / $0.336; PiAPI ~$0.10–0.20 (competitor-sourced, [apiframe](https://apiframe.ai/blog/kling-3-0-api-providers)) |
| Seedance 2.0 | from $0.067 (480p); $0.151 at 720p with video input | $0.3034 (720p std); $0.682 (1080p) ([Infer](https://tryinfer.com/pricing/seedance-2-0-pro)) | $0.18 (720p) | WaveSpeed 5 s 720p $1.20 (= $0.24/s); 302.AI 7.884 PTC per million tokens (vs BytePlus $7.00, so ~13% markup) ([302 doc](https://doc.302.ai/437932283e0)); Kie ~$0.057; Atlas Fast ~$0.076–0.112 |
| Seedance 2.5 | from $0.1028 (480p), ~$0.231 (720p), up to $2.08 at 4K with audio ([OR](https://openrouter.ai/bytedance/seedance-2.5)) | listed (unverified) | – | CometAPI $0.103 / $0.231; WaveSpeed from $0.18; PiAPI $0.30 (480p) / $0.60 (720p) ([PiAPI](https://piapi.ai/ar/blogs/seedance-2-5-api-specifications)); 302.AI 10 PTC per million tokens |
| Wan 3.0 | from $0.0425 (15% discount shown) | $0.05 (480p) / $0.10 (720p) / $0.20 (1080p); Prime $0.068 / $0.14 / $0.28 ([llm-stats](https://llm-stats.com/blog/research/wan-3.0-launch)) | – | WaveSpeed from $0.05 |
| Wan 2.x | – | – | – | Together Wan 2.7 $0.10 (unit conflicts with "$0.10/video" cards) ([Together](https://www.together.ai/blog/wan-2-7-now-available-on-together-ai)); SiliconFlow Wan2.2 ¥2/video; Atlas Wan 2.6 $0.07; CometAPI Wan 2.6 $0.08 (720p) |

Sources for the cells not linked above: the OpenRouter ranges come from [OpenRouter blog: Image-to-Video Models Compared](https://openrouter.ai/blog/insights/image-to-video-models-compared/); the fal Veo figures from [usagepricing](https://usagepricing.com/blueprint/activity/fal-ai-2026-08-13-launch); the Replicate figures from [teamday](https://www.teamday.ai/blog/ai-api-pricing-comparison-2026); the WaveSpeed figures from [WaveSpeed pricing](https://wavespeed.ai/pricing) via a review that checked it on 2026-10-06; the Kie figures from [Kie homepage](https://kie.ai/); the CometAPI figures from [CometAPI](https://www.cometapi.com/ai-video-api-pricing/); and the Atlas figures from [Atlas guide](https://www.atlascloud.ai/blog/guides/cheapest-api-provider-seedance-kling-wan).

**Fee structures and markup claims**
- OpenRouter says it never marks up provider pricing and that users pay the provider's listed price. — [OpenRouter FAQ](https://openrouter.ai/docs/faq)
  - Its revenue is a credit-purchase fee: 5.5% (min $0.80) for cards and 5% for crypto, per third parties. A Business tier reportedly pays 8%. — [Amnic](https://amnic.com/blogs/openrouter-pricing); [OpenRouter support](https://openrouter.ai/support)
- Cloudflare AI Gateway has no per-request fee. Unified Billing adds 5% on purchased credits, and provider inference prices pass through. — [truefoundry on Cloudflare AI Gateway](https://www.truefoundry.com/blog/cloudflare-ai-gateway-pricing)
- Vercel AI Gateway reportedly passes through provider list prices with no markup, and BYOK has no fee (third-party claim). — [LLM Reference](https://www.llmreference.com/provider/vercel-ai-gateway)
- TrustedRouter (a different service) charges direct provider price +20% for video. — [TrustedRouter pricing](https://trustedrouter.com/pricing)
- invideo claims resellers "typically charge 2–3× official rates". — [invideo](https://invideo.io/blog/ai-video-model-pricing/)
- **Free trials and minimums:**
  - WaveSpeed has no subscription. New accounts get $1 trial credit, and some premium models are excluded on trial credit. — [useaiforx WaveSpeed](https://useaiforx.com/tool/wavespeed-ai/)
  - Kie credits are $0.005 each; a typical video costs 100–500 credits (~$0.50–2.50); failed jobs are reportedly not charged. — [bitdoze Kie review](https://www.bitdoze.com/kie-ai-review/)
  - fal bills only successful outputs; server errors and queue time are free. — [fal pricing docs](https://fal.ai/docs/documentation/model-apis/pricing)
- Runware claims open-source video models run "up to 90% less than market rates". Its only visible price row was Seedance 1.0 Pro Fast at $0.160 per 5 s 1080p clip, shown as "46% lower" than $0.300. — [Runware video API](https://runware.ai/video-generation-api)
- Novita lists Seedance 1.5 Pro at $0.006–0.026/s silent. This is implausibly low compared with others; flagged as possibly misread. — [Novita blog search summary](https://blogs.novita.ai/tag/video-api/)

### Inferences
- OpenRouter (and Vercel AI Gateway, if its no-markup claim holds) offers the most predictable near-direct pricing across vendors. Its effective markup is the ~5.5% top-up fee.
- fal and Replicate are near parity on Google models but can be ~2× on Chinese models: fal on Seedance 2.0, Replicate on Kling 3.0. A tool cannot assume any single aggregator is cheapest for every model, which argues for supporting 2–3 backends.
- Sora2App's Batch mode relied on OpenAI's ~50% batch discount. No aggregator in this survey offers anything comparable (see Q3). The cheapest bulk route is choosing cheaper tiers (Veo 3.1 Lite, Seedance 2.0 Mini/Fast, Wan 3.0 at 480p), not a batch API.
- The steep below-official prices (Kie at ~25% of Google list; ~60–73% below official per Kie's own comparison) imply grey supply such as pooled consumer accounts or promotional credits. Treat them as higher-risk (see Q6).

### Gaps
- No live, first-party price page could be opened. All aggregator figures are secondhand and may be stale. The fal Veo 3.1 Fast rate of $0.15 with audio predates Google's apparent cut to $0.10–0.12.
- The unit for Together AI (per video vs per second) is ambiguous.
- Prices on AI/ML API, Segmind, Eden AI and Runware (Kling/Veo) were not found.
- Hailuo / MiniMax H3 prices on aggregators were not found. Direct: $0.08/s at 768P and $0.13/s at 2K ([invideo](https://invideo.io/blog/ai-video-model-pricing/)).

## 3. API shape: unified vs per-model schema, async flow, webhooks, retention, batch, concurrency, auth, plain-fetch friendliness

### Takeaway
OpenRouter is the only major aggregator found with a truly unified video schema:
- One endpoint, `POST /api/v1/videos`, with normalized `duration`, `resolution`, `aspect_ratio`, `frame_images`, `generate_audio` and `seed`.
- Job polling, plus a `/content` download.
- HMAC-signed webhooks and a bearer key.

This is structurally very close to the OpenAI Videos API that Sora2App already wraps. fal, Replicate, WaveSpeed, Runware, Kie, 302.AI and the rest share the async pattern (submit → poll or webhook → download) but keep per-model input schemas. No aggregator offers a discounted batch mode for video. All are callable with plain `fetch` (HTTPS + JSON + header key); none needs an SDK.

### Cited Findings
**OpenRouter**
- **Flow:** `POST /api/v1/videos` creates a job and returns a job ID. The client polls until done, then downloads from `/api/v1/videos/{jobId}/content`. — [OpenRouter video docs](https://openrouter.ai/docs/guides/overview/multimodal/video-generation); [code-first guide](https://openrouter.ai/blog/tutorials/video-generation-api/)
- **Unified request parameters:**
  - `frame_images[]` entries carry `frame_type` = `first_frame` or `last_frame`.
  - Resolution, aspect_ratio, duration and frame types are per-model and must be checked against the models endpoint.
  - Provider-specific passthrough parameters (e.g. `output_config`) are allowed.
  - Sources: [OpenRouter submit API reference](https://openrouter.ai/docs/api/api-reference/video-generation/submit-a-video-generation-request); [openrouter-video skill](https://github.com/OpenRouterTeam/skills/tree/main/skills/openrouter-video)
- **Routing:** an image input is routed to the image-to-video endpoint and a reference character to the character-consistency endpoint. "The endpoint, auth, polling loop, and download logic stay the same", but duration and aspect ratio still need per-model tailoring. For example, Veo 3.1 accepts 4/6/8 s and Wan 2.6 only 5 or 10 s; an unsupported value returns an error. — [OpenRouter code-first guide](https://openrouter.ai/blog/tutorials/video-generation-api/)
- **Webhooks:**
  - An optional `callback_url` (HTTPS) is set per job and overrides a workspace default.
  - Receivers verify `X-OpenRouter-Signature` (HMAC-SHA256 over the raw body), reject stale timestamps, and dedupe on `X-OpenRouter-Idempotency-Key`.
  - The completion event includes job ID, status, model slug and usage cost.
  - Sources: [OpenRouter webhooks cookbook](https://openrouter.ai/docs/cookbook/video-generation/video-generation-webhooks); [Announcing Video Generation](https://openrouter.ai/blog/announcements/video-generation/)
- **Billing:** metered per second of generated video. — [OpenRouter collections](https://openrouter.ai/collections/video-models)

**fal.ai**
- **Queue flow:** submit to `https://queue.fal.run/{model-id}`, poll `/requests/{request_id}/status`, fetch the result at `/requests/{request_id}`, or use webhooks (`webhookUrl` in the client). There is also an HTTP streaming route, `/{model-id}/stream`. — [api-evangelist fal profile](https://github.com/api-evangelist/fal-ai); [apidog fal guide](https://apidog.com/blog/fal-ai-api/)
- **Concurrency:**
  - New accounts start at 2 concurrent requests.
  - The limit rises automatically with credit purchases, up to 40; more requires contacting sales.
  - Requests over the limit are queued, not rejected.
  - Source: [fal FAQ](https://fal.ai/docs/model-apis/faq)
- **Media retention:**
  - Media stays on the fal CDN for at least 7 days by default; per-request control via the `X-Fal-Object-Lifecycle-Preference` header.
  - Output URLs (`v3.fal.media`) are public.
  - Request JSON inputs and outputs are stored 30 days by default; the `X-Fal-Store-IO: 0` header opts out.
  - Sources: [fal media expiration](https://fal.ai/docs/documentation/model-apis/media-expiration); [fal FAQ md](https://fal.ai/docs/documentation/model-apis/faq.md)
- **Low balance:** when the balance falls below a lock threshold, API requests are rejected (enterprise invoice customers are exempt). — [fal pricing docs](https://fal.ai/docs/documentation/model-apis/pricing)

**Replicate**
- **Data retention:** API-created predictions have inputs, outputs, output files and logs removed after about 1 hour by default. The `output` key stays but becomes null. — [Replicate data retention](https://replicate.com/docs/topics/predictions/data-retention.md); [2023 changelog](https://replicate.com/changelog/2023-01-04-api-prediction-data-no-longer-stored)
- **Webhooks:** fire on start, output, logs and completed (`webhook_events_filter`). They follow the Standard Webhooks format (`webhook-id`, `webhook-timestamp`, `webhook-signature`). — [Replicate webhooks](https://replicate.com/docs/topics/webhooks); [Hookdeck guide](https://hookdeck.com/webhooks/platforms/guide-to-replicate-webhooks-features-and-best-practices.md)
- **Timeout:** predictions time out after 30 minutes unless support raises the limit. — [Replicate webhooks docs (search summary)](https://replicate.com/docs/topics/webhooks.md)
- **Input schema:** per model and version (no unified video schema). — [Replicate OpenAPI](https://replicate.com/docs/reference/openapi)

**WaveSpeedAI**
- Results come from the `data.urls.get` URL returned at submit or from `GET /api/v3/predictions/{task-id}/result`. Don't poll the history endpoint. Generated media URLs are temporary. — [WaveSpeed predictions API](https://wavespeed.ai/docs/predictions-api)
- A third-party review reports that outputs expire within 7 days. — [useaiforx](https://useaiforx.com/tool/wavespeed-ai/)
- New accounts are limited to 5 predictions per minute and 2 concurrent tasks until a top-up. One review says higher tiers need $100–$10,000 top-ups. — [useaiforx](https://useaiforx.com/tool/wavespeed-ai/); [Filmora review](https://filmora.wondershare.com/video-editor-review/wavespeed-ai-review.html)
- Webhook docs were not found.

**Runware**
- Requests are arrays of task objects: `taskType: "videoInference"`, `deliveryMethod: "async"`. Poll with `taskType: "getResponse"` plus `taskUUID`, or set `webhookURL`. Both REST and WebSocket transports exist, and the SDKs poll automatically. — [Runware task polling](https://runware.ai/docs/platform/task-polling.md); [Runware video inference intro](https://runware.ai/docs/video-inference/introduction)

**Kie.ai**
- Create a task, then poll `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=…` or receive `callBackUrl` callbacks. This is from a third-party connector catalog, not Kie's own reference. — [withone Kie connector](https://www.withone.ai/knowledge/kie-ai/conn_mod_def%3A%3AGK8MKvN1HnA%3A%3A4Gzk1PQqRqK3FBZ9gvy2OA)
- Download links are valid for 20 minutes; one action's video URL lasts 14 days. Kie offers per-key rate caps and an IP allowlist. — [withone Kie download URL](https://www.withone.ai/knowledge/kie-ai/conn_mod_def%3A%3AGK8MJbH6cjg%3A%3AO5uQkMnBQUO9WY3IAfs6RA); [Kie getting started](https://kie.ai/getting-started)

**AI/ML API**
- `POST /v2/generate/video`, then a separate call to retrieve the file. Credits are charged at generation. A balance endpoint is at `GET /v2/billing`. — [AIMLAPI video docs](https://docs.aimlapi.com/api-references/video-models.md)

**Together and DeepInfra**
- Together uses per-model endpoints such as `Wan-AI/wan2.7-t2v`. — [Together Wan 2.7](https://www.together.ai/blog/wan-2-7-now-available-on-together-ai)
- DeepInfra uses per-model inference URLs and recommends webhooks for video. — [DeepInfra text-to-video](https://docs.deepinfra.com/apis/text-to-video)

**Chinese relays**
- Relays built on the open-source **new-api** gateway expose a unified `POST /v1/video/generations`. Common fields are model, prompt, duration, fps, width/height, image and seed; vendor-specific options go in `metadata`. — [new-api generate-video docs](https://docs.newapi.pro/api/generate-video)
- Many relays also expose native passthrough paths (e.g. `/kling/v1/videos/text2video`, Jimeng-format endpoints). Some forward OpenAI's `/v1/videos` format unchanged. — [apifox relay docs](https://6lsfyizlhl.apifox.cn/api-409118280); [APIYI Sora 2 overview](https://docs.apiyi.com/en/api-capabilities/sora-2/overview.md)
- 302.AI documents automatic credit refund on failed tasks (status=50). — [302.AI Kling doc](https://doc.302.ai/416447877e0)

**Batch and bulk discounts**
- Gemini Batch Mode (50% off, results within 24 h) is documented for Gemini models. No Veo batch tier was found. A secondary source says Sora 2 was "the one place in the field where a batch discount is published". — [Google Developers Blog: Batch Mode](https://developers.googleblog.com/scale-your-ai-workloads-batch-mode-gemini-api/); [search summary on Veo batch](https://www.cometapi.com/ai-video-api-pricing/)
- Of the aggregators covered, only Segmind was seen with a time-limited promotion ("Seedance 2 Fast 50% off"), and that is a discount, not a batch API. — [Segmind blog](https://blog.segmind.com/seedance-2-fast-api-50-off-on-segmind-the-best-seedance-cost-for-developers/)

### Inferences
- **Minimal-change migration:** OpenRouter's job model (create → poll → GET content) and its per-model capability metadata map almost one-to-one onto Sora2App's current OpenAI Videos flow (create → poll status → download MP4). The first-frame reference image maps to `frame_images[{frame_type:"first_frame"}]`. This makes OpenRouter the lowest-effort first backend.
- **Webhooks are not needed:** the app binds to 127.0.0.1 and cannot receive public webhooks without a tunnel, so polling should stay the default. Every platform here supports polling.
- **Download promptly:** retention varies from about 1 hour (Replicate) to 20 minutes for Kie download links to at least 7 days (fal, WaveSpeed). The existing "auto-download MP4 to a local folder" feature becomes mandatory, and should run soon after completion, especially for Replicate.
- **Batch mode must change:** with no batch discount anywhere, "Batch" should become a client-side queue with a concurrency limit per provider (fal starts at 2, WaveSpeed at 2), not an OpenAI-style batch file upload. Blank-line prompt splitting can stay. The 50,000-request scale and ~50% discount framing should be dropped.
- **Zero-dependency Node fits:** all of these platforms accept HTTPS + JSON + a header API key, so plain `fetch` is enough. fal's queue, Replicate's predictions, OpenRouter's videos and WaveSpeed's v3 predictions need no SDK.
- **fal privacy option:** fal's `X-Fal-Store-IO: 0` header lets a privacy-minded client keep fal from storing request JSON.

### Gaps
- Exact auth header formats (e.g. fal's `Authorization: Key …` vs `Bearer`) could not be verified from fetched docs. Prior knowledge suggests fal uses a "Key" prefix and Replicate/OpenRouter use "Bearer"; verify before coding.
- Undocumented or unverified:
  - OpenRouter: output URL / content retention period for video jobs, and concurrency limits for video.
  - Replicate: concurrency limits for official video models.
  - WaveSpeed: webhook support.
  - Whether OpenRouter's `/api/v1/videos` is literally wire-compatible with OpenAI's `/v1/videos` (field names such as `seconds` vs `duration` likely differ).

## 4. Model-discovery APIs: can a client list video models and their input schemas programmatically?

### Takeaway
Yes, on the main platforms:
- **OpenRouter `GET /api/v1/videos/models`:** returns normalized capabilities (durations, resolutions, aspect ratios, frame-image types, audio, pricing SKUs, allowed passthrough params). It is the best fit for auto-supporting new models with one generic UI.
- **fal Platform API model search:** can return each endpoint's full OpenAPI 3.0 schema (`expand=openapi-3.0`).
- **Replicate:** publishes a per-version OpenAPI schema and a collections API.
- **Vercel AI Gateway:** has a public `GET /v1/models`.

fal and Replicate give raw per-model JSON Schemas, which would need a dynamic form generator. OpenRouter gives a small, uniform capability set.

### Cited Findings
- **OpenRouter:**
  - The models endpoint returns per-model `supported_resolutions`, `supported_aspect_ratios`, `supported_sizes`, `supported_durations` (often discrete, e.g. [4,6,8]), `supported_frame_images`, `generate_audio`, `seed`, `pricing_skus` and `allowed_passthrough_parameters`. — [OpenRouter list video models API reference](https://openrouter.ai/docs/api/api-reference/video-generation/list-all-video-generation-models); [openrouter-video skill](https://github.com/OpenRouterTeam/skills/tree/main/skills/openrouter-video)
  - Example: `google/veo-3.1-lite` has `supported_durations: [8,4,6]` and `supported_frame_images: ["first_frame","last_frame"]`. — [OpenRouter cookbook image-to-video](https://openrouter.ai/docs/cookbook/video-generation/image-to-video)
  - Docs are slightly inconsistent: the overview example omits the frame field that the API reference includes. — [OpenRouter video docs](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- **fal:**
  - The model search endpoint supports `expand=openapi-3.0`, which embeds the full OpenAPI 3.0 schema per model. The example endpoint_id is `fal-ai/wan/v2.2-a14b/text-to-video`. — [fal Platform API: model search](https://fal.ai/docs/platform-apis/v1/models)
  - Auth is optional for search; a key raises rate limits.
  - The Platform API's own OpenAPI 3.1 (`api.fal.ai/v1/openapi.json`) requires an admin key. — [fal OpenAPI schema](https://docs.fal.ai/reference/platform-apis/openapi-schema)
  - fal has category browse pages (e.g. text-to-video APIs). — [fal explore text-to-video](https://fal.ai/explore/text-to-video-apis)
- **Replicate:**
  - The public HTTP API is described at `api.replicate.com/openapi.json`, including `/collections` and `/models/{owner}/{name}/predictions`. — [Replicate OpenAPI reference](https://replicate.com/docs/reference/openapi)
  - Each model version carries its own OpenAPI input/output schema. — [Replicate changelog 2023-02-16](https://replicate.com/changelog/2023-02-16-openapi-schema)
  - A text-to-video collection page was not confirmed.
- **Vercel AI Gateway:**
  - `GET https://ai-gateway.vercel.sh/v1/models` needs no auth and mirrors OpenAI's list format. `GET /v1/models/{creator}/{model}/endpoints` lists providers for a model. — [Vercel AI Gateway REST API](https://vercel.com/docs/ai-gateway/sdks-and-apis/rest-api)
  - Docs conflict on whether pricing is included in the response. — [Vercel models & providers](https://vercel.com/docs/ai-gateway/models-and-providers)
- **Cloudflare:** a model catalog exists for Workers AI and external providers (veo-3.1 listed). — [Cloudflare AI models](https://developers.cloudflare.com/ai/models/)

### Inferences
- **Recommended design:** one generic form driven by OpenRouter's capability metadata (dropdowns for duration, resolution and aspect; a first/last-frame upload toggle; an audio toggle). That gives "auto-support new models" with little code.
- **Optional advanced mode:** for fal or Replicate, render forms from JSON Schema. This is heavier, and validation errors are model-specific.
- **Caching:** cache the models listing locally (it is not a secret), but never persist the key, consistent with Sora2App's BYOK rule.

### Gaps
- Live samples of the OpenRouter or fal responses could not be retrieved, so full field lists, pagination and video category filters (e.g. fal `category=text-to-video`) are unverified.
- Discovery APIs for WaveSpeed, Runware, Kie, 302.AI and SiliconFlow were not found.

## 5. Payment methods and accessibility (mainland China, Japan, Korea)

### Takeaway
- **OpenRouter:** accepts cards, Alipay and USDC, but reportedly needs a proxy from mainland China.
- **WaveSpeedAI:** the most payment-friendly Western-facing option for this user base (cards, PayPal, WeChat Pay, Alipay, Naver Pay).
- **Evolink:** accepts Alipay/WeChat Pay.
- **302.AI and SiliconFlow:** target domestic Chinese users, with Alipay/UnionPay and direct domestic access (302.AI self-reported). SiliconFlow's video catalog is narrow.
- **fal and Replicate:** no information on Alipay or China access was found.

No platform-specific blocking for Japan or Korea was found.

### Cited Findings
- **OpenRouter payments:** the official FAQ lists major cards, Alipay and USDC; PayPal is "in progress". Unused credits are refundable within 24 h; platform fees and crypto payments are not refundable. — [OpenRouter support/FAQ](https://openrouter.ai/support)
- **OpenRouter from mainland China:**
  - A tracker lists it as "Requires proxy". — [yangmao.ai OpenRouter China access](https://yangmao.ai/en/providers/openrouter/china-access/)
  - codepick calls OpenRouter a poor fit for anyone needing mainland direct access or RMB payment, and describes "limited AliPay". — [codepick OpenRouter guide](https://codepick.dev/en/guides/openrouter-guide/)
  - One Chinese tutorial claims no special network setup is needed (conflicting, low authority). — [pyvideotrans](https://pyvideotrans.com/openrouter)
- **WaveSpeedAI:** payment methods are Stripe cards, PayPal, WeChat Pay, Alipay and Naver Pay. Credits never expire. — [WaveSpeed payment methods](https://wavespeed.ai/docs/payment-methods)
  - A Stripe case study says 14 methods were enabled. — [Stripe customer story](https://stripe.com/customers/wavespeedai)
- **Evolink:** top up by card, Alipay/WeChat Pay or corporate transfer; 1 credit ≈ $0.0147; minimum $10. — [Evolink pricing](https://evolink.ai/es/pricing)
- **302.AI:**
  - Pay-as-you-go, no monthly plan, minimum $5. — [302.AI help FAQ](https://help.302.ai/en/docs/FAQ); [302 price FAQ](https://price.302.ai/en/faq/)
  - A third-party comparison lists Alipay, Visa, MC, Amex and UnionPay, with 1 PTC ≈ $1 and generally no refunds after top-up. — [computeunion CN relay comparison](https://www.computeunion.net/zh/api-pricing/cn-relay)
  - It claims "more stable and faster access for domestic users" (self-reported). — [302 AI Studio docs](https://docs.studio.302.ai/en/docs/features/model-providers/302ai)
- **SiliconFlow:** runs separate domestic (.cn, RMB) and international (.com, USD) sites, and says the old `api.siliconflow.com` endpoint will be phased out. — [SiliconFlow release notes](https://docs.siliconflow.cn/docs/release-notes/overview); [SiliconFlow CN pricing](https://www.siliconflow.cn/pricing)
- **Kie.ai:** prepaid wallet; credits reportedly don't expire. — [bitdoze Kie review](https://www.bitdoze.com/kie-ai-review/)
- **fal:** prepaid credits. The searched docs did not cover payment methods or regional restrictions. — [fal pricing docs](https://fal.ai/docs/documentation/model-apis/pricing)
- **Atlas Cloud:** markets card checkout to international teams as a way to avoid needing Alipay/WeChat for Chinese models. — [Atlas: pay Chinese AI APIs without Alipay/WeChat](https://www.atlascloud.ai/ar/blog/guides/pay-chinese-ai-apis-no-alipay-wechat)
- **Direct-in-China options:** Kling (可灵) and Jimeng (即梦) have official domestic entry points directly accessible in mainland China. A 2026 test noted Jimeng price increases. — [Zhihu 2026 video tools comparison](https://zhuanlan.zhihu.com/p/2000323147233255761); [Tencent Cloud dev community 2026 recommendations](https://cloud.tencent.com/developer/article/2652999)

### Inferences
- **Mainland China:** a single Western aggregator key (OpenRouter or fal) will likely need a user-side proxy. Sora2App already needed one for OpenAI. A configurable base URL plus an HTTPS proxy setting is the minimal accommodation. Node ≥22.21 `fetch` honors proxies only with `NODE_USE_ENV_PROXY=1`, so the zero-dependency design needs care.
- **Two-backend design:** to serve mainland users without a proxy, a "Chinese backend" (302.AI-style relay, SiliconFlow for Wan, or vendors' domestic APIs, which other researchers cover) is a separate adapter, not something one global key can do.
- **Japan and Korea:** OpenRouter (cards) and WaveSpeed (Naver Pay for Korea) appear workable. No evidence of JP/KR blocking was found, but none was explicitly confirmed either.

### Gaps
- Not found:
  - fal and Replicate accepted payment methods (Alipay? crypto?).
  - Whether fal, Replicate, WaveSpeed or Kie are reachable from mainland China without a proxy, or allow CN phone/email sign-up.
  - JP/KR-specific payment rails (e.g. Japanese konbini, KakaoPay), other than Naver Pay on WaveSpeed.
  - Official 云雾 payment and video information.

## 6. Reliability, trust, ToS, data retention and shutdown/price-change history

### Takeaway
Established aggregators are reasonably trustworthy and publish retention rules:
- **fal:** CDN media at least 7 days, request JSON 30 days with an opt-out header.
- **Replicate:** API outputs deleted after about 1 hour. Now under Cloudflare, API unchanged.
- **OpenRouter:** stated no-markup policy.

Model churn is the dominant risk: Sora 2 shut down 2026-09-24, Veo 3 was retired 2026-06-30, and a Veo 3.1 deprecation date of 2026-11-17 is reported but unverified. Aggregators reduce key-management pain but do not prevent model removal. Cheap 中转 relays and Kie.ai carry documented risks: model substitution, outages, stuck jobs, payment glitches and regulatory crackdowns in China.

### Cited Findings
**Model churn**
- OpenAI announced Sora's discontinuation on 2026-03-24. The app closed 2026-04-26 and the API on 2026-09-24, with no successor. — [OpenAI help: Sora discontinuation](https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation); [Wikipedia: Sora](https://en.wikipedia.org/wiki/Sora_(text-to-video_model))
- Google shut down the Veo 3 API on 2026-06-30, replaced by Veo 3.1. — [Segmind/market overview via search](https://blog.segmind.com/7-affordable-ai-video-generators-to-replace-veo-3-in-2026/); [Vertex AI release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes)
- A cloudprice listing shows a Veo 3.1 endpoint "Deprecating 2026-11-17". This is unverified against Google. — [cloudprice Veo 3.1](https://cloudprice.net/models/google-veo-3-1)
- Kling 4.0 is in early access, with a public release planned for October 2026, so expect another catalog change. — [costgoat Kling pricing Oct 2026](https://costgoat.com/pricing/kling)

**Replicate**
- Its terms of service were updated 2026-05-30: support, breach and dispute contacts moved to a web portal. — [conductatlas Replicate ToS change](https://conductatlas.com/change/2026-05-30-replicate-replicate-terms-of-service-2491/)
- A June 2026 review says cold starts remain its main weakness. — [aireiter Replicate review 2026](https://aireiter.com/zh/blog/replicate-ai-review-2026-pricing-alternatives)

**Retention and privacy**
- fal: media at least 7 days, public URLs, request JSON 30 days unless `X-Fal-Store-IO: 0`. — [fal media expiration](https://fal.ai/docs/documentation/model-apis/media-expiration)
- Replicate: API inputs and outputs purged after 1 hour. — [Replicate data retention](https://replicate.com/docs/topics/predictions/data-retention.md)
- WaveSpeed: outputs expire within 7 days; commercial use depends on each model's terms. — [useaiforx](https://useaiforx.com/tool/wavespeed-ai/)

**Kie.ai**
- **Ratings and stability:**
  - A 2026 review reports a Trustpilot rating of 2.5/5 (about 10 reviews), "Reddit threads full of error reports", and users calling Kie's Sora 2 API "completely broken".
  - It also reports credits vanishing in a "glitch", and Kie removing Midjourney after Midjourney demanded it.
  - Source: [aireiter Kie AI review 2026](https://aireiter.com/blog/kie-ai-review-2026)
- **Trustpilot reviews:** mention outages and a job stuck for 24 hours with no refund; one 5-star review praises the docs. These reviews are from Jan and Mar 2026, so older than 3 months. — [Trustpilot Kie](https://ca.trustpilot.com/review/kie.ai)

**Chinese relays (中转) risk**
- **Audits** (secondary reporting; which claim comes from which page could not be verified):
  - A March 2026 CISPA audit of 17 relays found that most lacked verifiable identity, didn't disclose upstream models, and switched upstreams silently.
  - In the same audit, Gemini-2.5-flash medical-QA accuracy was 83.82% via the official API vs about 37% via relays.
  - A 100-relay evaluation found model substitution, context truncation, poisoning and data theft.
  - Sources: [Zhihu: 揭秘中转站 45% 假模型](https://zhuanlan.zhihu.com/p/2032951488624977427); [大模型中转站研究与测评报告（2026）](https://www.gm7.org/archives/158091); [安全内参: AI中转站掺假倒卖token](https://www.secrss.com/articles/90746)
- **Regulation:** an April 2026 crackdown closed hundreds of non-compliant relays, and a relay operator was criminally detained in May 2026 for reselling cheap interfaces. Same secondary reporting; specific attribution unverified. — [Zhihu: AI中转站资质](https://zhuanlan.zhihu.com/p/2053108165076575812); [SegmentFault 2026 gateway selection guide](https://segmentfault.com/a/1190000048118811)
- **Below-official pricing:** Kie's homepage advertises Veo 3.1 at roughly 60–73% below official per-video prices. — [Kie.ai](https://kie.ai/)

**Platform status and vendor stability**
- Azure Foundry had no hosted video model after Sora (Microsoft moderator, May 2026). Users there are pointed to the Foundry blog and Azure Updates for future additions. — [MS Q&A](https://learn.microsoft.com/en-us/answers/questions/5881436/azure-ai-foundry-sora-2-retirement-date-feels-too)
- In July 2026 Alibaba joined a $2.8B financing round for Kling AI. — [Bloomberg Law](https://news.bloomberglaw.com/ip-law/chinas-kling-ai-raises-2-billion-to-expand-ai-video-1)

### Inferences
- **Vendor risk:** an aggregator converts single-vendor shutdown risk into single-aggregator dependency. Supporting at least two aggregators with similar shapes (e.g. OpenRouter + fal, or OpenRouter + WaveSpeed) is the robust design. A generic "custom OpenAI-compatible base URL" option would let users point at a 中转 relay at their own risk.
- **Model IDs change often:** Veo 3 to 3.1, Kling 3 to 4, Seedance 2 to 2.5. Hard-coded model lists will rot within months, which supports discovery-driven UIs (Q4).
- **Grey-market relays:** for a BYOK tool, recommending Kie or anonymous relays would expose users to model substitution and lost credits. They are better kept as an "advanced / custom endpoint" option with a warning than as a default.

### Gaps
- Not found:
  - Third-party uptime statistics (status-page history) for OpenRouter video, fal, Replicate or WaveSpeed.
  - Explicit ToS clauses on whether OpenRouter, fal, Replicate or WaveSpeed allow third-party desktop/local clients using the end user's own key. BYOK use by the key owner is generally normal API use, but no specific clause was retrieved.
  - OpenRouter's data-retention or ZDR policy for video jobs specifically.

## 7. Cross-provider developer libraries and standards usable as design references

### Takeaway
There is no formal open standard for video generation. Three de facto designs exist:
1. **The OpenAI Videos shape:** `POST /videos` → job → poll → content. OpenRouter's `/api/v1/videos` and LiteLLM's `/videos` follow it.
2. **The Vercel AI SDK `experimental_generateVideo` abstraction:** providers for Google, fal, Kling, Replicate and xAI; Vercel AI Gateway adds Veo, Kling, Wan, Grok Imagine and Seedance.
3. **The new-api `POST /v1/video/generations`:** common fields plus vendor `metadata`; widely used by Chinese relays.

All three are useful references. OpenRouter's capability metadata is the most complete "schema for many models".

### Cited Findings
- **Vercel AI SDK `experimental_generateVideo`:**
  - Experimental; supports text-to-video and image-to-video.
  - `n` with `maxVideosPerCall` runs parallel calls; `abortSignal` and `providerOptions` handle timeouts and vendor-specific options; first/last-frame interpolation is supported; `NoVideoGeneratedError` exists.
  - Providers: Google Veo, fal (`@ai-sdk/fal`), Kling AI, Replicate, xAI. Vercel's guide suggests a timeout of at least 10 minutes.
  - Sources: [Vercel KB: AI SDK video generation](https://vercel.com/kb/guide/ai-sdk-video-generation); [ai@7.0.40 docs on unpkg](https://app.unpkg.com/ai@7.0.40/files/docs/03-ai-sdk-core/38-video-generation.mdx); [generate-video reference](https://app.unpkg.com/ai@7.0.40/files/docs/07-reference/01-ai-sdk-core/13-generate-video.mdx)
- **Vercel AI Gateway video:**
  - Beta for Pro and Enterprise plans and paid gateway users; requires AI SDK v6+.
  - Models: Veo, Kling, Wan (incl. `alibaba/wan-v3.0-video`, up to 30 s), Grok Imagine Video, and Seedance 2.0 (catalog date 2026-04-14).
  - Sources: [Vercel AI Gateway video generation docs](https://vercel.com/docs/ai-gateway/modalities/video-generation); [Vercel blog mirror](https://drss.io/feed/npub10vuuzme78zazljpt5new8mltdrn30rm9wf9a3ytf5k247vuf5t6qus2wgk/video-generation-with-ai-gateway); [createwith: Vercel adds Wan 3.0](https://www.createwith.com/tool/vercel/updates/vercel-adds-wan-30-to-ai-gateway-for-longer-video-generation); [Vercel ByteDance models](https://vercel.com/ai-gateway/models/labs/bytedance)
- **OpenRouter community provider for the AI SDK:** uses `openrouter.videoModel('google/veo-3.1')` and handles submit, poll and download automatically. — [OpenRouter Vercel AI SDK community docs](https://openrouter.helicone.ai/docs/community/vercel-ai-sdk)
- **LiteLLM:**
  - `/videos` follows OpenAI's video API spec, with generation, remix, status and retrieval routes.
  - The top-level table lists openai and azure. Separate pages cover vertex_ai (veo-2.0 and veo-3.x previews), gemini (veo-3.0/3.1 previews) and runwayml (gen4_turbo; page updated 2026-10-02).
  - fal in LiteLLM covers only `/images/generations`; no Kling or Seedance pages.
  - Duration-based cost tracking.
  - Sources: [LiteLLM videos](https://docs.litellm.ai/docs/videos); [LiteLLM Vertex Veo](https://docs.litellm.ai/docs/providers/vertex_ai/videos); [LiteLLM RunwayML videos](https://docs.litellm.ai/docs/providers/runwayml/videos); [LiteLLM fal](https://docs.litellm.ai/docs/providers/fal_ai)
- **LiteLLM release notes:** the newest seen was v1.93.0 (2026-07-18), with no video items. A 2026-03-16 blog post covered video character, edit and extension APIs. — [LiteLLM release notes](https://docs.litellm.ai/release_notes/); [LiteLLM blog archive](https://docs.litellm.ai/blog/archive)
- **new-api:** unified `POST /v1/video/generations` with `model`, `prompt`, `duration`, `fps`, `width`/`height`, `image` and `seed`, plus vendor parameters in `metadata`. The example uses `kling-v1`. — [new-api docs](https://docs.newapi.pro/api/generate-video)
- **OpenAI Videos API shape (original Sora2App target):** `POST /videos` returns a job with queued/in_progress statuses. — [OpenAI video generation guide](https://developers.openai.com/api/docs/guides/video-generation)

### Inferences
- **Core interface:** Sora2App's zero-dependency constraint rules out importing the AI SDK or LiteLLM, but their abstractions are a good model for an internal `VideoProvider` interface:
  - `listModels()`
  - `submit({model, prompt, duration, resolution, aspect, firstFrame, lastFrame, audio, seed, extra})`
  - `poll(id)`
  - `download(id)`
- **Provider adapters:** OpenRouter (unified), fal (queue + per-model schema), Replicate (predictions + per-version schema), and an optional "OpenAI-compatible / new-api-compatible custom base URL" adapter for Chinese relays.
- **What to borrow from the AI SDK:** its `n` / `maxVideosPerCall` parallelism with an abort timeout is close to what a client-side batch queue needs, replacing OpenAI's Batch API.

### Gaps
- Whether Vercel AI Gateway's video endpoint can be called over plain REST (without the AI SDK) was not confirmed. Its docs frame video as AI SDK-only (`experimental_generateVideo`).
- No IETF/W3C-style or industry-consortium standard for video generation APIs was found.
- Whether the AI SDK has added ByteDance or Luma provider packages for video is unconfirmed.
