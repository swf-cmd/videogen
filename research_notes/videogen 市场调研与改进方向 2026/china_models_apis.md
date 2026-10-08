# China-based AI video generation models and APIs: vendors, capabilities, prices, limits and regulation (as of 2026-10-08)

*Method and caveats, read first.* All sources were accessed on **2026-10-08** unless another date is given. Direct HTTP reads of vendor domains were not possible from this research environment. volcengine.com, aliyun.com, alibabacloud.com, klingai.com/kling.ai, minimaxi.com/minimax.io, vidu.cn/vidu.com and cac.gov.cn either failed DNS or were refused by the egress proxy (HTTP 403). The web-search tool's per-turn budget then ran out before every item could be cross-checked. As a result, most vendor facts below come from **search-engine extracts of the official pages**: the URL cited is the official page, but its body was not read in full. Pages that were fetched directly are marked "(fetched)". The figures also agree with videogen's own provider notes (`docs/providers/ark.md`, `docs/providers/dashscope.md`), which record first-party reads made on 2026-10-08 where the two overlap. "Third-party" marks resellers and blogs. Treat their prices as indicative only.

---

## 1. Vendor-by-vendor: official APIs, endpoints, capabilities, limits and list prices

### Takeaway
Every major Chinese video vendor now has a paid, asynchronous task API. As of Sep–Oct 2026 the flagship generation offers 15–30 s clips, native audio, first/last frame, and especially **multi-reference / subject-consistency inputs**. These references take images, videos and audio, and sometimes documents, and they are now standard rather than a niche feature. Seedance 2.5, Wan 3.0, Kling 3.0 Omni, MiniMax H3, Vidu Q3 参考生 and PixVerse r2v all support them. Seedance 2.5, HappyHorse, Wan 3.0, Kling Omni and MiniMax H3 also expose edit, extend or regeneration modes. For a BYOK tool, the most important structural finding is that **Alibaba 百炼 (Beijing) now resells Kling v3/v3-Omni, Vidu Q3 and PixVerse** behind the same DashScope key and async protocol videogen already speaks. Tencent 混元生视频 and 智谱 also resell Vidu.

### Cited Findings

