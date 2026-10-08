# Chinese Closed-Source Video Generation APIs as Sora 2 Replacements (state as of 2026-10-08)

> **Method note for the report writer:** WebFetch could not resolve any of the target hosts during this session: artificialanalysis.ai, volcengine.com, docs.volcengine.com and arena.ai all returned DNS failure. So every finding below comes from search-engine extracts of the pages cited, not from a full read of each page. Official-domain citations (volcengine.com, help.aliyun.com, klingai.com, platform.minimax*, platform.vidu.*, docs.bigmodel.cn, cloud.tencent.com, cloud.baidu.com) count as primary. Third-party blogs and resellers are marked as such.
>
> **Date flags:** `[>3mo]` means the source or fact predates roughly 2026-07-08. `[UNVERIFIED]` means a single secondary source or conflicting sources. `[CONFLICT]` means sources disagree, and both are given.
>
> **FX assumption for my own conversions:** about ¥7.1 per US$1. All "≈" conversions and per-clip totals are my arithmetic, not provider figures.

---

## 1. Current models and capabilities per provider (duration, resolution, audio, T2V/I2V, first+last frame, multi-reference, extension)

### Takeaway
As of early October 2026 the Chinese frontier is Seedance 2.5 (ByteDance), Wan 3.0 and HappyHorse 1.1 (Alibaba), MiniMax H3, Kling 3.0 (Kling 4.0 is in beta, with no API yet) and Vidu Q3. The current generation (Seedance 2.5, Wan 3.0, Kling 4.0) has moved to 15–30 s single generations, native audio, and many-reference "omni" inputs. Every one of these can do text-to-video (T2V) and first-frame image-to-video (I2V), which are the two features Sora2App used. Zhipu CogVideoX, Tencent Hunyuan and Baidu MuseSteamer are second-tier or legacy for this use case.

### Cited Findings