#### ByteDance: Seedance 2.x on 火山方舟 (Volcengine Ark), BytePlus ModelArk and 即梦/Dreamina
- Model ID `doubao-seedance-2-5-260628` on 火山方舟. Listed capabilities: 全模态参考生视频, 参考生视频, 编辑视频, 延长视频, 首尾帧生视频, 首帧生视频, 文生视频. Output is 480p (8-bit), 720p (8-bit) or 1080p (10-bit), at 24 fps and 4–30 s. — [火山方舟 模型列表](https://docs.volcengine.com/docs/82379/1587798)
- The overseas twin is `dreamina-seedance-2-5-260628` on BytePlus ModelArk. — [BytePlus Seedance product page](https://www.byteplus.com/en/product/seedance); [BytePlus Seedance 2.5 activity page](https://ai.byteplus.com/en/activity/seedance2-5)
- Seedance 2.5 billing has two separately billed steps. A draft (样片) is generated and billed at 480p, then the final video is billed at the target resolution. — [Doubao Seedance 2.5 教程](https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh)
- Native 1080p for Seedance 2.5 went live on Volcengine around 2026-08-17, with the API opened at the same time. — [雷锋网, "Seedance 2.5 正式支持 1080P，API 同步开放"](https://www.leiphone.com/category/industrynews/xvsvCI7gPqM0YzFJ.html); [网易订阅 (same story)](https://www.163.com/dy/article/L4IADORB05118HA4.html)
- Seedance 2.0 family list prices per million tokens (CNY): 2.0 from ¥28 with video input and from ¥46 without; 2.0-fast ¥22 / ¥37; 2.0-mini ¥14 / ¥23. — [火山方舟 product page](https://www.volcengine.com/product/ark); [Volcengine Doubao page](https://www.volcengine.com/product/doubao)
- A separate Volcengine article describes **per-generation (按次) billing** for Doubao-Seedance-2.0-mini. Only the title and snippet were seen. — [Doubao-Seedance-2.0-mini按次计费及优惠政策说明](https://www.volcengine.com/article/2696978)
- Ark has portrait-asset libraries for real-person and virtual-person likenesses, which matter for subject consistency with real faces. Only the titles were seen. — [私域真人人像素材资产使用指南](https://docs.volcengine.com/docs/ark/guide-preview?lang=zh); [录入真人形象素材](https://docs.volcengine.com/docs/ark/upload-real-person-portrait-assets); [私域虚拟人像素材资产库使用指南](https://docs.volcengine.com/docs/ark/private-virtual-avatar-library-guide-preview)
- Dreamina/CapCut consumer pricing ("90% off & $0.035/second") is subscription/credit pricing for the consumer app, not API pricing. — [Dreamina Seedance 2.5 pricing page](https://dreamina.capcut.com/seedance/seedance-2-5-pricing-2026)
- Price details are in Q2 below.

#### Alibaba: 通义万相 Wan 3.0, Wan 3.0 Prime and HappyHorse on 百炼 / Model Studio
- `wan3.0-video` is an "All-in-One" model: 文生视频, 图生视频 (首帧/首尾帧) and 参考生视频 in one model ID. It outputs 480P, 720P or 1080P, up to 30 s. — [万相3.0视频生成API参考 (help.aliyun.com)](https://help.aliyun.com/zh/model-studio/wan3-video-generation-api-reference); [如何调用万相Wan文生视频模型](https://help.aliyun.com/zh/model-studio/text-to-video-guide)
- Parameters seen in official examples: `resolution`, `ratio` (16:9, 4:3, 1:1, 3:4, 9:16 and `adaptive`), `duration` (2–30 s, or −1 for "smart duration"), `prompt_extend`, `watermark`, an audio switch and reference audio. Media item types are `first_frame`, `reference_image`, `reference_video` and `file`. Files can be documents, such as PDF/Word up to 100 MB and 50 pages, which is the "document to video" feature. With reference video, input plus output must stay within 30 s. — [万相3.0视频生成API参考](https://help.aliyun.com/zh/model-studio/wan3-video-generation-api-reference); [text-to-video-guide](https://help.aliyun.com/zh/model-studio/text-to-video-guide)
- Third-party docs give up to 10 reference images, 5 reference videos and 5 audio clips, and an output of 30 fps. These figures are not official. — [GPTProto Wan 3.0](https://gptproto.com/model/qwen/wan-3.0); [Morphic Wan 3.0](https://morphic.com/zh/resources/tools/wan-3-0-ai-video-generator)
- First/last-frame mode cannot be combined with audio or other media (FAQ on the 千问AI平台 page). — [千问AI平台 wan3.0-video](https://www.qianwenai.com/models/wan3.0-video)
- Timeline: public beta around 2026-08-06/07, then official launch on 2026-08-24 with a first-month 30% discount. — [站长之家 2026-08-07](https://m.chinaz.com/2026/0807/1769626.shtml); [新浪财经 2026-08-24](https://finance.sina.com.cn/jjxw/2026-08-24/doc-inipkvrt0037589.shtml); [21经济网 2026-08-24](https://www.21jingji.com/article/20260824/herald/c788370b12a74c2fd4360332562d6a78.html)
- `wan3.0-video-prime` is the faster variant, priced higher. A reseller claims it generates more than 3× faster than standard; that claim is not official. — [wan3.0-video-prime 模型信息](https://www.alibabacloud.com/help/zh/model-studio/wan3-0-video-prime); [linux.do reseller post](https://linux.do/t/topic/2835959)
- HappyHorse (Alibaba) international prices, Singapore: `happyhorse-1.1-t2v` is $0.07 / $0.14 / $0.18 per second (480P/720P/1080P). `happyhorse-1.0-t2v` is $0.14 (720P) and $0.24 (1080P). Each has a 10 s free quota. — [Alibaba Cloud Model Studio pricing (EN)](https://www.alibabacloud.com/help/en/model-studio/model-pricing)
- `happyhorse-1.0-video-edit` does local or global edits of video elements using up to 5 reference images, at $0.14/s (720P) and $0.24/s (1080P) in Singapore. — [happyhorse-1.0-video-edit Model Info](https://www.alibabacloud.com/help/en/model-studio/happyhorse-1-0-video-edit)
- An Alibaba campaign page advertises HappyHorse discounts. The page title says 20% off, while the reported body says 40% off (720P $0.084/s). The terms are unclear. — [HappyHorse campaign](https://www.alibabacloud.com/campaign/happyhorse)
- **百炼 resells third-party video models**:
  - PixVerse V5.6 was the first, in late March 2026. — [量子位 2026-03](https://www.qbitai.com/2026/03/392692.html); [智东西](https://zhidx.com/p/543348.html)
  - At the 2026-05-20 Alibaba Cloud summit, Pixverse-v6-it2v, Kling-v3-omni-video-generation and ViduQ3-Pro were reported as listed on 百炼. — [鱼皮AI导航 news](https://ai.codefather.cn/news/2057489436077215745); [IT之家](https://www.ithome.com/0/953/016.htm)
  - The help-center "视频生成" category lists HappyHorse, 万相, 人像驱动, 爱诗 (PixVerse), 可灵, Vidu and MiniMax. — [百炼 视频生成 category](https://help.aliyun.com/zh/model-studio/video-generation-api/)
  - Vidu on 百炼 is **Beijing-only** and needs a Beijing API key. — [Vidu-图生视频-基于首帧API参考 (百炼)](https://help.aliyun.com/zh/model-studio/vidu-image-to-video-api-reference)
  - PixVerse v5.6 r2v on 百炼 takes 2–7 images. Beijing price: ¥0.47/s at 360P/540P, ¥0.53/s at 720P, ¥0.70/s at 1080P. — [pixverse-v5.6-r2v 模型信息](https://help.aliyun.com/zh/model-studio/pixverse-v5-6-r2v)
  - Kling on 百炼 (Beijing, CNY/s): kling-v3-turbo with audio is 0.8 (720P) / 1.0 (1080P). kling-v3 with audio is 0.9 / 1.2. kling-v3 silent is 0.6 / 0.8. kling-v3 4K is 3.0. There is no free quota, durations are 3–15 s, and `mode` = `pro` (1080P) **is the default** (`std` = 720P). — [可灵kling视频生成API文档 (百炼)](https://help.aliyun.com/zh/model-studio/kling-video-generation-api-reference/); [百炼 model pricing](https://help.aliyun.com/zh/model-studio/model-pricing)

#### Kuaishou: 可灵 Kling 3.0 / 3.0 Omni / O1 (direct API: klingai.com in China, kling.ai globally)
- Official API change log:
  - 2026-02-25: the 3.0 Omni video and image models launched.
  - 2026-04-01: the reference-image-count wording was clarified, with no logic change.
  - 2026-04-23: `mode` = `4k` added, at 3 credits/s.
  - 2026-06-17: Omni reference video extended to 15 s, with 4K support.
  - 2026-07-15: new simplified API structure, with batch query by task IDs and by cursor.
  — [可灵 API 更新公告](https://www.klingai.com/document-api/updates/api)
- Official China price page, 3.0 Omni video (credits/s, where 1 video credit ≈ ¥1):
  - No reference video, silent: 720P 0.6, 1080P 0.8, 4K 3.0.
  - No reference video, with audio: 0.8 / 1.0 / 3.0.
  - With reference video, silent: 0.9 / 1.2 / 3.0.
  - Image API: 1 credit ≈ ¥0.025. Kling Image 3.0/3.0-omni costs 8 credits (≈¥0.2) per 1K/2K image and 16 credits per 4K image.
  — [可灵API服务与价格](https://www.klingai.com/dev/pricing); [预付费资源包 billing page](https://klingai.com/document-api/productBilling/prePaidResourcePackage)
- Endpoints (global docs): `POST /omni-video/kling-3.0-omni`, with a `contents` array of items typed `first_frame` or `refer_image` (each with an `id`). There are also text-to-video and image-to-video endpoints, lip sync, video-to-audio, Motion Control 3.0, Element Management (multi-image "elements" = subject consistency) and custom voices. — [Omni Video Generation](https://kling.ai/document-api/apiReference/model/OmniVideo); [Text to Video](https://kling.ai/document-api/apiReference/model/textToVideo); [Lip Sync](https://kling.ai/document-api/api/video/lip-sync); [Video to Audio](https://kling.ai/document-api/apiReference/model/videoToAudio); [Element Management](https://kling.ai/document-api/apiReference/model/element); [Motion Control 3.0](https://kling.ai/document-api/api/video/motion-control/legacy); [Voice Management](https://app.klingai.com/global/dev/document-api/apiReference/model/customVoices)
- `options` carries `callback_url`, `external_task_id` (a custom ID usable for queries) and `watermark_info`. — [Text to Video](https://kling.ai/document-api/apiReference/model/textToVideo)
- Webhooks are **signed** so the receiver can verify origin and integrity. The test callback is limited to one per 6 s. — [Callback Protocol](https://kling.ai/document-api/api/get-started/callbacks)
- A third-party PRD (ArcReel issue #676, opened 2026-05-29, fetched) describes the API as follows:
  - Base URL `https://api.klingai.com/v1`. China-site (app.klingai.com) and global-site keys differ.
  - Auth is a JWT HS256 token: AccessKey in `iss`, signed with the SecretKey, 30-minute `exp`.
  - Endpoints `/v1/videos/{text2video|image2video|multi-image2video}`.
  - Video models `kling-v2-5-turbo`, `kling-v3`, `kling-v3-omni`, `kling-v2-6`, `kling-video-o1`, with std/pro tiers. 4K only on v3 and v3-omni.
  - The video reference-image maximum is "to be confirmed in console".
  — [ArcReel issue #676 (fetched)](https://github.com/ArcReel/ArcReel/issues/676)
- Third-party claim: Omni accepts up to 7 reference images. Not confirmed officially. — [imaginetovideo blog](https://imaginetovideo.com/blog/introducing-kling-v3-omni-multi-reference)
- Global USD pricing (**third-party** reporting of the kling.ai developer price page; not readable here):
  - Kling 3.0 silent: $0.084/s at 720p, $0.112 at 1080p, $0.42 at 4K.
  - Kling 3.0 with audio: $0.126 / $0.168.
  - 3.0 Turbo with audio: $0.112 / $0.14.
  - Omni with video input, silent: $0.126 / $0.168.
  - 1 unit = $0.14. Prepaid packs run from $700 for 5,000 units to $7,560 for 60,000 units, valid 180 days.
  — [vidirect Kling pricing](https://vidirect.org/tools/kling/pricing); [aireiter Kling API pricing](https://aireiter.com/blog/kling-api-pricing). Videogen's OpenRouter catalog independently lists kling-v3.0-std at $0.084/$0.126 and pro at $0.112/$0.168 (720p silent/audio). — [OpenRouter video models](https://openrouter.ai/api/v1/videos/models), as recorded in `data/catalog/openrouter.json`
- **Kling 4.0** was announced on 2026-09-28, with the full model due in October 2026. A lighter "4.0 Flash" is reported live for limited (Ultra) subscribers only. The **4.0 API is "coming soon"**, with no model ID or price. All of this comes from third-party reports. — [SpicyAPI](https://spicyapi.ai/it/blog/kling-4-0-release-date-and-api); [seedancegen](https://seedancegen.com/blog/kling-4); [trygenly](https://blog.trygenly.io/en/kling-4-0-ai-video-model)

#### MiniMax: 海螺 Hailuo / MiniMax H3 ("Hailuo 03"); CN platform.minimaxi.com, global platform.minimax.io
- H3 is a multimodal video model. It supports text-to-video, image-to-video, first/last frame and multimodal reference, at 768P or 2K and 4–15 s. H3-Max is the fast variant: t2v and i2v only, no multimodal reference, 480P/768P, 5–15 s. — [MiniMax 视频生成 guide](https://platform.minimaxi.com/docs/guides/video-generation); [创建视频生成任务](https://platform.minimaxi.com/docs/api-reference/video-generation-v2-create)
- Input rules: first and last frame take at most 1 image each, and reference images at most 9. The image roles (first/last frame) are **mutually exclusive** with reference roles (`reference_image`, `reference_video`, `reference_audio`). — [创建视频生成任务](https://platform.minimaxi.com/docs/api-reference/video-generation-v2-create)
- Other endpoints:
  - "视频再生成" `/v2/video_regeneration` upgrades a 768P H3 video (`base_video`, with the same inputs) to 2K. Request body limit 64 MB.
  - H3-Context-IR returns an enhanced prompt only.
  - There is no generic "video edit" endpoint.
  — [创建视频再生成任务](https://platform.minimaxi.com/docs/api-reference/video-generation-v2-regeneration); [创建 H3-Context-IR 任务](https://platform.minimaxi.com/docs/api-reference/video-generation-v2-h3-context-ir)
- Open weights under the MiniMax H3 Community License: FL2VA (t2v, plus 0/1/2 frame images) and Ref2VA (up to 9 images, 3 videos and 3 audio clips, 12 files in total). Output is 4–15 s, 768 px short side by default with 2K via the hosted Regenerate-2K, 24 fps, and 32 kHz stereo audio. Context-IR and Regenerate-2K are not open-sourced. — [MiniMax-AI/MiniMax-H3 README.zh-CN (fetched)](https://github.com/MiniMax-AI/MiniMax-H3/blob/main/README.zh-CN.md)
- CN official pay-as-you-go prices:
  - MiniMax-H3: **768P ¥0.50/s, 2K ¥0.80/s**.
  - H3-Max: 480P ¥0.33/s, 768P ¥0.50/s.
  - Regeneration 768P→2K: ¥0.30/s.
  - Input video is billed by input duration at the output-resolution rate.
  - Video resource packs (视频资源包) cover the Hailuo series but **not H3**.
  — [按量计费](https://platform.minimaxi.com/docs/guides/pricing-paygo); [定价概览](https://platform.minimaxi.com/docs/pricing/overview); [视频资源包](https://platform.minimaxi.com/docs/guides/pricing-video)
- Conflicting figure: a 量子位 article reports seeing 2K at ¥0.15/s. It is unverified and may be a promotion or another channel. — [量子位 2026-08](https://www.qbitai.com/2026/08/467036.html)
- USD pricing:
  - OpenRouter lists H3 from $0.13/s, plus $0.04 per reference image after the first 5. H3 Max is $0.05/s (480p) and $0.08/s (768p). — [OpenRouter H3](https://openrouter.ai/minimax/hailuo-3); [OpenRouter H3 Max](https://openrouter.ai/minimax/hailuo-3-max)
  - A community HF blog gives 2K at $0.13/s, with 768p at $0.09/s in "closed beta, contact sales". — [HF blog](https://huggingface.co/blog/ResterChed/minimax-h3-hailuo-3-0)
  - EvoLink cites official rates of $0.080 (768p) and $0.130 (2K). — [EvoLink H3](https://evolink.ai/hailuo-3)

#### 生数 Shengshu: Vidu Q3 (CN platform.vidu.cn; international platform.vidu.com)
- CN credits: **1 credit = ¥0.03125**. A ¥500 top-up buys 16,000 credits, valid 1 year. Concurrency is at most 5 tasks, with excess tasks queued. — [Vidu 产品定价 (CN)](https://platform.vidu.cn/docs/pricing)
- CN reference-to-video (参考生), credits/s:
  - viduq3-mix: 720p 24, 1080p 29, no off-peak price.
  - viduq3-turbo: 540p/720p/1080p 4 / 10 / 13, off-peak 2 / 5 / 7.
  - The viduq3 standard row was truncated in the extract.
  - Off-peak pricing for viduq3-pro and viduq3-turbo applies only when `audio` = true.
  — [Vidu 产品定价 (CN)](https://platform.vidu.cn/docs/pricing)
- International: $0.005 per credit plus sales tax.
  - Q3 reference2video: about $0.035 / $0.06 / $0.075 per second (540P/720P/1080P), off-peak about $0.02 / $0.03 / $0.035.
  - Q3-turbo 1080P $0.065/s; Q3-pro 1080P $0.12/s; Q3-mix 1080P $0.145/s.
  - Q3-pro text2video, img2video and start-end2video run 1–16 s at 1080P 24 credits/s, 720P 20, 540P 9 (off-peak 12 / 10 / 5).
  — [Vidu pricing (intl)](https://platform.vidu.com/docs/pricing)
- Failed generations are not charged, including failures caused by moderation. — [Vidu pricing (intl)](https://platform.vidu.com/docs/pricing)
- Model IDs for image-to-video include `viduq3-turbo`, `viduq3-pro` and `viduq3-pro-fast`. Image rules: exactly 1 first-frame image; aspect ratio within 1:4 to 4:1; at most 50 MB per image; HTTP body at most 20 MB. — [Vidu 图生视频 (CN)](https://platform.vidu.cn/docs/image-to-video)
- Reference-to-video on viduq3/viduq3-turbo runs 3–16 s, defaults to 720p and also offers 540p and 1080p. `callback_url` is an optional create field, and Vidu POSTs on status change. — [Vidu Reference to Video (intl)](https://platform.vidu.com/docs/reference-to-video)
- Q3 参考生 upgrade (around April 2026) supports up to 7 subjects. — [Bilibili video title](https://www.bilibili.com/video/BV1915v6bEcs/); [东方财富 2026-04-13](https://caifuhao.eastmoney.com/news/20260413195302913489010)
- Vidu is also resold by 百炼 (Beijing only), by Tencent 混元生视频 ("提交Vidu文生视频任务") and by 智谱 (Vidu 2). — [百炼 Vidu i2v](https://help.aliyun.com/zh/model-studio/vidu-image-to-video-api-reference); [腾讯云 提交Vidu文生视频任务](https://cloud.tencent.com/document/product/1616/130563); [智谱 Vidu 2](https://docs.bigmodel.cn/cn/guide/models/video-generation/vidu2)

#### 爱诗科技 PixVerse (domestic brand 拍我AI; platform.pai.video)
- The API has its own plans, separate from web membership:
  - Free tier: credits can be bought for testing, up to 540p.
  - Basic: ¥500/month for 17,055 credits.
  - Advanced: ¥7,000/month for 238,680 credits.
  - Pro: ¥18,000/month for 632,835 credits.
  — [如何购买API服务](https://docs.platform.pai.video/7029310m0); [拍我AI 开放平台](https://platform.pai.video/)
- V6 (and C1) are billed per second. V6 credits/s, silent / with audio: 360p 5/7, 540p 7/9, 720p 9/12, 1080p 18/23. — [能力矩阵](https://docs.platform.pai.video/8843807m0)
- International third-party prices: fal charges $0.090/s (1080p silent) and $0.115/s (with audio), and $0.045/s and $0.060/s at 720p. — [novoads](https://novoads.ai/en/blog/pixverse-v6-for-ads)
- PixVerse V5.5 (Dec 2025) was billed as China's first model to generate storyboards (分镜) and audio in one pass. — [量子位 2025-12](https://www.qbitai.com/2025/12/358046.html)

#### Tencent: 混元 Hunyuan Video (腾讯云 混元生视频 / vclm)
- Billing is credit-based:
  - Free tier: 50 credits per user, a one-time pack claimed in the console, valid 1 year.
  - Post-paid billing is **not** automatic and must be enabled manually.
  - Prepaid packs are per-interface and not interchangeable.
  - Published prices seen are for other interfaces only: 图片跳舞 at 100 calls for ¥1,200, and 视频风格化 at 20 min for ¥650.
  — [混元生视频 计费概述](https://cloud.tencent.com/document/product/1616/118994); [计费概述 (older)](https://cloud.tencent.com/document/product/1616/79753); [免费额度](https://cloud.tencent.com/document/product/1616/82562)
- Hunyuan model features are migrating to TokenHub. The original platform stops adding models and stops new sales. No timeline was given, and it is uncertain which Tencent page carries this statement. — [混元生视频 计费概述](https://cloud.tencent.com/document/product/1616/118994); [TokenHub Token Plan](https://cloud.tencent.com/document/product/1823/130060)
- HunyuanVideo 1.5 (8.3B, 5–10 s) was open-sourced on 2025-11-21. — [新浪财经 2025-11-21](https://finance.sina.com.cn/roll/2025-11-21/doc-infyeerz8821109.shtml)

#### 智谱 Zhipu: CogVideoX / 清影 (bigmodel.cn)
- CogVideoX-3 costs ¥1 per generation, with no Batch API. CogVideoX-2 costs ¥0.5 per generation, or **¥0.25 via Batch API**. CogVideoX-Flash is free. The snapshot is undated. — [智谱 API 定价](https://docs.bigmodel.cn/cn/guide/start/pricing); [CogVideoX-Flash](https://docs.bigmodel.cn/cn/guide/models/free/cogvideox-flash)

#### 百度 Baidu: 蒸汽机 MuseSteamer (千帆)
- Pricing is credit-based at 1 credit = ¥1. The MuseSteamer 2.0 family has five models: Turbo-I2V-Audio (720P, 5/10 s, audio, multi-person dialogue), Turbo-I2V (720P, 5 s), Pro-I2V (1080P), Lite-I2V and Turbo-I2V-Effect. The endpoint is `qianfan.baidubce.com/video/generations` with model names such as `musesteamer-2.0-turbo-i2v-audio`. The per-model credit table was truncated. — [千帆 视频生成](https://cloud.baidu.com/doc/qianfan-docs/s/rmejr4y27); [百度蒸汽机（MuseSteamer)](https://cloud.baidu.com/doc/qianfan-docs/s/amejnlwya)
- MuseSteamer 2.0 launched in August 2025. — [新华网 2025-08-22](http://www.news.cn/tech/20250822/18c2d24c42724e82a2e3f1902d0ea8a1/c.html)

#### 商汤 SenseTime and 阶跃星辰 StepFun
- SenseTime **Seko** is an AI short-drama/video agent, not a model API. Third-party reports say it integrated Seedance 2.0 and opened an API and "SekoClaw" batch automation around April 2026. No official developer docs were found. — [TopMarketing](https://www.itopmarketing.com/info22206); [新浪 商汤Seko接入Seedance 2.0](https://www.sina.cn/news/detail/5288675361427860.html)
- StepFun Step-Video-T2V (30B, open-sourced Feb 2025, 540P, 204 frames) and Step-Video-TI2V (5 s, 540P) are open-weights models. The 2026 official StepFun API is text and vision-understanding focused (step-5-preview, September 2026). No video-generation API was found. — [阿里云开发者社区 on Step-Video](https://developer.aliyun.com/article/1652803); [知乎 Step-Video-TI2V](https://zhuanlan.zhihu.com/p/31775732208); [力达云 阶跃 API 概览](https://lidayun.com/article/domestic-step/)

### Inferences
- **At-a-glance list prices.** These restate the cited findings above; "/s" means per output second.

  | Vendor / model | Route | 720p | 1080p (or top tier) | Max length | Multi-ref | Edit/extend |
  |---|---|---|---|---|---|---|
  | Seedance 2.5 | 火山方舟 CN | ≈¥1.51/s | ≈¥3.74/s (see Q2) | 30 s | yes (全模态) | edit + extend |
  | Seedance 2.5 | BytePlus | ≈$0.231/s | ≈$0.569/s | 30 s | yes | edit + extend |
  | Wan 3.0 | 百炼 Beijing | ¥0.6/s | ¥1.2/s | 30 s | yes (+docs, audio) | via reference video (AA #1 editing) |
  | Wan 3.0 | Singapore | $0.10/s | $0.20/s | 30 s | yes | as above |
  | Kling 3.0 (Omni) | klingai.com CN | ¥0.6–0.9/s | ¥0.8–1.2/s; 4K ¥3.0/s | 15 s | yes (refer_image, elements) | ref-video input |
  | MiniMax H3 | minimaxi CN | ¥0.50/s (768P) | ¥0.80/s (2K) | 15 s | 9 img / 3 vid / 3 audio | 2K regeneration |
  | Vidu Q3-pro | vidu.com | $0.10/s | $0.12/s; off-peak ~½ | 16 s | Q3 参考生 ≤7 subjects | — |
  | PixVerse V6 | pai.video | ≈¥0.26/s silent | ≈¥0.53/s silent | — | r2v 2–7 img (5.6 on 百炼) | — |
  | CogVideoX-3 | bigmodel | ¥1 per generation | — | — | — | — |

- Seedance 2.5 is the premium-priced model at roughly 2.5–3× Wan 3.0 per second at 720p/1080p in China. Wan 3.0 Beijing, Kling 3.0 and MiniMax H3 cluster at ¥0.5–1.2/s for 720p–1080p. Vidu Q3-turbo and PixVerse are the budget tier.
- A single 百炼 integration can cover Wan, HappyHorse, Kling v3/Omni, Vidu Q3 and PixVerse for Chinese users, Beijing region only for the third-party models. That gives videogen four "missing" vendors through an adapter it already has. Per-model request schemas still differ, so each needs its own schema mapping.
- Direct integrations still matter for features or prices the resellers may not pass through:
  - Kling direct: signed webhooks, `external_task_id`, multi-image elements, lip-sync.
  - MiniMax direct: CNY ¥0.5–0.8/s, regeneration to 2K.
  - Vidu direct: off-peak ~50% pricing.
  This is an inference; field-level parity on 百炼 was not verified.
- "Multi-reference / subject consistency" is now a baseline feature across all six leading vendors. It is the biggest capability gap in videogen's current per-shot first/last-frame model.

### Gaps
- Several pages could not be read: Kling's official China resource-pack CNY prices (yuan per credit pack), its concurrency-rules page, and its result-URL validity on the direct API.
- The official Kling video reference-image maximum is unconfirmed (third-party says 7; ArcReel says "check console").
- Several items were not found: MiniMax H3 international official USD pay-as-you-go table (only third-party and OpenRouter figures), the full CN viduq3 standard t2v/i2v table, Vidu lip-sync price, Tencent 混元生视频 per-credit prices for t2v/i2v, and Baidu MuseSteamer 2.0 per-model credit consumption.
- No official SenseTime or StepFun video-generation API was found.
- Whether 百炼's Kling/Vidu/PixVerse listings expose all native features is unverified. Examples include callbacks, Omni video input, off-peak mode and multi-subject inputs.
- Kling 4.0 API ID, price and date are not published as of 2026-10-08, per third-party reports only.

---

## 2. Actual China list price for Seedance 2.5 on 火山方舟, and Wan 3.0 prices on 百炼 Beijing/Singapore

### Takeaway
Seedance 2.5 on 火山方舟 is billed per token: **¥70 per million tokens without video input and ¥42 per million with video input**. Tokens ≈ duration × width × height × 24 fps / 1024. That works out to roughly **¥0.67/s at 480p and ¥1.51/s at 720p**. For 1080p, reports give **≈¥3.7/s** list, which fits ¥77/M (a temporary ¥2.7/s promotion ended on 2026-09-17). Wan 3.0 on 百炼 Beijing is **¥0.3 / ¥0.6 / ¥1.2 per second** (480P/720P/1080P). Singapore is **$0.05 / $0.10 / $0.20 per second**, which the Chinese-language page shows as CNY 0.37471 / 0.74942 / 1.49884. The launch 30%-off promotions have expired.

### Cited Findings
- **Seedance 2.5 CNY list:** ¥42 per million tokens with video input, ¥70 per million without. — [火山方舟 product page](https://www.volcengine.com/product/ark); [Volcengine Doubao page](https://www.volcengine.com/product/doubao)
- Media reports derived from the official price give 720P ≈ ¥1.51/s, or ¥7.56 for 5 s, and 480P ≈ ¥3.36 for 5 s (≈¥0.67/s). — [AITOP100 "Seedance 2.5价格公布：720P每秒约1.51元"](https://www.aitop100.cn/infomation/details/34378.html); [实在智能](https://www.ai-indeed.com/encyclopedia/29280.html)
- 1080P image-to-video was reported at a regular price of **¥3.7/s**, cut to ≈¥2.7/s for the first month after the ~2026-08-17 1080P launch. The offer ended on 2026-09-17. — [雷锋网](https://www.leiphone.com/category/industrynews/xvsvCI7gPqM0YzFJ.html); [网易订阅](https://www.163.com/dy/article/L4IADORB05118HA4.html)
- Videogen's own provider notes record that official search indexing of the CN price page showed **¥70/M at 480p/720p and ¥77/M at 1080p** (without input video). They kept this unverified because the page body could not be read. — `docs/providers/ark.md` (repo), citing [火山方舟 model pricing](https://docs.volcengine.com/docs/ark/model-pricing?lang=en&redirect=1)
- Token formula (2.0 series, third-party documentation): (input video duration + output video duration) × width × height × frame rate / 1024. — [ArcReel 火山方舟费用参考 (search extract; the direct fetch returned 404 on 2026-10-08)](https://github.com/ArcReel/ArcReel/blob/main/docs/ark-docs/%E7%81%AB%E5%B1%B1%E6%96%B9%E8%88%9F%E8%B4%B9%E7%94%A8%E5%8F%82%E8%80%83.md)
- BytePlus publishes the same output-only formula, with 5-second 16:9 examples of $0.514 (480p), $1.156 (720p) and $2.843 (1080p). — [BytePlus ModelArk pricing](https://docs.byteplus.com/en/docs/modelark/model-pricing), as recorded in videogen `docs/providers/ark.md`
- When the input includes video, Seedance 2.0-series and 2.5 requests have a **minimum token charge**. If the estimate falls below the floor, the floor is billed. The floor varies with resolution and other settings. — [火山方舟 模型价格](https://www.volcengine.com/docs/82379/1099320); [Seedance 2.5 教程](https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh)
- BytePlus Seedance 2.5:
  - $10.70/M tokens without video input, $6.40/M with video input. These are third-party reports. — [CometAPI](https://www.cometapi.com/seedance-2-5-api-pricing/); [Leadde](https://leadde.ai/blog/how-much-is-seedance-2-5); [Cellcog](https://cellcog.ai/blog/seedance-2-5-pricing/)
  - Videogen's notes record official $10.70/M for 480p/720p and **$11.70/M for 1080p**. — [BytePlus model pricing](https://docs.byteplus.com/en/docs/modelark/model-pricing) via `docs/providers/ark.md`
  - Reported prepaid packs: $32 for 5M tokens, $64 for 10M, $640 for 100M, valid 3 months. — [BytePlus Seedance 2.5 activity page](https://ai.byteplus.com/en/activity/seedance2-5) (as summarized by search; not read directly)
  - Conflict on 1080p: one comparison marks 1080p as "Not offered" on ModelArk, while other sources and BytePlus examples price it. — [Cellcog](https://cellcog.ai/blog/seedance-2-5-pricing/)
- **Wan 3.0 Beijing:** 480P ¥0.3/s, 720P ¥0.6/s, 1080P ¥1.2/s. There is a 30 s free quota per resolution, valid 90 days from activation, model release or approval, whichever is later. — [wan3.0-video 模型信息](https://help.aliyun.com/zh/model-studio/wan3-0-video); [百炼模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)
- The launch promotion was 30% off (¥0.21 / ¥0.42 / ¥0.84 per second) from 2026-08-24 to 2026-09-23. — [新浪财经 2026-08-24](https://finance.sina.com.cn/jjxw/2026-08-24/doc-inipkvrt0037589.shtml)
- The 千问AI平台 page still showed "限时7折" when indexed. — [千问AI平台 wan3.0-video](https://www.qianwenai.com/models/wan3.0-video)
- **Wan 3.0 Prime, Beijing:**
  - The official table shows 0.0636 / 0.127199 / 0.254399 per second with no currency label. The German table on the same page has identical numbers marked USD. — [wan3.0-video-prime 模型信息](https://www.alibabacloud.com/help/zh/model-studio/wan3-0-video-prime)
  - CNY ¥0.45 / ¥0.9 / ¥1.8 per second appear on Alibaba's benefit page and on 千问AI平台. — [阿里云 Wan3.0 权益页](https://www.aliyun.com/benefit/scene/wan); [千问AI平台 wan3.0-video-prime](https://www.qianwenai.com/models/wan3.0-video-prime)
- **Wan 3.0 Singapore (international):** wan3.0-video is $0.05 / $0.10 / $0.20 per second and Prime is $0.068 / $0.14 / $0.28. Frankfurt and Virginia show lower rates, about $0.041–$0.165. A 30 s free quota for combined input+output duration is offered **only in Singapore**. — [wan3.0-video model info (EN)](https://www.alibabacloud.com/help/en/model-studio/wan3-0-video); [wan3.0-video-prime (EN)](https://www.alibabacloud.com/help/en/model-studio/wan3-0-video-prime); [Model Studio pricing (EN)](https://www.alibabacloud.com/help/en/model-studio/model-pricing)
- A third-party source reports Singapore console discounts of $0.035 / $0.07 / $0.14 until 2026-09-24 (UTC+8). — [llm-stats Wan 3.0 launch](https://llm-stats.com/blog/research/wan-3.0-launch)
- Videogen's catalog stores the Singapore rates as CNY 0.37471 / 0.74942 / 1.49884 for wan3.0-video and CNY 0.495838 / 1.020844 / 2.041687 for Prime, taken from the Chinese-language pricing page. — `data/catalog/dashscope.json` (repo), citing [Model Studio pricing](https://help.aliyun.com/en/model-studio/model-pricing)
- Only generated output seconds are charged for Wan; input is not charged. — [Model Studio pricing (EN)](https://www.alibabacloud.com/help/en/model-studio/model-pricing)

### Inferences
- **Seedance 2.5 CNY by resolution** (my arithmetic, 16:9, 24 fps, no input video):
  - 480p (854×480): 9,607.5 tokens/s × ¥70/M ≈ **¥0.67/s**, which matches the reported ¥3.36 per 5 s.
  - 720p (1280×720): 21,600 tokens/s × ¥70/M ≈ **¥1.512/s**, which matches the reported ¥7.56 per 5 s.
  - 1080p (1920×1080): 48,600 tokens/s × ¥77/M ≈ **¥3.74/s**, which matches the media-reported "3.7元/秒" regular price.
  - The ¥77/M 1080p rate is therefore corroborated by two independent signals: the indexed price-page excerpt and the media per-second figure. It is still not a direct read.
  - It also mirrors BytePlus's 1080p uplift ($11.70 vs $10.70 = 1.09×; ¥77 vs ¥70 = 1.10×).
  - Implied FX: ¥70 / $10.70 ≈ 6.54 CNY/USD, so CN and BytePlus list prices are effectively at parity.
  - Videogen's ark.json can reuse the BytePlus token formula with a CNY table {480p: 70, 720p: 70, 1080p: 77} per M (no video input) and {480p/720p: 42} per M (with video input). It should keep a "verify in console" flag and treat the video-input floor as unknown.
- The Wan 3.0 Singapore CNY figures are not one consistent FX conversion: the implied rate is 7.494 for standard and 7.292 for Prime. The EN and ZH pages may be priced independently, so videogen should store whichever currency the user is billed in for that workspace.
- The CNY per-second ladder for 1080p in China: Wan 3.0 ¥1.2 < Kling v3 ¥0.8–1.2 (silent/audio) ≈ Wan Prime ¥1.8 < Seedance 2.5 ≈¥3.74.

### Gaps
- The official 火山方舟 price-page body (82379/1099320) was not readable. The 1080p ¥77/M rate and the 1080p with-video-input rate are unconfirmed.
- The exact minimum-token floor for video input is unknown.
- Whether 2.5's draft step is billed in all modes, and how that changes a typical job's cost, is unverified.
- The currency of the Wan 3.0 Prime Beijing table is ambiguous on the official page.
- Whether any post-promotion discount is still live for Wan 3.0 (千问AI平台 still showed 7折 when indexed) is unknown; only the console can confirm.

---

## 3. Concurrency / RPM / QPS limits, result retention, callbacks, and batch/offline discounts

### Takeaway
Every vendor is asynchronous and rate-limits task submission on two axes: **submission rate (RPM/RPS) and in-flight concurrency**. Concurrency is low: individual 火山方舟 accounts get 3, 百炼 Wan 5, Vidu 5, and MiniMax H3 2 on free tier or 15 paid. Result URLs mostly live **24 h**: Ark has a 100-download cap on 2.5, 百炼 24 h, and 百炼's Kling links 30 days. **Callbacks** exist on Ark, Kling (signed), MiniMax (challenge handshake) and Vidu, but none was found for 百炼 Wan. True batch discounts are rare for current video flagships: Ark `flex` gives 50% off but **not** for Seedance 2.x. The batch-like discounts that do exist are Vidu off-peak (≈50%) and 智谱's CogVideoX-2 Batch API (50%).

### Cited Findings
- **火山方舟 Seedance 2.0/2.5:**
  - Limits per main account per model (versions share quota): enterprise RPM 600 with 10 concurrent tasks; individual RPM 180 with 3 concurrent.
  - At 4K the table shows RPM 15 and concurrency 1. Its model scope is unclear.
  - Exceeding RPM returns 429; exceeding concurrency queues the task.
  — [Seedance 2.5 教程](https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh); [Seedance 2.0 快速入门](https://docs.volcengine.com/docs/ark/seedance-2-0?lang=zh); [模型列表](https://docs.volcengine.com/docs/82379/1587798)
- 火山方舟 has `callback_url`: Ark POSTs to it on status change, with a body equal to the query-task response. — [创建视频生成任务](https://docs.volcengine.com/docs/ark/create-video-generation-task-api)
- 火山方舟 retention: the video URL lasts 24 h and task records 7 days. Seedance 2.5 video URLs allow **at most 100 downloads**. — [查询视频生成任务](https://docs.volcengine.com/docs/ark/get-video-generation-task-api?lang=zh)
- 火山方舟 offline inference: `service_tier: "flex"` costs **50% of online** and has higher TPD quotas, aimed at hour-level latency tolerance. It is **not supported for Seedance 2.5 or the 2.0 series**. It cannot be combined with priority settings or with 1.5-pro draft mode. The Java example sets a 172,800 s (48 h) expiry. — [视频生成入门教程](https://docs.volcengine.com/docs/ark/video-generation-tutorial?lang=zh); [创建视频生成任务](https://docs.volcengine.com/docs/ark/create-video-generation-task-api); [Seedance 2.0 快速入门](https://docs.volcengine.com/docs/ark/seedance-2-0?lang=zh)
- Third-party list of flex prices for older models (CNY per M tokens, offline vs online): seedance-1.5-pro 8/4 (audio/silent) vs 16/8; 1.0-pro 7.5 vs 15; 1.0-pro-fast 2.1 vs 4.2; 1.0-lite 5 vs 10. — [ArcReel 火山方舟费用参考 (search extract)](https://github.com/ArcReel/ArcReel/blob/main/docs/ark-docs/%E7%81%AB%E5%B1%B1%E6%96%B9%E8%88%9F%E8%B4%B9%E7%94%A8%E5%8F%82%E8%80%83.md)
- **百炼 (Wan and others):**
  - Limits are per main account, aggregated across RAM sub-accounts, workspaces and keys.
  - wan3.0-video and the wan2.7 t2v/i2v/r2v models are limited to RPS 5 and concurrency 5. Older wan2.2/2.1 models are limited to 2 and 2. Limits differ by region.
  - Throttling returns HTTP 429 `Throttling`.
  — [百炼 限流](https://help.aliyun.com/zh/model-studio/rate-limit); [限流应对最佳实践](https://help.aliyun.com/zh/model-studio/rate-limiting-best-practices)
- 百炼 query interface: default RPS 20. The docs recommend async callbacks for higher-frequency needs, but no Wan-video callback configuration was found. — [万相2.7-参考生视频-API参考](https://help.aliyun.com/zh/model-studio/wan-video-to-video-api-reference); [异步调用API参考](https://help.aliyun.com/zh/model-studio/asynchronous-call-api-reference)
- A third-party page lists wan3.0-video at concurrency 5, async queue cap 500 and RPM 300. — [千问AI平台 wan3.0-video](https://www.qianwenai.com/models/wan3.0-video)
- 百炼 retention: `task_id` can be queried for 24 h, after which status is UNKNOWN. Video URLs last 24 h. HTTP calls must be async (`X-DashScope-Async: enable`). — [万相2.7-参考生视频-API参考](https://help.aliyun.com/zh/model-studio/wan-video-to-video-api-reference); [wan2.2-s2v API](https://help.aliyun.com/zh/model-studio/wan-s2v-api)
- 百炼 Kling: the video link is valid **30 days** and `task_id` can be queried for 24 h. — [Kling video generation API (百炼)](https://help.aliyun.com/en/model-studio/kling-video-generation-api-reference/)
- **Kling direct:**
  - QPS and concurrent-task limits are **configured per customer account**.
  - Requests over the real-time concurrency limit, or with insufficient balance, are rejected before generation.
  - Callbacks are signed.
  - Batch query by task IDs and cursor was added on 2026-07-15.
  — [Kling SLA](https://kling.ai/document-api/protocols/paidLevelProtocol); [Callback Protocol](https://kling.ai/document-api/api/get-started/callbacks); [可灵 API 更新公告](https://www.klingai.com/document-api/updates/api)
- **MiniMax:**
  - H3 is limited by CONN (max parallel tasks): free users 2, paid users 15. The Hailuo series is limited by RPM: free 5, paid 20. No RPM is published for H3. — [MiniMax 速率限制](https://platform.minimaxi.com/docs/guides/rate-limits)
  - `callback_url` requires a 3-second **challenge handshake** (echo the `challenge` value). The pushed body then mirrors the query response, with statuses queued/running/succeeded/failed/cancelled. — [创建视频生成任务](https://platform.minimaxi.com/docs/api-reference/video-generation-v2-create)
  - MiniMax also offers task list, cancel and delete endpoints. — [MiniMax 视频生成 guide](https://platform.minimaxi.com/docs/guides/video-generation)
- **Vidu:**
  - Concurrency is at most 5, with extra tasks queued. Concurrency is independent of QPS. It may be lower under rare system load. — [Vidu 产品定价 (CN)](https://platform.vidu.cn/docs/pricing)
  - `callback_url` is supported. — [Vidu Reference to Video](https://platform.vidu.com/docs/reference-to-video)
  - **Off-peak** prices are about 50% of standard: Q3-pro 12/10/5 vs 24/20/9 credits/s at 1080P/720P/540P, and Q3-turbo r2v 2/5/7 vs 4/10/13. Off-peak does not apply to q3-mix and needs `audio` = true for pro and turbo. — [Vidu pricing (intl)](https://platform.vidu.com/docs/pricing); [Vidu 产品定价 (CN)](https://platform.vidu.cn/docs/pricing)
- **智谱:** CogVideoX-2 Batch API costs ¥0.25 per generation vs ¥0.5 standard. CogVideoX-3 has no batch option. — [智谱 API 定价](https://docs.bigmodel.cn/cn/guide/start/pricing)

### Inferences
- Videogen's per-provider/region lanes should default to these concurrency and RPM limits:
  - Ark individual: 3 concurrent, 180 RPM. Enterprise: 10 / 600.
  - 百炼 Wan: 5 / RPS 5.
  - Vidu: 5.
  - MiniMax H3: 2 on free tier, 15 paid.
  - Kling: account-specific, so the lane should be user-configurable.
  - Vidu and Ark queue over-concurrency tasks rather than rejecting them. MiniMax H3 hard-429s (per a third-party tutorial), so its client-side cap matters most.
- Callbacks need a publicly reachable HTTPS endpoint, which a local-first app does not have. Polling should therefore remain primary. Callback support is useful mainly as an optional "relay URL" feature. `external_task_id` (Kling) is directly useful for crash-safe idempotent recovery, by matching remote tasks to local job IDs.
- For a batch tool, the realistic "batch discount" features are:
  - (a) a Vidu off-peak toggle, which is ≈50% and needs audio on;
  - (b) Ark `flex`, but only for legacy Seedance 1.x, which is probably not worth building now;
  - (c) 智谱 CogVideoX-2 batch.
  No batch or offline discount was found for Seedance 2.x, Wan 3.0, Kling, MiniMax or PixVerse.
- The 24 h URL lifetime plus Ark's 100-download cap means auto-download should run immediately after success and must not re-fetch the same URL repeatedly.

### Gaps
- The Kling direct API's video result-URL lifetime and default concurrency (the Concurrency Rules page body) were not readable.
- PixVerse API concurrency and retention, and Vidu result-URL lifetime, were not found.
- 百炼 Kling/Vidu concurrency values were truncated in the extract.
- No 百炼 batch or offline inference support for video was found. Absence is not confirmed.

---

## 4. Account requirements: 实名认证, minimum balance and free quotas

### Takeaway
China-side video APIs generally require a funded, real-name account. 火山方舟 is the strictest: Seedance 2.x needs a **balance above ¥200** (or a ¥200+ savings plan or pack). Kling direct and PixVerse are pack or plan based, with high minimum spends: Kling global packs start at $700 (third-party), and PixVerse's API Basic plan is ¥500/month. Vidu needs a ¥500 top-up, 百炼 is pay-as-you-go with small free quotas, and MiniMax H3 is pay-as-you-go only. Free quotas are small: Wan 3.0 30 s per resolution, HappyHorse 10 s, Tencent 50 credits; Kling via 百炼 has none.

### Cited Findings
- **火山方舟 Seedance 2.5 / 2.0 activation:** one of three conditions must hold: a balance above ¥200 (recommended), a savings plan at the ¥200 tier or higher, or a purchased Seedance 2.5/2.0 resource pack with remaining quota. — [Seedance 2.5 教程](https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh); [创建视频生成任务](https://docs.volcengine.com/docs/ark/create-video-generation-task-api)
- BytePlus's equivalent options are a balance above $30, a $30+ savings plan, or a pack with remaining quota. — [BytePlus Seedance 2.5 tutorial](https://docs.byteplus.com/en/docs/modelark/seedance-2-5), as recorded in videogen `docs/providers/ark.md`
- BytePlus's service-country list omits the US but includes Canada, the UK, Australia and New Zealand. — [BytePlus ModelArk availability](https://docs.byteplus.com/en/docs/ModelArk/availability) via `docs/providers/ark.md`
- Ark restricts direct uploads of real faces. Official flows use authorized portraits, generated assets or preset virtual people. — [创建视频生成任务](https://docs.volcengine.com/docs/ark/create-video-generation-task-api); [私域真人人像素材资产使用指南](https://docs.volcengine.com/docs/ark/guide-preview?lang=zh)
- Only successful generations are charged on BytePlus Seedance. — [BytePlus Seedance page](https://www.byteplus.com/en/product/seedance) (as summarized by search)
- **百炼:**
  - Wan 3.0 has a 30 s free quota per resolution, valid 90 days. — [百炼模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)
  - In Singapore, Wan 3.0 has a 30 s free quota and HappyHorse 10 s. — [Model Studio pricing (EN)](https://www.alibabacloud.com/help/en/model-studio/model-pricing)
  - Kling on 百炼 has no free quota. — [Kling API (百炼)](https://help.aliyun.com/zh/model-studio/kling-video-generation-api-reference/)
  - Wan 3.0 preview required application/activation. — videogen `docs/providers/dashscope.md`, citing [Wan 3 guide](https://help.aliyun.com/en/model-studio/wan3-video-generation-guide)
  - Vidu on 百炼 must be activated in the console and works only with a Beijing key. — [百炼 Vidu i2v](https://help.aliyun.com/zh/model-studio/vidu-image-to-video-api-reference)
- **Kling:**
  - API resource packs are bought from the open platform. Video, image and virtual try-on packs are sold separately. — [知乎 (older)](https://zhuanlan.zhihu.com/p/9876888656); [预付费资源包](https://klingai.com/document-api/productBilling/prePaidResourcePackage)
  - Global packs reportedly start at $700 for 5,000 units, valid 180 days (third-party). — [aireiter](https://aireiter.com/blog/kling-api-pricing)
  - Insufficient balance causes rejection before generation. — [Kling SLA](https://kling.ai/document-api/protocols/paidLevelProtocol)
- **MiniMax:** H3 is pay-as-you-go only, since video packs do not support H3. — [视频资源包](https://platform.minimaxi.com/docs/guides/pricing-video)
- **Vidu CN:** ¥500 buys 16,000 credits, valid 1 year. — [Vidu 产品定价](https://platform.vidu.cn/docs/pricing)
- **PixVerse CN:** API plans start at ¥500/month. The free tier allows buying credits for testing at up to 540p. API membership is separate from web membership. — [如何购买API服务](https://docs.platform.pai.video/7029310m0)
- **Tencent 混元生视频:**
  - A free 50-credit pack, valid 1 year, must be claimed in the console. — [免费额度](https://cloud.tencent.com/document/product/1616/82562)
  - Post-paid billing must be enabled manually. — [计费概述](https://cloud.tencent.com/document/product/1616/118994)
- **智谱:** CogVideoX-Flash is free. — [CogVideoX-Flash](https://docs.bigmodel.cn/cn/guide/models/free/cogvideox-flash)

### Inferences
- Videogen's key-onboarding UX for Chinese users should surface these activation gates before the first job, so batches don't fail with billing errors:
  - Ark: "≥¥200 balance or pack".
  - 百炼: "activate model / apply for preview; Beijing key for Vidu/Kling".
  - Tencent: "enable post-paid".
  - MiniMax: "H3 is not covered by packs".
- Videogen already maps `QuotaExceeded` ambiguity on Ark. Similar per-vendor "not activated / insufficient balance" codes will be needed for each new adapter.
- Kling direct and PixVerse direct have high entry costs ($700 packs; ¥500/month). For small users, the 百炼 resale route has no minimum and lower friction, which is another reason to add those vendors via 百炼 first.

### Gaps
- Explicit 实名认证 (real-name) rules for each platform could not be read from official pages: 火山方舟 (personal vs enterprise), 百炼, Kling China, MiniMax CN and Vidu CN. Videogen's notes also mark Ark real-name onboarding as unverified.
- New-account free token quotas for Seedance 2.5 on 火山方舟 are unknown, as is the CNY price of Kling China resource packs.
- Search budget ran out before these could be checked.

---

## 5. Regulatory: 《人工智能生成合成内容标识办法》 and GB 45438-2025 obligations for AI video and for tools/distributors

### Takeaway
Since **2025-09-01**, AI-generated video in China must carry an **explicit label** (a visible prompt at the start of the video and around the playback window) and an **implicit label**: file metadata with the AIGC attribute, provider name or code, and content ID, with watermarks encouraged. Distribution platforms must check metadata and add propagation info. **No organization or individual may maliciously delete, tamper with, forge or conceal labels, or provide tools or services that help others do so.** Provider APIs make the *visible* watermark optional and **off by default**: Ark `watermark` = false, Wan `watermark` = false (wan2.7 docs), Kling `watermark_info`. Ark's *implicit* metadata watermark is a per-endpoint console toggle (Beta). For videogen, the binding implications are:
- never strip or rewrite provider metadata;
- avoid transcoding or concatenation that drops it;
- never offer label-removal features;
- if videogen ever publishes or distributes, or launches as a public service, the 登记 / disclosure regime applies.

### Cited Findings
- 《人工智能生成合成内容标识办法》 was issued on 2025-03-14 by 国家网信办, 工业和信息化部, 公安部 and 国家广播电视总局, effective 2025-09-01. — [CAC 关于印发《人工智能生成合成内容标识办法》的通知](https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm); [新华网](https://www.news.cn/politics/20250314/b7a24028f2924b7681e6ed1bfbd8fade/c.html)
- The mandatory national standard **GB 45438-2025**《网络安全技术 人工智能生成合成内容标识方法》 was issued on 2025-02-28 by 市场监管总局 and 国家标准委, effective 2025-09-01. — [知乎 解读](https://zhuanlan.zhihu.com/p/1891085128140293464); [浙大 GCmark announcement](https://icsr.zju.edu.cn/2025/0317/c70143a3027668/page.htm)
- Definitions: an explicit label is text, sound or graphics perceptible to users. An implicit label is added via technical measures in file data and is not easily perceived. It is split into metadata implicit labels and content implicit labels such as digital watermarks. — [CAC 通知](https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm); [知乎 GB 45438 解读](https://zhuanlan.zhihu.com/p/1891085128140293464)
- **Video explicit label (Art. 4(4)):** providers whose service falls under 深度合成管理规定 Art. 17(1) must add a conspicuous prompt at the **start frame** and at appropriate positions around the playback window. Prompts may also be added at the end or in the middle. — [CAC 通知](https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm); [CAC 答记者问](https://www.cac.gov.cn/2025-03/14/c_1743654685896173.htm)
- Secondary interpretations say the standard requires video text labels at least 5% of the shortest side in height and shown for at least 2 s. This is **not verified against the standard text**. — [腾讯云开发者社区 深度解读](https://cloud.tencent.com/developer/article/2528305); [CSDN 解读](https://blog.csdn.net/gpsjls/article/details/147061696)
- **Implicit metadata (Art. 5):** providers must add implicit labels in file metadata containing the generation/synthesis attribute, the provider name or code, the content ID and other production elements. Digital watermarks are encouraged. — [CAC 通知](https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm)
- GB 45438 metadata elements: 生成合成标签要素, 生成合成服务提供者要素, 内容制作编号要素. — [知乎 GB 45438 解读](https://zhuanlan.zhihu.com/p/1891085128140293464); [comparativeai GB 45438](https://comparativeai.org/zh/rules/china/gb-45438-2025-ai-content-labeling-standard/)
- **Distribution platforms (Art. 6)** must verify file metadata. Where metadata marks AI content, they add a conspicuous prompt. Where there is no metadata but the user declares AI content, they add a "may be AI-generated" prompt. Where neither exists but traces are detected, they may flag the content as suspected AI. In all of these cases they must add propagation elements to the metadata, such as platform name or code and content ID. — [CAC 答记者问](https://www.cac.gov.cn/2025-03/14/c_1743654685896173.htm); [网易 四部门联合印发](https://www.163.com/dy/article/JQKJS15705198UNI.html)
- **Users and everyone else (Art. 10):** users publishing AI content must declare it and use the provider's labeling function. No organization or individual may maliciously delete, tamper with, forge or conceal labels, **nor provide tools or services for others to do so**, nor harm others' rights through improper labeling. — [CAC 答记者问](https://www.cac.gov.cn/2025-03/14/c_1743654685896173.htm); [新华网 答记者问](http://www.news.cn/politics/20250314/a1b951d7fc3145deaa6c0f3410ef5aff/c.html)
- PwC frames the regime as a three-way split of responsibility between service providers, platforms and users. — [PwC 合规解码 PDF (Sep 2025)](https://www.pwccn.com/zh/tmt/method-identifying-synthetic-content-generated-ai-sep2025.pdf)
- **Ark implicit watermark** ("为 AI 生成产物添加隐式水印"):
  - It adds metadata implicit labels to generated video and images. It is in Beta and free for a limited time.
  - It is enabled **per custom inference endpoint (推理点)** in the console. Enabling it requires naming the producer or propagator entity and its unified social credit code.
  - Ark fills `Label` ("1" = AI-generated), `ContentProducer` and `ContentPropagator`. Callers must write `ProduceID` and `PropagateID` themselves.
  - It adds about 4 ms latency.
  — [火山方舟 为 AI 生成产物添加隐式水印](https://docs.volcengine.com/docs/ark/add-invisible-watermark-to-ai-generated-content?lang=zh); [same, 82379/1810470](https://www.volcengine.com/docs/82379/1810470)
- **Ark visible watermark:** `watermark` boolean, default **false**. When true, an "AI生成" mark appears bottom-right. One reseller claims the default is true and that disabling it needs upstream permission, which conflicts with the official docs. — [创建视频生成任务](https://docs.volcengine.com/docs/ark/create-video-generation-task-api)
- **百炼 Wan visible watermark:** the `watermark` parameter has fixed text "AI生成" at bottom-right and defaults to false (wan2.7 t2v docs). The Wan 3.0 guide example sets `watermark: true`. — [万相2.7文生视频API参考](https://help.aliyun.com/zh/model-studio/text-to-video-api-reference); [text-to-video-guide](https://help.aliyun.com/zh/model-studio/text-to-video-guide)
- **Kling:** create requests carry `options.watermark_info`. — [Kling Text to Video](https://kling.ai/document-api/apiReference/model/textToVideo)
- Metadata fragility: open-source tools exist that detect and *remove* GB 45438 AIGC metadata from images and videos, for example "aigc-tag-tool" (macOS, with a disclaimer). Metadata can be edited, compressed away or stripped by platforms on re-share. — [GitHub AIPlayerDayu/aigc-tag-tool](https://github.com/AIPlayerDayu/aigc-tag-tool); [noobclaw: 你删掉的只是显式标识,隐式标识还在文件里](https://noobclaw.com/cn/blog/ai-content-labeling-rules-implicit-2026/)
- **Filing and registration regime:**
  - Applications that call an already-filed model via API with no substantial change go through **登记** at the provincial CAC rather than national **备案**. Review covers the upstream model's filing, the validity of the calling agreement and content-moderation capability.
  - Apps must display the model name and filing/launch number prominently. Only "services with public-opinion attributes or social mobilization capacity" are in scope for filing or registration.
  — [观韬解读](https://www.guantao.com/page4747); [jtn 企业AI备案实务](https://jtn.com/JP/booksdetail.aspx?type=06001&keyid=00000000000000010067&PageUrl=majorbook&Lan=CN)
- Filing stats as of 2026-08-31: 1,112 services filed (备案) and 731 apps or features registered (登记). July–August added 124 filings and 133 registrations. — [中证报 2026-09](https://jnzstatic.cs.com.cn/zzb/htmlInfo/133252.html); [新浪 2026-07-10 (to June 30: 988 / 598)](https://finance.sina.com.cn/roll/2026-07-10/doc-inihinfw3810936.shtml)
- Enforcement: in April 2026 the CAC launched "清朗·整治AI应用乱象", with 应备未备 / 应登未登 (unfiled or unregistered services) as a first-phase priority. A local inspection held that a public-facing app must file or register and rectify. The search engine merged these results, so the exact page for each statement is uncertain; the CAC notice itself was not read. — [jtn 企业AI备案实务](https://jtn.com/JP/booksdetail.aspx?type=06001&keyid=00000000000000010067&PageUrl=majorbook&Lan=CN); [观韬解读](https://www.guantao.com/page4747)

### Inferences
- Videogen is local, BYOK and single-user. Users call each vendor's filed service under their own account, so the vendor is the "service provider" for labeling. Videogen itself most likely does not need 备案/登记 while it stays a local tool rather than a public service. **That position is an inference, not a legal opinion.**
- If a hosted or SaaS version is ever offered, 登记 plus model and filing-number disclosure would plausibly apply.
- Product rules for videogen that follow from Art. 10 and Art. 5:
  - (1) Keep downloaded bytes untouched. Videogen's Ark notes already say "preserve the downloaded bytes and implicit labels; do not transcode".
  - (2) Any future post-processing (concat, trim, upscale, thumbnail extraction, re-mux) must copy through the provider's AIGC metadata. Ideally it should write videogen's own PropagateID/ProduceID-style fields rather than drop them.
  - (3) Never ship "remove watermark / strip metadata" features.
  - (4) Expose the provider `watermark` toggles truthfully. When the visible mark is off, show a reminder that publishing in China requires the user to declare AI content.
- Ark's implicit watermark is an endpoint-level console toggle, while videogen calls Ark by model ID. Outputs fetched by bare model ID therefore may not carry Ark-written AIGC metadata unless the user creates an endpoint with the toggle on. Videogen could support Ark endpoint IDs (`ep-…`) as the model field to let compliance-minded users opt in. Whether model-ID calls get default metadata is unverified.

### Gaps
- The full GB 45438 video specifics could not be read: label size and duration, the exact metadata container and field names for MP4 (box or XMP), and the JSON key names. The standard text should be read from the national standards portal.
- Article 9 is believed to let providers deliver content without explicit labels on user request, if the user agreement sets out the user's labeling duties, with logs kept for at least 6 months. This comes from prior knowledge of the published text and **was not re-verified in this session**.
- Whether 百炼, Kling, MiniMax and Vidu write AIGC metadata into returned MP4s by default is unknown. Visible-watermark defaults for MiniMax (`aigc_watermark`) and Vidu were not verified because the search budget ran out.
- No official statement was found on whether a local client tool counts as a "传播平台" or "服务提供者".

---

## 6. Chinese video model rankings, September–October 2026

### Takeaway
Chinese models dominate both leaderboards that matter:
- **Artificial Analysis (AA):** Alibaba **Wan 3.0 is #1 on the AA text-to-video board** (≈1156 Elo on T2V v2.0), ahead of Utopai X (which is built on MiniMax H3), **Seedance 2.5**, **MiniMax H3** and H3 Max. Wan 3.0 debuted at **#1 in AA video editing**. Google's Gemini Omni Flash has traded the with-audio #1 spot with Wan 3.0.
- **SuperCLUE (Chinese arena, updated 2026-09-18):** **Seedance 2.5** ranks first (small sample), then Seedance 2.0, **可灵 3.0**, Veo 3.1, Wan 2.7, MiniMax H3, HappyHorse 1.0 and PixVerse V6.

### Cited Findings
- AA T2V v2.0 board, crawl date unknown: Wan 3.0 1156±9, Utopai X 1149, Dreamina Seedance 2.5 1143, MiniMax H3 (768p) 1137, MiniMax H3 Max 1130. — [Artificial Analysis T2V leaderboard](https://artificialanalysis.ai/video/leaderboard/text-to-video)
- AA's launch post says Wan 3.0 debuted "#1 in Video Editing with Audio, #2 in Text to Video with Audio, and #5 in Image to Video with Audio". — [Artificial Analysis on X](https://x.com/ArtificialAnlys/status/2095349174799888760)
- Snapshots differ:
  - 2026-09-02 snapshot: Gemini Omni Flash 1238 vs Wan 3.0 1237 (T2V with audio).
  - A later snapshot: Gemini Omni Flash 1233 vs Wan 3.0 1229.
  - An early-October roundup has Wan 3.0 #1 both with audio (1,157) and without (1,128).
  - MiniMax H3 is reported as the highest-rated open-weights model (1220).
  These are third-party roundups. — [teamday Sept 2026](https://www.teamday.ai/blog/best-ai-video-models-2026); [buildmvpfast Sept 2026](https://www.buildmvpfast.com/articles/best-llms-2026-guide/video-generation-ai); [felloai Oct 2026](https://felloai.com/best-ai-models/)
- AA rebuilt AA-Video to rank models on real-world jobs. — [AlphaSignal](https://alphasignal.ai/news/artificial-analysis-rebuilds-aa-video-to-rank-models-by-real-world-jobs)
- AA also has an image-to-video board. — [AA I2V leaderboard](https://artificialanalysis.ai/video/leaderboard/image-to-video)
- Arena (arena.ai, a separate leaderboard) had Google's Gemini Omni 1.1 Flash first in its 2026-09-21 snapshot. — [Arena text-to-video](https://arena.ai/leaderboard/text-to-video)
- Utopai X controversy: Chinese media questioned its leaderboard debut as an "乌龙" (a mix-up) and doubted the value of a post-trained model. It is reported as built via MiniMax H3. — [虎嗅](https://www.huxiu.com/article/4895639.html); [搜狐 谁在捧杀Utopai X](https://www.sohu.com/a/1084798322_116132); [OrcaRouter](https://www.orcarouter.ai/blog/utopai-x-debut)
- SuperCLUE 文生视频竞技场 (25 models, 61,431 battles, data updated 2026-09-18):

  | Rank | Model | Score | Note |
  |---|---|---|---|
  | 1 | ByteDance Seedance 2.5 [720p] | 1297.3 | only 311 battles; CI +92.7/−90.2 |
  | 2 | Seedance 2.0 [720p] | 1261.6 | 5,650 battles |
  | 3 | 可灵 3.0 [720p] | 1193.4 | |
  | 4 | Google Veo 3.1 | 1179.7 | |
  | 5 | Alibaba Wan 2.7 [1080p] | 1154.2 | |
  | 6 | MiniMax H3 [768p] | 1138.3 | only 309 battles |
  | 7 | HappyHorse-1.0 | 1114.1 | |
  | 8 | veo-3.0 | 1090.1 | |
  | 9 | PixVerse V6 | 1083.6 | |
  | 10 | Luma Ray 3 | 1054.9 | |

  — [SuperCLUE video arena](https://superclueai.com/arena?tab=board&type=video)
- The older SuperCLUE-I2V benchmark (2025-04-22) had 可灵 2.0 first at 66.63. — [SuperCLUE 图生视频首期榜单](https://mp.weixin.qq.com/s/LJTmNlFQ4pUlUMBRs3J1SA)

### Inferences
- Videogen's direct providers already include the AA #1 model (Wan 3.0) and the SuperCLUE #1 model (Seedance 2.5). The highest-ranked Chinese models it lacks direct access to are **可灵 3.0** (SuperCLUE #3) and **MiniMax H3** (AA top-5; best open-weights model).
- Wan 3.0 does not appear in the SuperCLUE 2026-09-18 top 10, probably because it was added too recently. Chinese-user perception, via SuperCLUE, favors Seedance and Kling, while the global AA board favors Wan 3.0. Videogen's Chinese README could cite both.
- Kling 4.0 (October 2026) may reshuffle these boards, but its API is not yet available.

### Gaps
- The live AA page could not be loaded, so exact current Elo values and the separate with-audio, without-audio and I2V standings for Chinese models are unconfirmed.
- No dedicated "September 2026" SuperCLUE video report was found; the arena page is the closest.
- Vidu Q3's ranking on either board was not found in the extracts.