**ByteDance Seedance (Volcengine Ark 火山方舟 / BytePlus ModelArk)**
- Seedance 2.0 launched officially on 2026-02-12. [Wikipedia: Seedance 2.0](https://en.wikipedia.org/wiki/Seedance_2.0) (as relayed in [The Decoder](https://the-decoder.com/bytedance-rolls-out-seedance-2-0-to-100-countries-but-keeps-the-us-off-the-list/)). Volcengine announced full API availability in April 2026 `[>3mo]`. [科技日报 stdaily 2026-04-14](https://www.stdaily.com/web/gdxw/2026-04/14/content_502009.html); [腾讯新闻 2026-04-16](https://news.qq.com/rain/a/20260416A065I400)
- The international BytePlus launch offered 4–15 s MP4 at up to 720p, with generate, edit and extend operations `[>3mo]`. [The Decoder](https://the-decoder.com/bytedance-rolls-out-seedance-2-0-to-100-countries-but-keeps-the-us-off-the-list/)
- Model IDs include `doubao-seedance-2-0-260128` and `doubao-seedance-2-5-260628`. The 2.0 family also has `fast`, `mini` and a 4K tier. [Volcengine create-task doc](https://docs.volcengine.com/docs/ark/create-video-generation-task-api); [Volcengine pricing](https://www.volcengine.com/docs/82379/1099320)
- Seedance 2.5 was unveiled on 2026-06-23 at the FORCE conference, with full rollout expected in early July. [Sohu](https://www.sohu.com/a/1040428121_121124377). One third-party source dates the official API launch to 2026-07-31 `[UNVERIFIED]`. [UIED](https://www.uied.cn/posts/921565)
- Seedance 2.5 spec from the official model list: 4–30 s, 24 fps, mp4/mov; 480p and 720p at 8-bit, 1080p at 10-bit. [Volcengine 模型列表](https://www.volcengine.com/docs/82379/1593703). Reseller docs add that 1080p is H.265 and there is no 4K. [API易](https://docs.apiyi.com/live/2026-08/seedance-2-5-launch)
  - `[CONFLICT]` The Volcengine activity-page FAQ says the maximum is 720P/30 s. [Volcengine activity page](https://www.volcengine.com/activity/seedance25). Pre-launch press claimed 4K; this is unconfirmed. [Sina](https://www.sina.cn/news/detail/5313012132742329.html)
- Seedance 2.5 reference inputs: up to 30 images, 10 videos (≤30 s total) and 10 audio clips (2–30 s each, ≤30 s total), with 50 assets in all. The 2.0 limits were 9 images, 3 audio/video clips and 12 assets in all. It supports multi-round extension (多轮延长). [Volcengine Seedance 2.5 tutorial](https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh); [Qiniu news](https://news.qiniu.com/archives/1782264799288)
- One endpoint covers T2V, I2V, first+last frame and real-person reference. [崔庆才 blog](https://cuiqingcai.com/3751317.html)
- Seedance 1.5 Pro is marked "即将下线" (to be retired). [Volcengine Seedance tutorial](https://docs.volcengine.com/docs/ark/video-generation-tutorial?lang=zh)

**Kuaishou Kling (可灵)**
- The Kling 3.0 series was released in February 2026 `[>3mo]`. [SuperCLUE arena via search](https://superclueai.com/arena?tab=board&type=video); [Kuaishou IR](https://ir.kuaishou.com/news-releases/news-release-details/kling-ai-launches-30-model-ushering-era-where-everyone-can-be/)
  - API models: Kling 3.0 (720P/1080P/4K, with or without audio), 3.0 Omni (multi-reference, optional reference video), 3.0 Turbo (with audio, 720P/1080P, launched 2026-06-17) and 3.0 Motion Control. [Kling 定价](https://www.klingai.com/dev/pricing); [Kling API 更新公告](https://www.klingai.com/document-api/updates/api)
- The "API 2.0" upgrade (2026-07-15) covers Kling 3.0, 3.0 Omni and 3.0 Motion Control. Some early models, effect templates and virtual try-on were scheduled for retirement from 2026-09-15. [Kling API 更新公告](https://www.klingai.com/document-api/updates/api)
- Kling 3.0 Turbo durations are 3–15 s (reseller table). [Renderful](https://renderful.ai/blog/kling-api-pricing). `[CONFLICT]` One roundup claims Kling 3.0 does 30 s single shots, while other material says about 15 s (extendable). [SegmentFault roundup](https://segmentfault.com/a/1190000048003670)
- **Kling 4.0** entered internal beta on 2026-09-28, with official launch "in October". [虎嗅](https://www.huxiu.com/moment/1284349.html); [IT之家](https://www.ithome.com/1/008/073.htm)
  - Full 4.0: 3–30 s, up to 4K, 10 keyframes, 15 mixed references, 10-bit HDR (some of this is marked "coming soon").
  - 4.0 Flash: T2V, I2V and Omni Reference; ≤20 s; ≤720p 8-bit SDR; no first/last-frame or multi-keyframe input. [Atlas Cloud spec comparison](https://www.atlascloud.ai/blog/tips/kling-4-flash-vs-full)
  - **The Kling developer site says "Kling 4.0 API Coming Soon", and the pricing page says current plans don't support 4.0.** [WaveSpeed](https://wavespeed.ai/blog/ai-news/kling-4-0-release-date/); [GitHub kling-4-guide](https://github.com/xianyu110/kling-4-guide)
- Kling 3.x is also resold inside Alibaba Model Studio (`kling-v3-turbo`, `kling-v3`, `kling-v3-omni`) and Tencent TokenHub (`kling-video-v3`). [阿里云 Kling API 文档](https://help.aliyun.com/zh/model-studio/kling-video-generation-api-reference/); [TokenHub API 使用说明](https://cloud.tencent.com/document/product/1823/130078)

**MiniMax (Hailuo 海螺)**
- MiniMax H3 launched on 2026-07-31 with API model ID `MiniMax-H3`. A second model, `MiniMax-H3-Max`, also exists. [MarkTechPost](https://www.marktechpost.com/2026/08/01/minimax-releases-minimax-h3-an-omni-modal-video-model-that-generates-15-second-2k-clips-with-native-stereo-audio/); [MiniMax docs](https://platform.minimax.io/docs/guides/video-generation)
- H3 output: up to 2K, up to 15 s, native stereo audio, joint text/image/video/audio context. [MiniMax blog](https://www.minimax.io/blog/minimax-h3). Third-party detail: 4–15 s in integer seconds, 24 fps, aspect ratios 21:9 to 9:16. [Pexo](https://pexo.ai/blog/what-is-minimax-h3-4020)
- 2K output is a separate "regeneration" step applied to a 768p output. [MiniMax 按量计费](https://platform.minimax.cn/docs/guides/pricing-paygo)
- H3 reference limits: 9 images; 3 video clips (≤15 s total); 3 audio clips, which must accompany an image or video; 12 files in all; prompt ≤7,000 characters. [MarkTechPost](https://www.marktechpost.com/2026/08/01/minimax-releases-minimax-h3-an-omni-modal-video-model-that-generates-15-second-2k-clips-with-native-stereo-audio/)
- First+last-frame (fl2v) and subject-reference (s2v) endpoints exist in the domestic docs. [MiniMax 首尾帧](https://platform.minimax.cn/docs/api-reference/video-generation-fl2v); [MiniMax 主体参考](https://platform.minimax.cn/docs/api-reference/video-generation-s2v)
- Hailuo 2.3 and 2.3-Fast are still priced but described as "legacy". [Magic Hour](https://magichour.ai/blog/hailuo-23-pricing)
- H3 base weights were reportedly published on 2026-08-03 under a MiniMax Community License (commercial use limited to organizations under about US$20M revenue) `[UNVERIFIED]`. Local deployment is out of scope here. [Pexo](https://pexo.ai/blog/what-is-minimax-h3-4020)

**Alibaba Wan 万相 / HappyHorse (Model Studio 阿里云百炼)**
- Wan 3.0 entered public beta on 2026-08-06 and went officially live on 2026-08-24. [百度百科 Wan3.0](https://baike.baidu.com/item/Wan3.0/68449414); [量子位](https://www.qbitai.com/2026/08/478427.html); [TNW](https://thenextweb.com/news/alibaba-wan3-video-model-after-share-sale)
- Model IDs are `wan3.0-video` (standard) and `wan3.0-video-prime`. One model handles T2V, I2V (first frame or first+last), reference-to-video and video editing. [阿里云 Wan3.0 API 参考](https://www.alibabacloud.com/help/zh/model-studio/wan3-video-generation-api-reference); [阿里云 wan3.0-video](https://help.aliyun.com/zh/model-studio/wan3-0-video)
- Wan 3.0 durations: 2–30 s without input video. With an input video, input plus output must total ≤30 s. Resolutions are 480P, 720P and 1080P; claims of 4K are unverified. [AITOP100](https://www.aitop100.cn/infomation/details/34414.html); [Atlas: "No 4K, No Weights"](https://www.atlascloud.ai/blog/tips/wan-3.0-preview)
- Wan 3.0 references: up to 20 assets (10 images, 5 videos ≤15 s total, 5 audio clips ≤15 s total). It also accepts doc/xls/ppt/pdf/md as input. [阿里云开发者社区](https://developer.aliyun.com/article/1754056); [阿里云 Wan3.0 活动页](https://www.aliyun.com/benefit/scene/wan)
- `[UNVERIFIED]` Whether Wan 3.0 generates its own audio track: audio is confirmed as an *input* modality, but official docs are unclear on generated audio. [知乎 公测公告](https://zhuanlan.zhihu.com/p/2068796179165475882)
- Wan 3.0 is listed as "preview", and access requires an application (intl docs). [阿里云 Wan3.0 API 参考 (EN)](https://help.aliyun.com/en/model-studio/wan3-video-generation-api-reference)
- Older Wan models remain available:
  - Wan 2.7 (April 2026) `[>3mo]`
  - wan2.6-t2v: 2–15 s, 720P/1080P, 30 fps
  - wan2.6-i2v-flash
  
  [阿里云 文生视频 API 2.1–2.6](https://help.aliyun.com/zh/model-studio/legacy-wan-text-to-video-api-reference); [阿里云 Wan2.7 T2V](https://www.alibabacloud.com/help/en/model-studio/text-to-video-api-reference)
- HappyHorse:
  - 1.0 appeared anonymously on the Artificial Analysis arena on 2026-04-07; Alibaba confirmed ownership on 2026-04-10 `[>3mo]`.
  - HappyHorse 1.1 went live on Model Studio with full API in late June 2026 `[>3mo]`.
  
  [Alibaba Cloud on X](https://x.com/alibaba_cloud/status/2069018466108186728); [Alibaba Cloud blog](https://www.alibabacloud.com/blog/alibaba-rolls-out-happyhorse-1-0-in-limited-beta_603068); [VentureBeat](https://venturebeat.com/technology/alibabas-ai-video-model-rises-to-no-2-in-global-rankings-as-openais-sora-and-bytedances-seedance-fall-away)
- Model Studio also resells Kling, Vidu, PixVerse (including first+last frame) and MiniMax H3. [阿里云 Vidu](https://help.aliyun.com/zh/model-studio/vidu-image-to-video-api-reference); [阿里云 PixVerse 首尾帧](https://help.aliyun.com/en/model-studio/pixverse-keyframe-to-video-api-reference); [阿里云 MiniMax H3](https://help.aliyun.com/zh/model-studio/minimax-video-generation-api-reference)

**Shengshu Vidu 生数**
- Vidu Q3 was released on 2026-01-30 `[>3mo]`: up to 16 s, 1080p, audio. [百度百科 Vidu Q3](https://baike.baidu.com/item/Vidu%20Q3/67330811)
- Vidu Q3 API variants (Q3 rates apply to I2V, T2V and first+last frame, 1–16 s): [Vidu 产品定价](https://platform.vidu.cn/docs/pricing)
  - `viduq3-pro`
  - `viduq3-turbo`
  - `viduq3-pro-fast` (I2V only)
  - `viduq3-mix` (reference-to-video)
- Reference-to-video supports up to 7 subjects, plus camera control. [Vidu_API Bilibili](https://www.bilibili.com/video/BV1915v6bEcs/)
- Vidu S2 (2026-09-15) is a real-time avatar and real-time editing model (720p at 25–42 FPS) with a WebSocket session API. It is not a batch text-to-video model. [百度百科 Vidu S2](https://baike.baidu.com/item/Vidu%20S2/69064067); [GitHub shengshu-ai/vidu-s-api](https://github.com/shengshu-ai/vidu-s-api)

**PixVerse 爱诗科技 (domestic brand 拍我AI)**
- PixVerse V6: 1–15 s, 360p/540p/720p/1080p, native audio optional, 4K via upscale (+5 credits/s). [Somake](https://www.somake.ai/blog/pixverse-ai-pricing); [PixVerse V6 review](https://pixverse.ai/en/blog/pixverse-v6-ai-video-generator-review)
- PixVerse runs separate international (pixverse.ai) and domestic 拍我AI (pixverseai.cn) open platforms. [PixVerse Platform Docs](https://docs.platform.pixverse.ai/how-does-the-api-work-882967m0); [拍我AI 开放平台](https://docs.platform.pai.video/6740005m0)

**Zhipu 智谱 (CogVideoX / 清影)**
- The flagship is CogVideoX-3: first+last frame, multiple resolutions up to 4K, text/image/first-last input. CogVideoX-2 and the free CogVideoX-Flash are still listed. [智谱 CogVideoX-3](https://docs.bigmodel.cn/cn/guide/models/video-generation/cogvideox-3); [智谱 API 定价](https://docs.bigmodel.cn/cn/guide/start/pricing)

**Tencent Hunyuan 混元**
- HY-Video-1.5 (T2V and I2V) appears in TokenHub free-pack listings `[>3mo]`. But the current TokenHub API doc lists only PixVerse-Video-v6, Kling-Video-V3 and MiniMax-Video-H3 as video models. [TokenHub API 使用说明](https://cloud.tencent.com/document/product/1823/130078); [腾讯云开发者社区](https://cloud.tencent.com/developer/article/2626756)
- The legacy 混元生视频 product is migrating to TokenHub. The old platform will add no new models and stop new purchases. [腾讯云 混元生视频计费](https://cloud.tencent.com/document/product/1616/118994); [TokenHub 迁移通知](https://cloud.tencent.com/announce/detail/2310)

**Baidu 百度蒸汽机 MuseSteamer**
- MuseSteamer 2.0 is available on Qianfan in several variants. The doc was updated 2026-01-29 `[>3mo]`. [千帆 创建视频生成任务](https://cloud.baidu.com/doc/qianfan-api/s/Xme6ul5g4); [千帆 蒸汽机](https://cloud.baidu.com/doc/qianfan-docs/s/amejnlwya)
  - I2V Turbo with audio (5/10 s, 720P, multi-speaker)
  - I2V Turbo silent
  - Pro (1080P)
  - Lite
  - effects

**Other entrants**
- Kunlun 昆仑万维 SkyReels V4 was released on 2026-03-27 with an API platform (skyreels.ai/api-platform), and was reported #1 on Artificial Analysis in March 2026 `[>3mo]`. [云南网](https://m.yunnan.cn/system/2026/03/19/033922015.shtml); [东方财富](https://caifuhao.eastmoney.com/news/20260330114634199148410)
- StepFun 阶跃: Step-Video-T2V (2025, open weights). No 2026 video-generation API was found on platform.stepfun.com. [阶跃开放平台](https://platform.stepfun.com/); [量子位 2025](https://www.qbitai.com/2025/02/255199.html)
- SenseTime 商汤: Seko is a creator agent that wraps other models; no public 2026 video API was found. [量子位](https://www.qbitai.com/2025/09/338127.html)
- Meituan LongCat-Video is open-weights only. The LongCat API serves LLMs. [腾讯云开发者社区](https://cloud.tencent.com/developer/article/2656554)

### Inferences
- **Feature parity with Sora2App's current feature set (T2V plus an optional first-frame image):** every major provider covers it, namely Seedance 2.0/2.5, Kling 3.0, MiniMax H3, Wan 3.0/2.6, Vidu Q3 and PixVerse V6. "First+last frame" and "multi-reference" are where the APIs diverge. Multi-reference is the main new capability Sora 2 lacked, and the request shape differs per vendor.
- **Capability matrix** (✓ = documented; ? = not confirmed in this session):

| Provider / model | Max s per call | Max res | Native audio | T2V | I2V first | First+last | Multi-ref | Extend/edit |
|---|---|---|---|---|---|---|---|---|
| Seedance 2.5 | 30 | 1080p (720p per one FAQ) | ✓ (audio ref in) | ✓ | ✓ | ✓ | ✓ (50 assets) | ✓ multi-round extend |
| Seedance 2.0 / fast / mini | 15 | 1080p (+4K tier on 2.0) | ✓ | ✓ | ✓ | ✓ | ✓ (12 assets) | ✓ |
| Kling 3.0 / Omni / Turbo | ~15 (conflict) | 4K (3.0) / 1080p (Turbo) | ✓ | ✓ | ✓ | ? | ✓ (Omni) | ? |
| Kling 4.0 (no API yet) | 30 (Flash 20) | 4K (Flash 720p) | ? | ✓ | ✓ | ✓ (Flash ✗) | ✓ 15 | ? |
| MiniMax H3 / H3-Max | 15 | 2K (via regen) | ✓ stereo | ✓ | ✓ | ✓ (fl2v endpoint) | ✓ 12 files | regen to 2K |
| Wan 3.0 / prime | 30 | 1080p | ? (audio in ✓) | ✓ | ✓ | ✓ | ✓ 20 | ✓ edit |
| Vidu Q3 | 16 | 1080p | ✓ | ✓ | ✓ | ✓ | ✓ (mix, 7 subjects) | ? |
| PixVerse V6 | 15 | 1080p (4K upscale) | ✓ | ✓ | ✓ | ✓ (via Model Studio) | ✓ (reference-to-video) | ? |
| CogVideoX-3 | ? | 4K | ? | ✓ | ✓ | ✓ | ? | ? |
| MuseSteamer 2.0 | 10 | 1080p (Pro) | ✓ (Turbo audio) | ? | ✓ | ? | ? | ? |

### Gaps
- Kling 3.0's exact maximum duration and whether it supports first+last frame and video extension could not be confirmed from kling.ai, whose pages could not be opened.
- Whether Wan 3.0 produces generated audio, as opposed to accepting audio input, is unclear in official docs.
- Seedance 2.5's maximum resolution conflicts between the official model list (1080p) and the activity-page FAQ (720p).
- HappyHorse 1.1's exact spec and model ID on Model Studio were not found.
- No 2026 video API was found for StepFun or SenseTime. "Utopai X" appears at #2 on the Artificial Analysis board, but its origin wasn't verified; it is believed to be non-Chinese.

---

## 2. Pricing: per second / per video, RMB vs USD, domestic vs international, free quotas

### Takeaway
List prices for mainstream 720p output cluster around **¥0.4–1.5 per second domestically, or about US$0.05–0.23 per second internationally**. International (USD) list prices are generally at parity with, or about 8–18% above, domestic RMB prices at ¥7.1/$. The cheapest credible routes for bulk work are Vidu Q3 off-peak (half price), MiniMax H3-Max 480p/768p, and Wan 3.0 480p. Seedance 2.5 is the most expensive per second. Many headline "cheap" prices were time-limited promotions, and most have already expired: Seedance fast/mini ended 10-07, Wan 3.0's 70% off ended around 09-23/24, and Seedance 2.5 1080p's 72% ended 09-17.

### Cited Findings

**Seedance (token-billed; tokens ≈ width × height × fps × seconds / 1024)**
- **Volcengine Ark list prices (¥ per 1M tokens, without video input / with video input):** [Volcengine 模型价格](https://www.volcengine.com/docs/82379/1099320); [Ark product page](https://www.volcengine.com/product/ark)
  - Seedance 2.0 480p/720p: 46 / 28
  - Seedance 2.0 1080p: 51 / 31
  - Seedance 2.0 4K: 26 / 16 (4K availability unclear)
  - 2.0 fast: 37 / 22
  - 2.0 mini: 23 / 14
  - **Seedance 2.5: 70 / 42**
- Official worked example: 15 s 720p at 24 fps ≈ 308,880 tokens ≈ ¥8.65 with video input. That implies about 20.6k tokens per second at 720p. [Volcengine article](https://www.volcengine.com/article/2687010); [智源社区 "1秒1元"](https://hub.baai.ac.cn/view/52906)
- **BytePlus ModelArk list prices (US$ per 1M tokens, without / with video input):**
  - Seedance 2.0 480p/720p: $7.00 / $4.30
  - Seedance 2.0 1080p: $7.70 / $4.70
  - Seedance 2.0 4K: $4.00 / $2.40
  - 2.0 fast: $5.60 / $3.30
  - 2.5: $10.70 / $6.40, which works out to about $0.103/s at 480p and $0.231/s at 720p without video input.
  
  These are third-party summaries of BytePlus pages. [CometAPI](https://www.cometapi.com/seedance-2-5-api-pricing/); [CellCog](https://cellcog.ai/blog/seedance-2-5-pricing/); [Framesurfer](https://framesurfer.com/blogs/seedance-2-0-pricing)
- Volcengine resource packs (deductible only against online inference, valid 90 days): [Volcengine 资源包规则](https://docs.volcengine.com/docs/ark/seedance-2-0-model-resource-pack-rules?lang=zh); [Volcengine AI 普惠季](https://www.volcengine.com/activity/ai618)
  - Seedance 2.0: ¥28 per 1M tokens (minimum 7 packs), ¥280 per 10M, ¥2,800 per 100M.
  - Fast: ¥22 per 1M.
  - A promo page lists ¥196 for 7M and ¥280 for 10M tokens. It covers 2.0 only (not fast or mini), with deduction "最高约 1:1.8". The end date is unknown.
- BytePlus packs: $4.30/1M, $43/10M and $430/100M for 2.0; $3.30/1M for fast. `[CONFLICT]` One source says $4.30 is the with-video rate rather than a pack price. [CometAPI](https://www.cometapi.com/seedance-2-5-api-pricing/)
- BytePlus free quota: 2M tokens per account, shared between the Experience Center and the API. This is stated in the Seedance 1.0 Pro-era guide `[>3mo]`, and its current applicability is unknown. [BytePlus blog](https://www.byteplus.com/en/blog/seedance-1-0-pro-guide-api-pricing)
- Expired promotions: [Volcengine 2.0-fast 活动](https://www.volcengine.com/article/2686777); [Volcengine Seedance 2.0 Mini 活动](https://www.volcengine.com/activity/seedance2)
  - Seedance 2.0 fast at 75% of list and 2.0 mini (480p/720p) at 40% of list, enterprise users only, 2026-08-07 to 2026-10-07.
  - Seedance 2.5 1080p at 72% of list ended 2026-09-17.
  - Third-party articles still quote "¥0.6/s fast 720p" from the promotion.

**Kling**
- Domestic (official): 1 credit (积分) = ¥1 for video APIs. Rates per second: [Kling 定价](https://www.klingai.com/dev/pricing)
  - 3.0 silent: ¥0.6 (720P) / ¥0.8 (1080P) / ¥3.0 (4K)
  - 3.0 with audio: ¥0.9 / ¥1.2 / ¥3.0
  - 3.0 Turbo (audio): ¥0.8 (720P) / ¥1.0 (1080P)
  - 3.0 Omni: silent 0.6/0.8/3.0; with audio 0.8/1.0/3.0; with reference video 0.9/1.2/3.0
  - Motion control: ¥0.9 (standard) / ¥1.2 (high quality)
- International: 1 unit ≈ $0.14 at list. [CostBench](https://costbench.com/software/ai-media-apis/kling-api/); [Kling3.pro guide](https://kling3.pro/blog/kling-ai-api-guide)
  - Per-second list: $0.084 (720p silent), $0.112 (1080p), $0.42 (4K); with audio $0.126 / $0.168; Turbo audio $0.112 / $0.14.
  - Trial packs: $9.80 for 100 units and $98 for 1,000 units (30 days, 5 concurrent tasks).
  - Package 1: $700 for 5,000 units ($0.14/unit, 180 days, 20 concurrency).
  - `[CONFLICT]` Larger tiers vary by source: $3,780 for 30k units, $4,200 for 30k, $5,670 for 45k, $7,560 for 60k, all around $0.126/unit. [eesel](https://www.eesel.ai/blog/kling-ai-pricing); [AtlasCloud](https://www.atlascloud.ai/blog/guides/kling-ai-api-pricing)
- API resource packs are separate from consumer subscriptions: a subscription grants no API access, and API credits can't be used on the web. [Kling3.pro guide](https://kling3.pro/blog/kling-ai-api-guide)
- Failed tasks, including those that fail content moderation, are not charged (third-party citing Kling's billing doc). [aiapiprice](https://aiapiprice.com/keling-api-jiage/)
- Domestic RMB pack prices were not found. The 2024 "¥59.99 for 30 days / 100 calls" figure is outdated `[>3mo]`. [知乎 2024](https://zhuanlan.zhihu.com/p/711213593)
- Kling 4.0 has no API price yet. Consumer beta reports put Flash at 6 credits/s at 720p, but that is web-app credits, not API. [什么值得买](https://post.smzdm.com/p/ad7mxkwd/)

**MiniMax**
- Domestic (official pay-as-you-go page, ¥ per output second): [MiniMax 按量计费](https://platform.minimax.cn/docs/guides/pricing-paygo)
  - H3: ¥0.50 (768P), ¥0.80 (2K)
  - H3-Max: ¥0.33 (480P), ¥0.50 (768P)
  - 768P→2K regeneration: ¥0.30/s
  - Input video is billed at the output rate; input audio is free; images beyond 5 cost ¥0.15 each (regeneration path).
- International: [Apiframe](https://apiframe.ai/blog/ai-video-api-pricing-2026); [OpenRouter H3](https://openrouter.ai/minimax/hailuo-3); [MiniMax PayGo (intl)](https://platform.minimax.io/docs/guides/pricing-paygo)
  - H3: $0.08/s (768p), $0.13/s (2K)
  - H3-Max: $0.05/s (480p), $0.08/s (768p)
  - Regeneration: $0.05/s; extra images $0.04 each
- Hailuo 2.3 (legacy, per clip): $0.28 for 6 s at 768p, $0.49 for 6 s at 1080p, $0.56 for 10 s at 768p. 2.3-Fast: $0.19 for 6 s at 768p. [Magic Hour](https://magichour.ai/blog/hailuo-23-pricing)
- MiniMax video resource packs cover the Hailuo series only, not H3. [MiniMax 视频资源包](https://platform.minimaxi.com/docs/guides/pricing-video)
- 量子位 (August 2026) covered a price war in which H3 fell to "a few fen" (几分钱) on some channels. Metaso lists 2K at ¥0.15/s and 768P at ¥0.09/s as a limited 80%-off offer; this is a reseller, not MiniMax. [量子位](https://www.qbitai.com/2026/08/467036.html); [秘塔](https://metaso.cn/minimax-h3)

**Alibaba Wan / Model Studio**
- **wan3.0-video, Beijing:** ¥0.3 / ¥0.6 / ¥1.2 per second (480P / 720P / 1080P). A "限时7折" took this to 0.21/0.42/0.84, running 08-24 to about 09-23/24 and now expired. [千问AI平台](https://www.qianwenai.com/models/wan3.0-video); [阿里云 模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)
- **wan3.0-video-prime, Beijing:** ¥0.45 / ¥0.9 / ¥1.8 per second. [阿里云 Wan3.0 活动页](https://www.aliyun.com/benefit/scene/wan)
- **wan3.0-video, International scope (Singapore):** $0.05 / $0.10 / $0.20 per second. "Global" scope is $0.041 / $0.083 / $0.165. Prime under International is $0.068 / $0.14 / $0.28. [阿里云 wan3.0-video](https://docs.modelstudio.console.alibabacloud.com/zh/model-studio/wan3-0-video); [wan3.0-video-prime (EN)](https://www.alibabacloud.com/help/en/model-studio/wan3-0-video-prime)
- Free quota: 30 s per Wan 3.0 version, valid 90 days from activation or model approval. wan2.6 gets 50 s. Singapore free quota applies only to Singapore/International-scope models. [阿里云 Wan3.0 模型信息](https://help.aliyun.com/zh/model-studio/wan3-0-video); [Alibaba Cloud free quota](https://www.alibabacloud.com/help/en/model-studio/new-free-quota)
- wan2.6-t2v: Beijing ¥0.6 (720P) / ¥1.0 (1080P) per second (third-party, about 292 days old `[>3mo]`). Singapore $0.10 / $0.15 (official page). [阿里云开发者社区](https://developer.aliyun.com/article/1695854)
- wan2.7-i2v with audio: ¥0.6 (720P) / ¥1.0 (1080P) per second (third-party). [阿里云开发者社区](https://developer.aliyun.com/article/1763163)
- For I2V, input is free and only the output seconds of successful jobs are billed. For reference-to-video, input video seconds are billed too. [阿里云 模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)
- HappyHorse: the only price found is HappyHorse 1.0 on fal at $0.14/s (720p) and $0.28/s (1080p); fal is an aggregator. Model Studio's own 1.1 price was not found. [Lunostudio](https://www.lunostudio.ai/blog/happyhorse-alibaba-ai-video-model)

**Vidu**
- Domestic: 1 credit = ¥0.03125. International: 1 credit = $0.005 plus local tax. [Vidu 产品定价 (CN)](https://platform.vidu.cn/docs/pricing); [Vidu Pricing (intl)](https://platform.vidu.com/docs/pricing)
- Q3 credits per second, standard (off-peak in brackets):
  - pro: 1080p 24 (12), 720p 20 (10), 540p 9 (5)
  - turbo: 1080p 13 (7), 720p 12 (6), 540p 7 (4)
  - pro-fast (I2V only): 1080p 15 (8), 720p 12 (6)
  - `[CONFLICT]` The international table has turbo 720p at 11, and pro-fast at 25 (1080p) and 20 (720p).
  - Off-peak applies to Q3 pro and turbo only with `audio=true`.
- Conversions (my arithmetic): Q3 pro 1080p ≈ ¥0.75/s or $0.12/s. Turbo 720p ≈ ¥0.375/s, or about ¥0.19/s off-peak.
- Q2 uses a "start fee + per-second" model, not the Q3 formula. [Vidu 产品定价](https://platform.vidu.cn/docs/pricing)

**PixVerse**
- V6: 1080p is 18 credits/s silent and 23 with audio. 540p is 7 / 9. A 5 s 720p silent clip costs 45 credits. [Atlas PixVerse API](https://www.atlascloud.ai/blog/tips/pixverse-api); [Somake](https://www.somake.ai/blog/pixverse-ai-pricing)
- Credit packs run from $10 for 1k to $5,000 for 500k, about $0.01 per credit. [Comparedge](https://comparedge.com/tools/pixverse/pricing)
- API subscriptions (unused credits don't roll over): [Comparedge](https://comparedge.com/tools/pixverse/pricing)
  - Essential: $100/month for 15,000 credits
  - Scale: $1,500/month for 239,230 credits
  - Business: $6,000/month for 1,069,500 credits
- Effective cost is about $0.10–0.15/s at 1080p (Atlas estimate). [Atlas PixVerse V6](https://www.atlascloud.ai/blog/tips/pixverse-v6-review)
- Domestic 拍我AI API prices were not found.

**Zhipu**
- CogVideoX-3: ¥1 per call (no Batch). CogVideoX-2: ¥0.5 per call, or **¥0.25 per call via Batch API**. CogVideoX-Flash: free. [智谱 API 定价](https://docs.bigmodel.cn/cn/guide/start/pricing)

**Baidu / Tencent**
- MuseSteamer:
  - The launch price was about ¥1.4 per 5 s (August 2025) `[>3mo]`. [量子位 2025](https://www.qbitai.com/2025/08/324824.html)
  - MuseSteamer-Air I2V is 1 credit (¥1) per 5 s. [千帆 计费](https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya)
  - 2.0 per-variant 2026 prices were not found.
- Tencent:
  - HY-Video on TokenHub is token-billed; no figure was found.
  - The legacy 混元生视频 product sold concurrency at enterprise prices, e.g. 视频风格化 at ¥16,500 per concurrency per month `[>3mo]`. [腾讯云 计费概述](https://cloud.tencent.com/document/product/1616/118994)

### Inferences
- **Normalized 720p list price per second** (my conversions; Seedance uses about 20.6k tokens/s at 720p, 9.7k at 480p and 48.6k at 1080p):

| Model (720p unless noted) | Domestic ¥/s | Intl US$/s | Intl premium vs domestic @7.1 |
|---|---|---|---|
| Seedance 2.0 (no video input) | ≈0.95 | ≈0.144 | ≈+8% |
| Seedance 2.0 fast | ≈0.76 | ≈0.115 | ≈+7% |
| Seedance 2.0 mini | ≈0.47 | n/a | n/a |
| Seedance 2.5 | ≈1.44 | ≈0.22–0.23 | ≈+8% |
| Kling 3.0 silent / audio | 0.6 / 0.9 | 0.084 / 0.126 | ≈0% (unit $0.14 ≈ ¥1) |
| Kling 3.0 Turbo (audio) | 0.8 | 0.112 | ≈0% |
| MiniMax H3 (768p) / H3-Max 480p | 0.50 / 0.33 | 0.08 / 0.05 | ≈+14% / +8% |
| Wan 3.0 std / prime | 0.6 / 0.9 | 0.10 / 0.14 (Intl scope) | ≈+18% / +10% |
| Vidu Q3 turbo (off-peak) | 0.375 (≈0.19) | 0.06 (0.03) | ≈+14% |
| Vidu Q3 pro (off-peak) | 0.625 (≈0.31) | 0.10 (0.05) | ≈+14% |
| PixVerse V6 1080p silent | n/a | ≈0.12–0.18 | n/a |

- **A 5,000-clip batch of 8 s 720p silent clips** (40,000 s, roughly what one Sora2App batch run might look like) at list price (my arithmetic):
  - Vidu Q3 turbo off-peak: ≈¥7.5k (off-peak on Q3 requires `audio=true`, so these would be with-audio clips)
  - MiniMax H3-Max 480p: ≈¥13k; H3 768p: ≈¥20k
  - Wan 3.0 720p: ≈¥24k
  - Kling 3.0 720p silent: ≈¥24k
  - Seedance 2.0: ≈¥38k
  - Seedance 2.5: ≈¥58k
- Kling's domestic and global list prices are at exact parity (all published USD rates = credits × $0.14), so there is no reason to route around the region. For Wan and MiniMax, the domestic RMB route is slightly cheaper, but it requires a mainland account.
- Promotions are frequent and short (2–8 weeks). A BYOK app should not hard-code prices. If it shows cost estimates, they should come from a user-editable or remotely updated price table carrying an "as-of" date.

### Gaps
- Official pages could not be opened directly. Several international USD figures (Kling global packs, BytePlus token prices, MiniMax intl) come from third-party summaries of the official pages.
- Seedance 2.5's 1080p rate is not separately confirmed.
- Kling's domestic RMB resource-pack prices and any current free trial quota were not found.
- Model Studio's price for HappyHorse 1.1 was not found.
- 拍我AI domestic API pricing was not found.
- Baidu MuseSteamer 2.0 2026 per-variant prices were not found.
- Tencent HY-Video token price was not found.

---

## 3. API shape: async create → poll → download; callbacks; result-URL expiry; auth style

### Takeaway
Every provider uses the same pattern Sora2App already implements: an async create call returns a task ID, the client polls status, and the result is fetched from a time-limited URL. **None return the MP4 inline.** Result-URL lifetimes range from **about 9 hours (MiniMax, older doc) to 24 hours (Seedance, Wan) to about 30 days (Kling)**, so the app must download promptly, which matches the existing auto-download behaviour.

All the leading providers now authenticate with **a single static API key in a header**:
- Ark: Bearer
- DashScope: Bearer
- Kling: Bearer API Key since 2026-06-17
- MiniMax: Bearer
- Vidu: `Token`
- PixVerse: `API-KEY`

That is trivially compatible with a zero-dependency Node `fetch` client. Only legacy Tencent Cloud APIs need TC3-HMAC-SHA256 request signing, and legacy Kling AK/SK keys need a JWT; both are doable with `node:crypto`. Callbacks need a public HTTPS endpoint, so they are useless for a 127.0.0.1 app. **Polling is the only practical path.**

### Cited Findings

**Seedance (Ark)**
- Create with `POST /api/v3/contents/generations/tasks`; query with `GET` on the same path plus the task ID. [Volcengine create-task doc](https://docs.volcengine.com/docs/ark/create-video-generation-task-api)
- Optional `callback_url`: Ark POSTs on every status change, and the body matches the query response. Statuses are `queued`, `running`, `succeeded`, `failed` and `expired`. [Volcengine create-task doc](https://www.volcengine.com/docs/82379/1520757)
- `execution_expires_after` defaults to 172,800 s (48 h), with a range of 3,600–259,200 s. [Volcengine create-task doc](https://docs.volcengine.com/docs/ark/create-video-generation-task-api)
- The result video URL is valid for **24 h**, task records are kept for 7 days, and there is reportedly a 100-download cap on the URL `[UNVERIFIED, secondary]`. [Melius](https://www.melius.com/blog/where-to-run-seedance-2-5); [LaoZhang docs](https://docs.laozhang.ai/en/api-capabilities/seedance2-video-generation)
- `watermark` is a boolean: `true` adds an "AI生成" mark in the lower right, and the default is `false`. [Volcengine create-task doc](https://docs.volcengine.com/docs/ark/create-video-generation-task-api)
- Non-inference rate limits: query-task at 20 QPS per account, list-tasks at 1 QPS. [Volcengine Seedance 2.5 tutorial](https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh)
- Seedance 2.5 uses the same endpoint, auth and request structure as 2.0. [API易](https://docs.apiyi.com/live/2026-08/seedance-2-5-launch)
- Auth is an Ark API key as a Bearer token. This is from my prior knowledge of Ark docs plus [API7 gateway docs](https://docs.api7.ai/ai-gateway/providers/volcengine-ark) `[verify]`.
- Hosts: Volcengine's domestic host is the cn-beijing ARK host. BytePlus uses a separate international host and account.

**Alibaba Model Studio / DashScope (Wan, HappyHorse, resold Kling/Vidu/PixVerse/MiniMax)**
- Create by POSTing to the video-synthesis endpoint with the header `X-DashScope-Async: enable`; HTTP supports async only. Poll with `GET /api/v1/tasks/{task_id}` until `SUCCEEDED` or `FAILED`, then read `output.video_url`. [Alibaba Cloud I2V guide](https://www.alibabacloud.com/help/en/model-studio/image-to-video-guide); [Alibaba Cloud T2V reference](https://www.alibabacloud.com/help/en/model-studio/legacy-wan-text-to-video-api-reference)
- `video_url` is valid for **24 h**. After that the task status returns `UNKNOWN`. Async-task callbacks can be configured instead of polling. [Alibaba Cloud T2V guide](https://www.alibabacloud.com/help/en/model-studio/text-to-video-guide)
- `watermark` is a boolean inside `parameters`. **For wan3.0 the default is false.** [阿里云 Wan3.0 API 参考](https://help.aliyun.com/en/model-studio/wan3-video-generation-api-reference)
- Each region (Beijing vs Singapore) has its own endpoint, API key and model list; they cannot be mixed. [阿里云 错误码](https://help.aliyun.com/zh/model-studio/error-code); [阿里云 地域](https://help.aliyun.com/zh/model-studio/regions)
- Wan 2.7 replaced `size` with `resolution` plus aspect ratio and dropped `shot_type`, so parameter shapes change between versions. [Alibaba Cloud Wan2.7 T2V](https://www.alibabacloud.com/help/en/model-studio/text-to-video-api-reference)
- Resold models on Model Studio, e.g. Kling: the task ID is valid for 24 h (`UNKNOWN` afterwards), and the Kling video link is valid for 30 days. [阿里云 Kling API](https://help.aliyun.com/en/model-studio/kling-video-generation-api-reference/)

**Kling (official)**
- From 2026-06-17, **new APIs only support API Key authentication**, and users should switch. The key goes in `Authorization: Bearer <key>`. [Kling API 更新公告](https://www.klingai.com/document-api/updates/api); [Kling 快速入门](https://www.klingai.com/document-api/quickStart/userManual)
- Legacy auth: an Access Key plus Secret Key signs an HS256 JWT (`iss` = AK, about 30-minute expiry, `nbf` 5 s in the past), sent as Bearer. The global base URL is `https://api.klingai.com/v1`. [aself101/kling-api](https://github.com/aself101/kling-api); [Tessl klingai-install-auth](https://tessl.io/registry/skills/github/jeremylongshore/claude-code-plugins-plus-skills/klingai-install-auth)
- Optional `callback_url` notifies on status change. A third-party doc says callbacks are unsigned and retried up to 3 times, then for up to 30 minutes `[UNVERIFIED]`. `external_task_id` must be unique per account. [Kling Text-to-Video ref](https://kling.ai/document-api/apiReference/model/textToVideo)
- The newer API version supports batch query by task IDs with cursor pagination; the legacy API remains available. [Kling API Updates](https://kling.ai/document-api/updates/api)
- The domestic console (klingai.com/dev) shares its account with the Kling web app (phone or Kuaishou QR login). The global console is at app.klingai.com/global/dev. [Kling 快速入门](https://www.klingai.com/document-api/quickStart/userManual)

**MiniMax**
- The flow has three steps: [MiniMax query doc](https://platform.minimax.io/docs/api-reference/video-generation-query); [MiniMax retrieve file](https://platform.minimax.io/docs/api-reference/file-management-retrieve)
  1. `POST /v1/video_generation` returns a `task_id`.
  2. `GET /v1/query/video_generation?task_id=…` returns `Preparing`, `Queueing`, `Processing`, `Success` or `Fail`, plus a `file_id` on success.
  3. `GET /v1/files/retrieve?file_id=…` returns a `download_url`.
- Auth is a Bearer API key. Hosts: `api.minimaxi.com` (domestic) and `api.minimax.io` (international). [Mini-Agent README_CN](https://github.com/MiniMax-AI/Mini-Agent/blob/main/README_CN.md)
- `[CONFLICT]` Download URL validity: the original Video-01 announcement said **9 h** `[>3mo]`, while a third-party H3-Max doc says about 24 h. [MiniMax news](https://www.minimax.io/news/video-generation-api); [APIMart](https://docs.apimart.ai/cn/api-reference/videos/minimax-h3/max)
- `aigc_watermark` is a boolean with default `false`. [MiniMax create task](https://platform.minimax.io/docs/api-reference/video-generation-v2-create)

**Vidu**
- The auth header is `Authorization: Token {api_key}`, not Bearer. Endpoints follow the pattern `https://api.vidu.com/ent/v2/<img2video|text2video|reference2video|…>`. [Vidu Reference to Video](https://platform.vidu.com/docs/reference-to-video); [Vidu 图生视频](https://platform.vidu.cn/docs/image-to-video)
- `callback_url` is optional. Callback statuses are `processing`, `success` and `failed`; success and failed callbacks are retried 3 times. The body matches the Get Generation response. Callbacks are signed, per a separate "Callback Signature" page. [Vidu Reference to Video](https://platform.vidu.com/docs/reference-to-video)
- An `off_peak` boolean is also available (see section 4).

**PixVerse**
- Headers are `API-KEY` and an `Ai-trace-id` that must be unique per request; reusing one doesn't produce a new video. [PixVerse T2V](https://docs.platform.pixverse.ai/text-to-video-generation-13016634e0); [PixVerse status](https://docs.platform.pixverse.ai/get-video-generation-status-13016632e0)
- Endpoints: `POST /openapi/v2/video/text/generate` or `/img/generate`, then `GET /openapi/v2/video/result/{video_id}`; `status = 1` means done.
- Hosts: `app-api.pixverse.ai` (international) and `app-api.pixverseai.cn` (domestic 拍我AI). [拍我AI 开放平台](https://docs.platform.pai.video/6740005m0)

**Tencent**
- Legacy Tencent Cloud APIs require TC3-HMAC-SHA256 signing for JSON POST, using `X-TC-Action`, `X-TC-Version`, `X-TC-Timestamp` and `X-TC-Region` headers. [混元生图 API PDF](https://main.qcloudimg.com/raw/document/product/pdf/1668_88046_cn.pdf)
- TokenHub is OpenAI-protocol compatible. Video uses submit/query endpoints, e.g. `/v1/api/video/submit` and `/v1/api/video/query` (the example given is for YT-Video-2.0). [TokenHub YT 调用指南](https://cloud.tencent.com/document/product/1823/135716); [TokenHub 产品页](https://cloud.tencent.com/product/tokenhub)

**Zhipu / Baidu**
- Zhipu uses model codes such as `cogvideox-3` via the zai SDK. [智谱 CogVideoX-3](https://docs.bigmodel.cn/cn/guide/models/video-generation/cogvideox-3)
- Baidu Qianfan has a "创建视频生成任务" async task API. [千帆 API](https://cloud.baidu.com/doc/qianfan-api/s/Xme6ul5g4)

### Inferences
- **Zero-dependency Node fit, ranked:**
  1. Ark, DashScope, Kling (new key), MiniMax, Vidu, PixVerse and Zhipu all need only a static header. Each is a couple of `fetch` calls plus polling.
  2. Legacy Kling JWT needs about 20 lines of `node:crypto` HMAC.
  3. Tencent TC3 signing needs about 60 lines and is the least attractive. Tencent is not a priority provider anyway, since Hunyuan is being folded into TokenHub.
- The most important abstraction for Sora2App is a **provider adapter interface** with these operations:
  - `create(prompt, imageRef?, params)` → id
  - `poll(id)` → {status, url?}
  - `download(url)`
  
  Plus a per-provider status-name mapping, for example:
  - Ark: `succeeded`
  - DashScope: `SUCCEEDED`
  - MiniMax: `Success`
  - PixVerse: `1`
  
  MiniMax needs an extra file-retrieve hop.
- Image input for first-frame I2V: most APIs accept a public URL or base64. The current Sora2App upload flow (a local file) will need base64 encoding or a provider upload/asset step; details are per-provider (gap).
- Expiry plus app downtime is a risk. If the local app is closed for more than 24 h while Ark or DashScope tasks are pending or finished, results are lost (DashScope returns `UNKNOWN`; Ark URLs expire). The app should persist task IDs locally (not the key) and resume polling on restart.

### Gaps
- The exact domestic base URLs for Kling (domestic vs global API host) and Vidu (api.vidu.cn vs api.vidu.com) were not confirmed.
- Whether Kling's global console has also moved to single-API-key auth (the 2026-06-17 notice comes from the domestic doc site) is unconfirmed. A GitHub PR suggests it has. [griptape PR #28](https://github.com/griptape-ai/griptape-nodes-library-kling/pull/28)
- MiniMax H3's current download-URL TTL and image-input formats (URL vs base64) for each provider were not verified.
- The Volcengine docs pages could not be opened to confirm the auth header text directly.

---

## 4. Batch / offline inference, discounts, concurrency and RPM limits

### Takeaway
**No Chinese provider offers an OpenAI-style file-based Batch API with a discount for its current flagship video models.**
- Ark's offline "flex" tier, at about 50% of the online price, explicitly excludes Seedance 2.0 and 2.5; it only covers Seedance 1.0 Pro.
- DashScope's 50% Batch covers text and VL-understanding models only, not Wan.
- **The only real "batch-style" discount for a current model is Vidu's `off_peak` mode**: about 50% off, completed within 48 h, otherwise cancelled and refunded.
- Zhipu offers a half-price Batch only for the old CogVideoX-2.

Concurrency is the binding constraint for a 50,000-request batch tool. Seedance gives individual accounts only **3 concurrent tasks** (enterprise 10). Wan 3.0 is reportedly 2 concurrent, MiniMax H3 allows 30 in-flight tasks, and Kling allows 5 (trial) to 20 (standard pack). So Sora2App's batch mode has to become **a client-side throttled queue**, not a server-side batch submission.

### Cited Findings
- **Ark `service_tier`:** `default` is online inference. `flex` is offline, with a higher TPD quota and a price about half of online, but **Seedance 2.5 and the 2.0 series do not support flex**. [Volcengine Seedance 2.5 tutorial](https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh); [Volcengine create-task doc](https://docs.volcengine.com/docs/ark/create-video-generation-task-api)
- A third-party cost sheet confirms this: Seedance 1.0 Pro offline is ¥7.50/M tokens vs ¥15.00/M online, and 2.0 / 2.0-fast offline is "暂不支持" (not supported). [ArcReel 火山方舟费用参考](https://github.com/ArcReel/ArcReel/blob/main/docs/ark-docs/%E7%81%AB%E5%B1%B1%E6%96%B9%E8%88%9F%E8%B4%B9%E7%94%A8%E5%8F%82%E8%80%83.md)
- **DashScope Batch:** priced at 50% of real-time, supports only OpenAI-compatible calls, and covers text models plus image/video *understanding* models. **No Wan generation models appear.** [阿里云 批量推理](https://help.aliyun.com/zh/model-studio/batch-inference); [阿里云 OpenAI 兼容 Batch](https://help.aliyun.com/zh/model-studio/openai-compatible-batch-chat)
- **Vidu `off_peak`:** [Vidu Reference to Video](https://platform.vidu.com/docs/reference-to-video); [Vidu 产品定价](https://platform.vidu.cn/docs/pricing)
  - Defaults to `false`; `true` means 错峰 (off-peak) generation.
  - Off-peak tasks must finish within 48 h, or they are cancelled and the credits refunded. Off-peak tasks can be cancelled.
  - Q3 supports off-peak only with `audio=true`; Q2, Q1 and 2.0 support it only with `audio=false`.
  - Off-peak credits are roughly half (e.g. Q3 pro 1080p is 24 standard vs 12 off-peak).
- **Zhipu:** CogVideoX-2 has Batch API pricing of ¥0.25 per call (vs ¥0.5); CogVideoX-3 has no Batch. [智谱 API 定价](https://docs.bigmodel.cn/cn/guide/start/pricing)
- **Seedance rate limits (per main account, shared per model; 429 when exceeded; tasks over the concurrency limit queue):** [Volcengine Seedance 2.5 tutorial](https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh); [Volcengine 模型列表](https://docs.volcengine.com/docs/82379/1587798)
  - Seedance 2.5: enterprise RPM 600 / concurrency 10; individual RPM 180 / concurrency 3.
  - Seedance 2.0 non-4K: enterprise concurrency 10, individual 3.
  - Seedance 2.0 4K: RPM 15 and concurrency 1 for everyone.
  - 1.0 / 1.5 Pro: RPM 600, concurrency 10.
- The Ark Experience Center console is limited to concurrency 1 during the trial. [Volcengine Seedance tutorial](https://docs.volcengine.com/docs/ark/video-generation-tutorial?lang=zh)
- **Wan 3.0:** the official RPM is 300. Third-party reports put concurrency at 2 with a queue of 50 `[UNVERIFIED]`. [阿里云 限流](https://help.aliyun.com/zh/model-studio/rate-limit); [DEV: Wan 3.0 defaults](https://dev.to/whereisthisplace/seven-defaults-in-the-wan-30-video-api-that-decide-your-bill-before-you-write-a-prompt-183j); [Atlas Wan 3.0 preview](https://www.atlascloud.ai/blog/tips/wan-3.0-preview)
- **MiniMax:** Video Generation V2 for MiniMax-H3 has RPM 300 and 30 max in-flight tasks; the Hailuo series has RPM 20. Rate-limit errors return HTTP 429 with `rate_limit_error` code 1002. [MiniMax Rate Limits](https://platform.minimax.io/docs/guides/rate-limits)
- **Kling:**
  - Trial packs allow 5 concurrent tasks; standard packs allow 20 (the flagship section shows 9). [Kling API pricing (EN)](https://kling.ai/dev/model/image); [Kling3.pro](https://kling3.pro/blog/kling-ai-api-guide)
  - Stacking packs does not raise concurrency; contact business for more. [可灵 API 使用手册 (轻雀)](https://docs.qingque.cn/d/home/eZQCR1cjLJ5SqrV-AfCve0rYn?identityId=1oEER8VjdS8)
  - Two keys under one account share the pack and concurrency limits.
- **Baidu MuseSteamer 2.0:** default shared concurrency 3, queue 10. [千帆 视频生成](https://cloud.baidu.com/doc/qianfan-docs/s/rmejr4y27)
- **Tencent legacy:** concurrency is sold as a monthly product (e.g. ¥16,500 per concurrency per month for video stylization) and must be switched on in the console `[>3mo]`. [腾讯云 计费概述](https://cloud.tencent.com/document/product/1616/118994)
- **Bulk-prepay discounts:**
  - Kling large packs: about $0.126/unit vs $0.14, roughly 10% off. [CostBench](https://costbench.com/software/ai-media-apis/kling-api/)
  - Seedance 2.0 resource packs: ¥28/M vs the ¥46 no-video-input list. [Volcengine 资源包](https://docs.volcengine.com/docs/ark/seedance-2-0-model-resource-pack-rules?lang=zh)
  - MiniMax video packs: Hailuo only. [MiniMax 视频资源包](https://platform.minimaxi.com/docs/guides/pricing-video)

### Inferences
- **What "batch" should mean in the redesign:** the existing "split prompts by blank line" UX can stay, but execution has to change. Instead of uploading a JSONL to a batch endpoint, the app runs a local queue that keeps N tasks in flight (N set per provider and account type: e.g. 3 for an individual Seedance account, 2 for Wan, up to 30 for MiniMax). It retries on 429 with backoff, persists task IDs, and downloads as tasks finish.
- For Vidu, a "submit everything with `off_peak: true` and collect within 48 h" mode is the closest analogue to OpenAI Batch semantics and pricing, and is worth exposing as a toggle.
- **Throughput estimate:** with 3 concurrent tasks and roughly 1–5 minutes per clip (Alibaba documents 1–5 min generation for PixVerse via Model Studio; [阿里云 PixVerse](https://help.aliyun.com/en/model-studio/pixverse-image-to-video-api-reference)), an individual Seedance account manages about 36–180 clips per hour. 50,000 prompts would take days to weeks. The 50,000 limit inherited from OpenAI Batch is unrealistic for individual Chinese accounts; enterprise accounts or multiple providers in parallel would be needed.

### Gaps
- Per-account concurrency limits for Vidu, PixVerse and Kling's domestic packs were not found.
- Whether Ark will add flex support for Seedance 2.x is unknown.
- I found no statement that any provider offers a JSONL or file-upload batch endpoint for video generation. Absence was not exhaustively verified for MiniMax, Vidu or Kling.

---

## 5. Account requirements and cross-border accessibility (real-name, individual vs enterprise, payment)

### Takeaway
Every vendor runs **separate domestic and international platforms with non-interchangeable accounts and API keys** (Volcengine vs BytePlus, Aliyun vs Alibaba Cloud International, minimaxi.com vs minimax.io, vidu.cn vs vidu.com, pixverseai.cn vs pixverse.ai, Kling CN vs global).
- **Domestic platforms** require Chinese real-name verification (实名认证), usually a mainland phone, and Alipay/WeChat or bank top-up. Some features and higher limits are gated to enterprise verification.
- **International platforms** bill in USD by card. They are generally usable from Japan, Korea and the West, but **BytePlus Seedance excludes the US** (and reportedly Canada, the UK, Australia and New Zealand).
- Mainland individuals are steered to the domestic platforms, and some mainland entities cannot self-register on BytePlus.

For Sora2App this means the UI must let users choose **provider plus region (CN vs Intl)** and store the matching base URL; a key from one region silently fails on the other.

### Cited Findings
- **Volcengine (domestic):**
  - Real-name verification is personal or enterprise, and the two allow different operations. [Volcengine 实名认证](https://docs.volcengine.com/docs/4640/127683)
  - Overseas and HK/Macau/Taiwan individuals can upload a passport or travel permit for manual review (1–8 h). This comes from an article about two years old `[>3mo]`. [Volcengine 开发者社区](https://developer.volcengine.com/articles/7374833023805554725)
  - One person can verify up to 10 accounts, and one enterprise up to 100. [Volcengine 实名认证](https://docs.volcengine.com/docs/4640/127683)
- **Seedance activation on Ark** requires any one of the following. [Volcengine 开通管理](https://www.volcengine.com/docs/82379/1159200)
  - an account balance above ¥200
  - a savings plan of ¥200 or more
  - an active Seedance 2.x resource pack
- Real-person portrait features require personal or enterprise verification. Individual accounts get much lower limits (concurrency 3 vs 10; see section 4). [Volcengine Seedance 2.5 tutorial](https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh)
- Enterprise verification works by legal-representative face scan, bank micro-deposit or business licence. `[CONFLICT]` Third-party articles disagree on whether it is free or charged (3–5 business days). [Volcengine 企业认证](https://www.volcengine.com/article/42685); [Volcengine article](https://www.volcengine.com/article/42664)
- **BytePlus (international):**
  - Accounts are individual or business, and **the type cannot be changed after registration**. Individuals get a limited product subset; most cloud services need a business account with KYC. [BytePlus FAQ: individual vs business](https://ai.byteplus.com/en/help/article/what-is-the-difference-between-individual-and-business-accounts-and-can-i-change-the-type-after-registration); [BytePlus KYC FAQ](https://ai.byteplus.com/en/help/article/what-identity-verification-real-name-kyc-is-required-and-what-documents-do-i-need)
  - "Certain mainland entities cannot self-register for overseas services." [BytePlus region FAQ](https://ai.byteplus.com/en/help/article/why-am-i-told-my-region-or-entity-is-not-supported-for-self-service-registration-or-verification)
- **BytePlus Seedance availability:**
  - Seedance 2.0 went to enterprise customers in 100+ countries, **excluding the US** `[>3mo]`. [The Information](https://www.theinformation.com/briefings/bytedance-launches-seedance-2-0-globally-excluding-u-s); [The Decoder](https://the-decoder.com/bytedance-rolls-out-seedance-2-0-to-100-countries-but-keeps-the-us-off-the-list/)
  - A later pricing article says the official BytePlus route is not sold in the US, Canada, the UK, Australia or New Zealand. [CellCog](https://cellcog.ai/blog/seedance-2-5-pricing/)
  - Japan and South Korea appear on BytePlus's model-service country list. [BytePlus availability](https://docs.byteplus.com/en/docs/ModelArk/availability)
  - In March 2026 there were reports that ByteDance halted the Seedance 2.0 global rollout `[>3mo, UNVERIFIED]`. [AlternativeTo](https://alternativeto.net/news/2026/3/bytedance-reportedly-halts-global-rollout-of-seedance-2-0-ai-video-generator)
  - BytePlus's Seedance guide describes ModelArk as for developers *outside* mainland China. [TechJack](https://techjacksolutions.com/ai-tools/bytedance-seed/how-to-use-seed-api/)
- **Alibaba:**
  - The China site and International site have separate accounts, billing and compliance. International registration uses email plus a **non-mainland phone number**; real-name verification there is needed only for mainland resources or credit. [阿里云 中国站 vs 国际站](https://help.aliyun.com/zh/account/aliyun-vs-alibaba-cloud)
  - China-site users should use the Beijing endpoint and International-site users the Singapore endpoint. [阿里云 错误码](https://help.aliyun.com/zh/model-studio/error-code)
  - Singapore runs only the "International" deployment scope, with inference outside mainland China. [Singapore region access](https://help.aliyun.com/en/model-studio/singapore-regional-access-information)
  - Third-party reports say mainland users can register on the International site but usually need an overseas card or PayPal `[>3mo]`. [知乎](https://zhuanlan.zhihu.com/p/1943307501626984284)
- **MiniMax:**
  - Domestic (platform.minimaxi.com / api.minimaxi.com) and international (platform.minimax.io / api.minimax.io) are separate account systems, and keys are not interchangeable (401 or "invalid api key"). Domestic uses a Chinese phone number; international uses email or a foreign phone. [Mini-Agent README_CN](https://github.com/MiniMax-AI/Mini-Agent/blob/main/README_CN.md); [CSDN 避坑](https://blog.csdn.net/otherjason/article/details/157509739)
  - International funding is by online payment or bank transfer, in USD, with optional auto top-up. [MiniMax About Account](https://platform.minimax.io/docs/faq/about-account)
- **Kling:**
  - The domestic console account equals the Kling web account (phone or Kuaishou QR). [Kling 快速入门](https://www.klingai.com/document-api/quickStart/userManual)
  - The API terms say recharge is through "payment channels designated by the Platform" and do not name card or PayPal. [Kling Terms of API Paid Service](https://kling.ai/document-api/guides/protocols/paid-service)
- **Vidu:** the international site uses Stripe (Visa, MasterCard, UnionPay). The statement is on the consumer page and may not cover the API. [Vidu terms](https://platform.vidu.com/docs/terms-of-use); [Vidu pricing](https://www.vidu.com/pricing)
- **PixVerse:** separate international (pixverse.ai) and domestic 拍我AI (pixverseai.cn) platforms and hosts. [拍我AI 开放平台](https://docs.platform.pai.video/6740005m0)

### Inferences
- **Mainland-China users:** the domestic routes all work with personal real-name verification and Alipay/WeChat: Volcengine Ark, 百炼 Beijing, minimaxi.com, Kling CN, vidu.cn and 拍我AI. Seedance additionally needs ¥200 prepaid. Individual accounts get low concurrency.
- **Japanese and Korean users:** the international routes all appear available: BytePlus, Model Studio Singapore, minimax.io, Kling global, vidu.com and pixverse.ai.
- **US users:** cannot use BytePlus Seedance. Kling global, MiniMax intl, Model Studio Intl, Vidu intl and PixVerse remain options (no US exclusion found for those).
- **App implication:** treat (provider, region) as one choice and key the base URL, model list and price table on it. Show a clear error when a CN key is used on an Intl host, since there is a known 401 pattern.

### Gaps
- No official statement was found on whether non-Chinese individuals can currently complete Volcengine personal verification with a passport; the evidence is about two years old.
- Exact payment methods for the Kling global API and BytePlus top-up were not found.
- No current confirmation was found that mainland individuals can sign up for minimax.io or vidu.com.
- Whether Kling global excludes any countries is unknown.

---

## 6. Compliance: China AI-content labeling rules, provider watermarks, content moderation

### Takeaway
China's 《人工智能生成合成内容标识办法》 (in force since 2025-09-01) requires generated video to carry an **explicit label** (visible at the start and around playback) and an **implicit label** (file metadata naming the provider and a content ID). A provider *may* deliver files without the explicit label only if the user agreement assigns labeling duties to the user and the provider keeps logs for at least 6 months. **The major APIs (Seedance, Wan 3.0, MiniMax) default to no visible watermark** (`watermark`/`aigc_watermark` = false), so in practice the labeling obligation passes to the downstream publisher.

Moderation is strict on **real human faces**. Seedance 2.x rejects uploads containing realistic real faces unless the person completes in-console face verification and authorization. False positives on AI-generated faces are reported.

### Cited Findings
- The Measures took effect on 2025-09-01 `[>3mo, still in force]`. [CAC 通知](https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm)
  - Video must carry prominent labels at the start and around playback, optionally also at the end or middle.
  - When download or export is offered, the file itself must contain the explicit label.
  - Implicit labels go in metadata: attribute info, provider name or code, and content ID.
  - Malicious removal, tampering or forging of labels is prohibited, as is providing tools to do so.
  - Platforms must check the metadata.
- **Exception:** if a user requests content without the explicit label, the provider may supply it after stating the user's labeling duties in the user agreement, and must keep logs of recipients for at least 6 months. [CAC 通知](https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm); [知乎 解读](https://zhuanlan.zhihu.com/p/2040728941200200315)
- Digital watermarking inside media is **not mandatory** per the official Q&A, citing cost and technical difficulty. [CAC 答记者问](https://www.cac.gov.cn/2025-03/14/c_1743654685896173.htm)
- Industry examples, analysis and a CAC expert commentary from September 2025: [小米 标识材料要求](https://dev.mi.com/xiaomihyperos/documentation/detail?pId=2110); [PwC 合规解码](https://www.pwccn.com/zh/tmt/method-identifying-synthetic-content-generated-ai-sep2025.pdf); [CAC 专家解读 2025-09](https://www.cac.gov.cn/2025-09/05/c_1758792061408012.htm)
- **Provider defaults:**
  - Seedance: `watermark` default false; true adds an "AI生成" mark at the lower right. [Volcengine create-task](https://docs.volcengine.com/docs/ark/create-video-generation-task-api)
  - Wan 3.0: `watermark` default false. [阿里云 Wan3.0 API](https://help.aliyun.com/en/model-studio/wan3-video-generation-api-reference)
  - MiniMax: `aigc_watermark` default false. [MiniMax create task](https://platform.minimax.io/docs/api-reference/video-generation-v2-create)
  - Several Model Studio examples set `watermark: true`. [Alibaba Cloud I2V guide](https://www.alibabacloud.com/help/en/model-studio/wan-image-to-video-guide)
- **Seedance real-face policy:**
  - During the February 2026 beta, real-person image and video references were paused `[>3mo]`. [新京报](https://www.bjnews.com.cn/detail/1770694532129745.html); [财联社](https://www.cls.cn/detail/2285598)
  - The current Ark doc says Seedance 2.5 and 2.0 do not accept direct uploads of real-face images or video. Allowed alternatives: [Volcengine create-task](https://www.volcengine.com/docs/82379/1520757)
    - the account's own face-containing outputs from the last 30 days
    - preset virtual avatars (more than 10,000)
    - authorized real persons, after face verification and portrait authorization in the Ark console ([腾讯新闻](https://news.qq.com/rain/a/20260416A065I400))
  - Realistic faces passed directly are blocked; the documented route is to register an asset and reference it as `asset://`. [API易 FAQ](https://docs.apiyi.com/faq/seedance2-asset-face-reference)
  - AI-generated faces are sometimes misjudged as real. [Sohu](https://www.sohu.com/a/985891896_122613810)
  - Jimeng says public figures are pre-blocked by keyword and image matching, with post-generation review. [Sohu](https://www.sohu.com/a/985891896_122613810)
- Kling: tasks that fail moderation are not charged (third-party citing official billing). [aiapiprice](https://aiapiprice.com/keling-api-jiage/)

### Inferences
- For a local BYOK tool, Sora2App is arguably not the "service provider" under the Measures. But end users publishing in China must label content. The app could offer an opt-in "add 人工智能生成合成 label" overlay or turn on the provider `watermark` flag. It should also not strip provider metadata: no re-encoding that drops metadata and no "remove watermark" feature.
- Prompt batches that involve real people's likeness (common in Sora 2 cameo-style use) will fail on Seedance and probably be limited elsewhere. The app should surface per-task moderation failures clearly instead of failing the whole batch.

### Gaps
- Whether each provider writes the implicit metadata label (and in what format) into API-delivered MP4s was not verified for any provider.
- Political or sensitive-topic moderation strictness was not documented in the sources found. No comparative data was found for Kling, MiniMax, Wan or Vidu on real-face policies in 2026.
- Whether the international platforms (BytePlus, minimax.io, Singapore) apply the same Chinese labeling and moderation rules is not documented.

---

## 7. Market standing: quality rankings, adoption, pricing trends, stability

### Takeaway
Chinese models now hold most top positions on public video leaderboards. As of September and October 2026:
- **Artificial Analysis text-to-video:** Wan 3.0 is #1 (1156), Seedance 2.5 #3 and MiniMax H3 #4.
- **Artificial Analysis image-to-video:** Wan 3.0 is #6. Kling 3.0 and Vidu Q3 sit mid-table (about #18–24).
- **SuperCLUE's Chinese T2V arena (2026-09-18):** Seedance 2.5 and 2.0 are on top, then Kling 3.0, with Wan 2.7 at #5.
- **Arena.ai (2026-09-21):** led by Google's Gemini Omni Flash for T2V, with Wan 3.0 #3 for I2V.

The leaders change monthly (SkyReels V4 in March, HappyHorse in April, Seedance 2.0 mid-year, Wan 3.0 now), and Kling 4.0 lands in October. Prices are in a visible price war. Model churn and deprecations are fast (Kling early models retired 2026-09-15, Seedance 1.5 Pro retiring, Hunyuan folded into TokenHub, Hailuo 2.3 "legacy").

### Cited Findings
- **Artificial Analysis T2V (AA-Video-T2V v2.0)** snapshot. The date is not shown, but the board includes a September 2026 model. [AA T2V leaderboard](https://artificialanalysis.ai/video/leaderboard/text-to-video)
  - #1 Alibaba Wan 3.0: 1156
  - #2 Utopai X: 1149
  - #3 Dreamina Seedance 2.5: 1143
  - #4 MiniMax H3 (768p): 1137
  - #8 Google Gemini Omni Flash 1.1: 1113
  - The top two overlap within their 95% confidence intervals.
- **Artificial Analysis I2V (AA-Video-I2V v1.0)** partial capture; the top 5 were not captured. [AA I2V leaderboard](https://artificialanalysis.ai/video/leaderboard/image-to-video)
  - Wan 3.0: #6, 1164, listed at $12/min
  - Wan 2.7: 1077
  - Vidu Q3 Pro: #18, 1056
  - Kling 3.0 1080p Pro: #19, 1055
  - Kling 3.0 720p: #20, 1051
  - Kling 3.0 Omni 1080p: 1044
  - Vidu Q3 Turbo: #25, 1029
  - Seedance 1.5 Pro: #27, fixed at 1000 as the reference point
  - Wan 2.6: #34, 889
- **Arena.ai (formerly LMArena; rebranded 2026-01-28), 2026-09-21 snapshot:** [Arena T2V](https://arena.ai/leaderboard/text-to-video); [Arena I2V](https://arena.ai/leaderboard/image-to-video)
  - T2V covers 48 models and 718,577 votes: #1 gemini-omni-1.1-flash (1516), #2 gemini-omni-flash (1513).
  - I2V: Wan 3.0 #3 (1480), Vidu Q3 Pro #18 (1363), kling-v3-pro #19 (1354).
- **SuperCLUE 文生视频竞技场 (2026-09-18):** [SuperCLUE video arena](https://superclueai.com/arena?tab=board&type=video)
  - #1 Seedance 2.5 (720p): 1297.3, but only 311 battles (CI about ±90)
  - #2 Seedance 2.0: 1261.6 (5,650 battles)
  - #3 Kling 3.0: 1193.4 (5,384 battles)
  - #5 Wan 2.7: 1154.2
  - #7 HappyHorse-1.0: 1114.1
- An August 2026 roundup of the AA T2V-with-audio board had Gemini Omni Flash at 1245, MiniMax-H3 at 1242 and Seedance 2.0 at 1225 `[CONFLICT with the AA snapshot above; different board version or date]`. [invideo](https://invideo.io/blog/best-ai-video-model/)
- Earlier leaders, for context:
  - SkyReels V4 was #1 on AA in March 2026 `[>3mo]`. [云南网](https://m.yunnan.cn/system/2026/03/19/033922015.shtml)
  - HappyHorse 1.0 rose to #2 in April `[>3mo]`. [VentureBeat](https://venturebeat.com/technology/alibabas-ai-video-model-rises-to-no-2-in-global-rankings-as-openais-sora-and-bytedances-seedance-fall-away)
  - SuperCLUE-I2V (April 2025) had Kling 2.0 #1, Vidu Q1 #2 and PixVerse V4 #3 `[>3mo, obsolete]`. [SuperCLUE I2V](https://mp.weixin.qq.com/s/LJTmNlFQ4pUlUMBRs3J1SA)
- **Qualitative user tests:**
  - Seedance 2.0 has the most natural motion and is fastest; Wan 2.7 has the finest image quality but is slowest; HappyHorse offers good value (single tester). [SegmentFault](https://segmentfault.com/a/1190000047918278)
  - Film professionals use Kling 3.0 because Seedance blocks real faces. [woshipm](https://www.woshipm.com/share/6359412.html)
- **Pricing trend evidence:**
  - "1秒1元" headline for Seedance 2.0 pricing. [智源社区](https://hub.baai.ac.cn/view/52906)
  - MiniMax H3 price war, with H3 "卷到几分钱" (down to a few fen) on some channels (August 2026). [量子位](https://www.qbitai.com/2026/08/467036.html)
  - Wan 3.0 promoted as "价格只要一半" (half the price). [Bilibili](https://www.bilibili.com/video/BV1e9uJ6gERB/)
  - Repeated limited-time discounts: Seedance fast at 75% and mini at 40% until 10-07; Wan 3.0 at 70% until about 09-23/24; Seedance 2.5 1080p at 72% until 09-17. [Volcengine](https://www.volcengine.com/article/2686777); [千问AI平台](https://www.qianwenai.com/models/wan3.0-video)
  - A consumer-tool survey (April 2026) found per-second prices from ¥0.18 to ¥1.38 `[>3mo]`. [腾讯新闻](https://view.inews.qq.com/a/20260425A04E8B00)
- **Stability and churn:**
  - Kling retired early models, templates and try-on from 2026-09-15. [Kling 更新公告](https://www.klingai.com/document-api/updates/api)
  - Seedance 1.5 Pro is marked "即将下线". [Volcengine](https://docs.volcengine.com/docs/ark/video-generation-tutorial?lang=zh)
  - The Hunyuan legacy platform stops new purchases. [腾讯云](https://cloud.tencent.com/document/product/1616/118994)
  - Hailuo 2.3 rates are labelled legacy. [Magic Hour](https://magichour.ai/blog/hailuo-23-pricing)
  - Model IDs carry date suffixes (e.g. `-260128`, `-260628`). [Volcengine](https://docs.volcengine.com/docs/ark/create-video-generation-task-api)
  - Wan 3.0 is labelled "preview", with access by application. [阿里云 Wan3.0 API (EN)](https://help.aliyun.com/en/model-studio/wan3-video-generation-api-reference)

### Inferences
- **Shortlist for Sora2App's new backend**, prioritized for a BYOK local batch tool:
  1. **Alibaba Wan 3.0 via Model Studio.** It is the top or near-top ranked Chinese model, has a simple Bearer key with an async header, clean CN (Beijing) and Intl (Singapore) regions, mid-range price (¥0.6 / $0.10 per second at 720p), and a 30 s maximum. The same key also reaches HappyHorse, Kling, Vidu, PixVerse and MiniMax H3 resold on Model Studio, which makes it the best "one adapter, many models" choice. Weaknesses: preview status, access by application, and low reported concurrency.
  2. **ByteDance Seedance 2.x via Ark / BytePlus.** It has the highest Chinese user-preference scores (SuperCLUE) and is top-3 on AA, with a simple Bearer key and rich references. It is the most expensive. Individual concurrency is 3, there is no discounted offline tier for 2.x, BytePlus excludes the US, and real-face inputs are blocked.
  3. **MiniMax H3.** It is cheap (¥0.33–0.50 / $0.05–0.08 per second), has generous in-flight limits (30), native stereo audio, and separate but straightforward CN and Intl platforms. 2K requires an extra regeneration call, and the download URL TTL may be as short as 9 h.
  4. **Kling 3.0 (4.0 pending).** Price parity between CN and global, mid-pack quality on AA but #3 on SuperCLUE, and API-key auth since June. Prepaid packs only, with no pay-as-you-go. Kling 4.0's API is not yet available, so an adapter written now would need updating within weeks.
  5. **Vidu Q3.** The **only provider with a true batch-style discount** (`off_peak`, about 50% off, 48 h window), which makes it the closest analogue to the OpenAI Batch mode Sora2App had. It uses a `Token` auth header, and its quality is mid-table.
  - Lower priority: PixVerse V6 (separate CN and Intl platforms, subscription-heavy pricing), Zhipu CogVideoX (cheap per call but not competitive on quality), Baidu MuseSteamer (I2V-focused, low concurrency), and Tencent Hunyuan (being folded into TokenHub, with TC3 signing on legacy endpoints).
- Given the churn, the adapter layer should keep model IDs, resolutions, durations and prices in a data file the user can update, not in code.

### Gaps
- The Artificial Analysis pages could not be opened directly, so the snapshot date of the T2V board and the I2V top 5 are unknown.
- The origin of "Utopai X" (ranked #2 on AA) was not verified.
- No reliable adoption or market-share figures (API revenue, developer counts) were found for any provider in 2026.
- No incident or uptime data (stability SLAs, outage history) was found for any Chinese video API.
- Kling 4.0's API timing and pricing are unannounced as of 2026-10-08.
