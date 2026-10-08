# 先补参考图与信任，再接短剧与 Agent 管线

videogen 下一步最该做的不是继续加厂商，而是先完成五件 P0，让它有机会被用户选中：多参考图（主体一致性）第一阶段、带真实样片与可验证构建的发布准备、修正火山方舟 Seedance 2.5 国内价格、为每条成片写旁挂元数据并导出批次清单、支持用环境变量注入密钥。之后在 P1 把短剧工作流的两端接通：下游导出剪映草稿/FCPXML，上游提供 CLI 与本地 MCP；同时补上抽卡上限与按模型良率统计、百炼转售的可灵/Vidu/PixVerse、Windows 签名与 macOS 公证。这样排序有三条依据。**第一，模型覆盖已不是瓶颈。** 通过直连或 OpenRouter，videogen 已能调用除 Vidu 外所有提供公开 API 的头部模型，但它只支持首尾帧，而多参考图已是 Seedance 2.5、Wan 3.0、Kling 3.0、MiniMax H3、Veo 3.1、Grok 1.5 的标准能力。**第二，最可量化的大批量用户是国内 AI 短剧/漫剧团队。** 2026 年上半年抖音上线约 22.19 万部，可用镜头接受率约两成；这类团队的头号痛点是"角色变脸"，交付习惯是"外部生成、剪映精修"。**第三，videogen 的批量记账组合目前对外不可见。** 逐行估价、批次预算、每保留片段成本、崩溃可恢复的分通道队列，加上 MIT 许可，这套组合在调研覆盖的开源与商业工具中找不到同类；但仓库 0 星，README 首屏是离线 mock 录屏。P0 粗估 4–6 周，现金投入只有十美元量级的样片费用，全部可以在零 npm 依赖、无遥测的原则下实现。明确不建议做的事包括：托管积分/SaaS、Webhook 接收端、厂商批量折扣通道、去水印或会丢失 AIGC 元数据的转码拼接、遥测与自动更新检查、Electron 重写，以及自动化 Flow/即梦等消费者账号。

## 独有的批量记账被三项基线缺口和零曝光掩盖

videogen v2.1.0 的核心能力已经很完整：CSV/模板一次最多导入 **1,000 行**，每行可单独覆盖模型、时长与首尾帧；按"厂商 + 区域 + Base URL"分通道限流；可以按估价设批次预算；画廊里标记保留或淘汰后，会显示每条保留片段的估算成本；创建结果不明的任务进入 `needs_review`，绝不自动重提；下载时保留厂商的原始字节和元数据（README、docs/BATCH_IMPORT.md，代码库核查 2026-10-08）。竞品调研里没有一个项目同时具备这些能力。ArcReel 能"在生成前后查看费用与实际用量"，但采用 AGPL、只支持 Docker，也没有预算功能（[ArcReel](https://github.com/ArcReel/ArcReel)）。moyin-creator 有并行队列、自动重试和密钥轮换，但同为 AGPL，且只支持 Windows（[moyin-creator](https://github.com/MemeCalculate/moyin-creator)）。与 videogen 同为 Node 技术栈、同为 MIT 的 LocalMiniDrama 没有成本追踪（[LocalMiniDrama](https://github.com/xuanyustudio/LocalMiniDrama)）。宣传口径最接近的 Nomi（"本地优先、无账号、无遥测"）没有批量队列和成本功能，并已改为 AGPL-3.0（[Nomi](https://github.com/aqm857886159/Nomi)）。别处的表格驱动批量生成只有需要自行拼装的 n8n 模板（[n8n 模板 14549](https://n8n.io/workflows/14549-generate-bulk-veo-3-videos-from-google-sheets-via-vertex-ai/)）。最接近的竞品大多是 AGPL 或非商用许可，huobao-drama 就是 CC BY-NC-SA（[huobao-drama](https://github.com/chatfire-AI/huobao-drama)）。对想嵌入或二次开发的代理商和工作室来说，**MIT 是实打实的差异**。

短板同样清楚。2026 年 10 月，一款严肃的视频生产工具，基线已经包括参考图与角色一致性、生成前显示成本，以及至少基本的成片交接：拼接、或导出到剪辑软件和剪映草稿（[ArcReel](https://github.com/ArcReel/ArcReel)；[Higgsfield 定价分析](https://voyager.so/blog/higgsfield-pricing)）。MCP 和 CLI 也已从新奇功能变成预期配置（[OpenArt MCP & CLI](https://openart.ai/mcp/)；[即梦 CLI](https://toolin.ai/blog/jimeng-cli-seedance-agent)）。videogen 有多模型、带重试的队列、首尾帧和事前估价，**但缺参考图、缺成片交接，也没有任何无头入口**。现状是：OpenRouter 适配器只发送 `frame_images`；输出只有原始 mp4；只有浏览器 UI 和要求同源 Origin 的本机 HTTP API（代码库核查 2026-10-08）。曝光层面，仓库 0 星、0 issue、Discussions 关闭、没有官网（代码库核查 2026-10-08）。同期以"一句话生成完整短剧"为卖点的 Toonflow 和 huobao-drama 分别有 **16,643 和 15,838 星**（[Toonflow](https://github.com/HBAI-Ltd/Toonflow-app)；[huobao-drama](https://github.com/chatfire-AI/huobao-drama)）。Release 下载数为 0 要放在语境里看：v2.1.0 当天才发布，零下载说明尚未推广，不代表市场拒绝。不过约四分之三的开发者在使用或贡献前会参考 star 数（[arXiv 1811.07643](https://arxiv.org/abs/1811.07643v1)），"零星"本身就是采用门槛。

缺口的轻重，取决于谁在大批量生成视频。**国内 AI 短剧/漫剧是唯一能量化的超大批量用户群**。DataEye 数据显示，2026 年上半年抖音上线约 22.19 万部 AI 剧/漫剧，只有约 1.3% 回本（[澎湃](https://m.thepaper.cn/newsDetail_forward_33665132)）。一个约 10 人的团队里，大约一半人专职"抽卡"，自研模型的接受率约 20%。熟练抽卡师每个 5 秒镜头约需 4 条，普通抽卡师约需 10 条；超过上限就要升级处理，甚至改剧本（[华人故事](https://www.ourchinastory.com/cn/17257)）。以 Seedance 2.0 720p 约 ¥1/秒计，一部 100 分钟的作品如果每个镜头抽 3–5 次，算力就要 **¥1.8–3 万**（[腾讯新闻](https://view.inews.qq.com/a/20260902A08U3500)）。他们的流程是剧本 → 分镜 → 逐镜头生成 → 剪辑，与 videogen 的 CSV 镜头表、逐行首尾帧和保留/淘汰几乎一一对应。下表给出各类用户群，后文用字母代号指代。

| 代号 | 用户群 | 规模与行为证据 | 契合 videogen 之处 | 当前阻碍 |
|---|---|---|---|---|
| A | 国内 AI 短剧/漫剧工作室（抽卡团队） | 半年约 22.19 万部；接受率约 20%；"角色变脸"居痛点首位 | CSV 镜头表、逐行首尾帧、保留/淘汰、每保留成本、国产模型直连 | 无参考图/角色库、无剪映导出、无抽卡上限、Seedance 国内价缺失 |
| B | 效果广告与电商素材代理、技术型投手 | 约三分之二美国视频广告买家已用 GenAI 做素材（[ivristech 转述 IAB](https://ivristech.com/iab-one-third-video-ad-assets-genai/)）；超过 800 万 Meta 广告主使用其 GenAI 工具（[PPC Land](https://ppc.land/meta-q1-2026-56-3b-revenue-as-ai-tools-double-advertiser-adoption/)） | 模板变量批量变体、预算、按次付费 | 无可交付的命名元数据与清单、产品一致性靠参考图 |
| C | 开发者型创作者与 Agent 用户 | OpenMontage 约半年 6.5 万星，hypit 约十周 2 万星（[OpenMontage](https://github.com/calesthio/OpenMontage)；[hypit](https://github.com/hypit-ai/hypit)） | 崩溃可恢复队列加预算，正是 Agent 渲染后端所需 | 无 CLI/MCP/无头令牌；每次重启都要手输密钥 |
| D | 本地 GPU 与隐私敏感用户 | RTX 4090 上 Wan 2.2 生成 5 秒 720p 约需 2 分 40 秒（[bestgpuforai](https://bestgpuforai.com/articles/rtx-5090-vs-4090-for-video-gen/)） | 串行化、崩溃安全的队列 | 无 ComfyUI 适配器；OpenAI 兼容路径固定为 `/v1/videos` |
| E | 非开发者创作者（只会双击） | Fooocus 的便携 7z 包拿到 5.3 万星（[PCWorld](https://www.pcworld.com/article/2253285/fooocus-is-the-easiest-way-to-run-ai-art-on-your-pc.html)） | 免安装 ZIP、四语界面 | 未签名，被 Gatekeeper/SmartScreen 拦截，启动会弹出终端窗口 |

有三类人不值得优先服务。第一类是数字人口播与培训视频：请求形态是脚本、声音和形象，与镜头批量生成是两条产品轴，且已由 Synthesia、HeyGen 主导（[Synthesia](https://www.synthesia.io/post/synthesia-global-expansion-austin-berlin-paris-zurich-2026)）。第二类是无脸内容农场：YouTube 把"重复或量产"内容判为不可变现，并在 2026 年 1 月删除了 16 个合计约 3,500 万订阅的频道（[Flocker](https://flocker.tv/posts/youtube-inauthentic-content-ai-enforcement/)）。第三类是 Veo 的重度个人用户：按积分折算，Flow Ultra 生成 Veo 3.1 Fast 每秒约 $0.0125，**比 API 便宜约 8 倍**（[CostGoat](https://costgoat.com/pricing/google-flow)）。相反，"不限量"套餐的幻灭为 BYOK 按次付费提供了现成的宣传角度：Higgsfield"Unlimited"用户反映要等上数天（[WION](https://www.wionews.com/world/is-unlimited-a-scam-higgsfield-is-making-customers-wait-for-days-to-generate-even-1-video-1787006158862)），即梦会员到期后积分清零（[黑猫投诉](https://tousu.sina.com.cn/complaint/view/17399087232?sld=bb62a1249f398fcba624a2e08677e30b)）。Menlo 的调查显示，视频是使用率最低的创作类别（44%），支出集中在每月付费 100 美元以上的少数用户（[Menlo Ventures](https://menlovc.com/perspective/2026-the-state-of-consumer-ai/)）。这也说明 videogen 应面向重度用户和工作室，而不是大众消费者。

## 头部模型多为国产，价格降了五到七倍，计费单位却越来越碎

两大榜单的头部只有少数国际模型，其余几乎都是国产。名次每周都在变，置信区间内的分数应视为并列。

| 模型 | 排名信号 | videogen 现状（代码库核查 2026-10-08） |
|---|---|---|
| Gemini Omni 1.1 Flash | Arena 文生视频第 1，1516（2026-09-21，[Arena](https://arena.ai/leaderboard/text-to-video)） | Gemini 直连；只有 720p 价格已核实 |
| Wan 3.0 | AA 文生视频第 1，1156（[Artificial Analysis](https://artificialanalysis.ai/video/leaderboard/text-to-video)） | 百炼直连，也可经 OpenRouter |
| Seedance 2.5 | SuperCLUE 第 1（仅 311 场对战）；AA 第 3，1143（[SuperCLUE](https://superclueai.com/arena?tab=board&type=video)） | 方舟/BytePlus 直连（国内价为 null），也可经 OpenRouter |
| MiniMax H3 | AA 第 4，1137；开放权重中最强 | 仅经 OpenRouter |
| FLUX 3 Video、Grok Imagine Video 1.5 | Arena 第 3、第 4（1493、1492） | 仅经 OpenRouter |
| 可灵 Kling 3.0 | SuperCLUE 第 3 | 仅经 OpenRouter |
| Vidu Q4 Preview / Q3 | AA 图生视频第 3（[AA I2V](https://artificialanalysis.ai/video/leaderboard/image-to-video)） | 未接入 |
| Veo 3.1 / Lite | AA 约第 14；Lite 进入 OpenRouter 周用量前三（[OpenRouter](https://openrouter.ai/collections/video-models)） | 仅经 OpenRouter；Lite 的默认时长有缺陷 |

结论是：**问题在能力，不在覆盖**。OpenRouter 目录快照已收录 flux-3-video、grok-imagine-video-1.5、kling-v3.0、hailuo-3 和 veo-3.1 全系（代码库核查 2026-10-08），能力却停留在首尾帧。多参考图已是基线能力：Seedance 2.5 在方舟上列出"全模态参考生视频、参考生视频、编辑视频、延长视频、首尾帧"（[火山方舟模型列表](https://docs.volcengine.com/docs/82379/1587798)）；Wan 3.0 用一个模型 ID 同时支持文生、图生和参考生，媒体类型包括 `first_frame`、`reference_image`、`reference_video` 和 `file`（[万相 3.0 API 参考](https://help.aliyun.com/zh/model-studio/wan3-video-generation-api-reference)）；MiniMax H3 最多接受 9 张参考图（[MiniMax 创建任务](https://platform.minimaxi.com/docs/api-reference/video-generation-v2-create)），Veo 3.1 最多 3 张（[Gemini API Veo](https://ai.google.dev/gemini-api/docs/veo)）；Gemini Omni 通过 Files API 上传参考，并在提示词里用 `<IMAGE_REF_0>` 指代（[Gemini Omni 文档](https://ai.google.dev/gemini-api/docs/omni)）。OpenRouter 的统一 schema 里，`input_references` 与 `frame_images` 条目结构相同，只是少了 `frame_type`；两者同时出现时 `frame_images` 优先（[OpenRouter 视频文档](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)）。延长、编辑和"草稿→放大"也在扩散：FLUX 3 有 $0.06/秒的草稿档和 Draft Enhance（[BFL](https://bfl.ai/models/flux-3-video)）；MiniMax 768P→2K 再生成收费 ¥0.30/秒（[MiniMax 按量计费](https://platform.minimaxi.com/docs/guides/pricing-paygo)）。

价格层面，头部质量 720p 的价格从 2025 年年中 Veo 3 的 **$0.75/秒**（同年 9 月降到 $0.40，[Google Developers Blog](https://developers.googleblog.com/veo-3-and-veo-3-fast-new-pricing-new-configurations-and-better-resolution/)）降到 2026 年三季度 Gemini Omni Flash 的约 **$0.10/秒**（[eesel](https://www.eesel.ai/blog/gemini-omni-flash-pricing)）和 Grok 1.5 的 $0.14/秒（[xAI 文档](https://docs.x.ai/developers/models/grok-imagine-video-1.5)），约 15 个月降了五到七倍。但价差和计费单位都在扩大。同样是 10 秒 1080p 带音频的片段，不同模型价格从 $0.60 到 $7.91，相差 **13 倍**（[Hedra](https://www.hedra.com/blog/video-model-api-cost-comparison)）；官方价最低与最高相差 35 倍，计费单位有按秒、积分、token、按条、按输入计量五种（[invideo](https://invideo.io/blog/ai-video-model-pricing/)）。"选哪家、抽几次"对每分钟成片成本的影响，已经超过单价本身。

国内直连通道的价格正是 videogen 缺的那块。Seedance 2.5 在方舟按 token 计费：无视频输入 ¥70/百万 token，有视频输入 ¥42/百万（[火山方舟](https://www.volcengine.com/product/ark)），折合 480p 约 ¥0.67/秒、720p 约 ¥1.51/秒。Wan 3.0 北京区为 ¥0.3/0.6/1.2 每秒（[百炼模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)）。更重要的是，**百炼已在同一个 DashScope 密钥和异步协议下转售可灵 v3/v3-omni、Vidu Q3 和 PixVerse**（[百炼视频生成目录](https://help.aliyun.com/zh/model-studio/video-generation-api/)），其中第三方模型仅限北京区。直连这些厂商门槛很高：可灵海外资源包据第三方报道起步价 700 美元（[aireiter](https://aireiter.com/blog/kling-api-pricing)），PixVerse API 套餐每月 ¥500 起（[拍我AI 开放平台](https://docs.platform.pai.video/7029310m0)）。

运维层面的事实，印证了 videogen"轮询 + 立即下载 + `needs_review`"的设计是对的，也说明有几样东西不必做。旗舰视频模型几乎没有批量折扣：方舟 `flex` 半价不支持 Seedance 2.x（[火山方舟教程](https://docs.volcengine.com/docs/ark/video-generation-tutorial?lang=zh)），Omni Flash 也没有 Batch 折扣（[eesel](https://www.eesel.ai/blog/gemini-omni-flash-pricing)）。结果保留期很短：方舟视频 URL 只有 24 小时，Seedance 2.5 最多下载 100 次（[方舟查询任务](https://docs.volcengine.com/docs/ark/get-video-generation-task-api?lang=zh)）；Runway 只有 24–48 小时（[Runway](https://docs.dev.runwayml.com/assets/outputs/)）。回调要求公网 HTTPS，而第一方 API 几乎都没有幂等键。厂商随时可能退场：OpenAI 于 2026-09-24 下线了整个 Videos API，且没有替代品（[The Decoder](https://the-decoder.com/openai-sets-two-stage-sora-shutdown-with-app-closing-april-2026-and-api-following-in-september/)）。这让多厂商切换加上带完整上下文的本地档案成了刚需。

## 十九项事项分三档，P0 五项决定 videogen 能否被用起来

成本按单人维护者熟悉代码库的情况粗估：小为 3 人日以内，中为 1–3 周，大为 3 周以上。价值按"对核心用户群的影响 × 证据强度"判断。最后一列逐项说明与 CONTRIBUTING.md 中"零 npm 依赖、无遥测、无更新检查、无项目自营云服务"原则的关系。

| 编号 | 事项 | 主要面向 | 预计价值 | 成本（粗估） | 主要风险 | 与零依赖/无遥测原则 |
|---|---|---|---|---|---|---|
| P0-1 | 多参考图第一阶段：OpenRouter `input_references`、Wan 3 `reference_image`、CSV 参考图列 | A、B | 高 | 中（2–3 周） | data URL 可能不被接受；角色互斥被静默忽略 | 兼容 |
| P0-2 | 发布准备：真实样片、构建证明、私密漏洞报告、Discussions、中文首发 | 全部，尤其 E | 高 | 小，另需少量 API 费 | 参考图上线前大推，会被拿去和"一句话成片"工具比 | 兼容；用下载数代替遥测 |
| P0-3 | 价目与目录修正：Seedance 2.5 国内价、Veo 3.1 Lite 默认时长 | A；OpenRouter 用户 | 高（性价比最高） | 小（≤1 人日） | 1080p 价格与最低计费未直接读到 | 兼容 |
| P0-4 | 旁挂元数据与批次清单导出 | B、A、C | 中高，是多项功能的底座 | 小（3–5 人日） | 不能替代嵌入式标识；提示词隐私 | 兼容；不改 mp4 字节 |
| P0-5 | 用环境变量注入密钥 | C、D、A | 中高 | 小（2–3 人日） | 环境变量的泄露面 | 兼容；密钥仍不落盘 |
| P1-1 | 剪映草稿与 FCPXML 导出（可选"AI 生成"文字轨） | A、B | 高 | 中（2–3 周） | 剪映草稿格式非官方，随版本变化 | 兼容；不引入 ffmpeg |
| P1-2 | CLI + 本地 stdio MCP + 无头令牌 | C、A | 高 | 中至大（3–4 周） | 本地攻击面；Agent 重试导致重复计费 | 兼容；用 Node 内置模块实现 |
| P1-3 | 抽卡工作流：每行变体数、镜头上限、按模型统计良率与失败率 | A、B | 高 | 小至中（1–2 周） | 花费成 N 倍增长 | 兼容；统计只存本地 |
| P1-4 | 参考图第二阶段与角色/资产库：Seedance 2.5 全模态、Omni、`@角色` | A、B | 高 | 中至大 | 方舟真人人像限制；上传文件的生命周期 | 兼容 |
| P1-5 | 百炼转售的可灵 v3/Omni、Vidu Q3、PixVerse | A | 中高 | 中 | 字段是否与直连对等未核实；仅北京区 | 兼容 |
| P1-6 | Windows SignPath 签名，macOS 公证启动器 | E | 中高 | 中，另需 99 美元/年 | 新签名文件的信誉仍从零开始 | 兼容（启动器不是 npm 依赖） |
| P1-7 | 合规开关：可见水印、方舟推理接入点 ID、发布提醒 | A、B | 中 | 小（≤1 周） | 法律定性不确定 | 兼容 |
| P2-1 | 延长、编辑、放大与"草稿转精" | A、B | 中 | 大 | 新任务类型与新计价维度 | 兼容 |
| P2-2 | 可配置的 OpenAI 兼容适配器、ComfyUI 适配器、模型许可提示 | D | 中 | 前者小，后者中至大 | 开放权重许可有地域限制 | 兼容 |
| P2-3 | fal / Replicate 适配器 | C | 低至中 | 中 | 每个模型的 schema 都不同 | 兼容 |
| P2-4 | 直连 xAI、BFL、MiniMax、可灵 | A、C | 低至中 | 每家中 | 维护面扩大 | 兼容 |
| P2-5 | 模型对比视图 | 全部 | 中（获客） | 小 | 低 | 兼容 |
| P2-6 | OpenRouter 应用归因（默认关闭）、厂商文档收录、公开披露的返利链接 | 项目自身 | 当前低 | 小 | 隐私承诺 | 需披露，可关闭 |
| P2-7 | 系统钥匙串（可选） | C、D | 低至中 | 中 | 跨平台差异；改变"密钥不落盘"的说法 | 兼容（调用系统工具） |

建议的执行顺序如下。第 1 周做完 P0-3，以及 P0-2 中的构建证明、私密漏洞报告、Discussions 和 Issue 模板。第 2–4 周做 P0-1，开工前先花几美分验证 data URL，再做 P0-4 和 P0-5。第 5–6 周用参考图拍真实样片和跨厂商对比，然后安排中文渠道首发周。第 7–12 周按 P1-1、P1-2、P1-3 的顺序推进，再做 P1-4 和 P1-5，P1-6 和 P1-7 穿插进行。P2 等 Discussions 里出现需求信号再挑。

### P0-1 多参考图第一阶段：一个字段解锁多家参考生视频

**理由与证据。** 在国内 AI 短剧创作者调研中，"角色变脸"被列为头号问题，两份调研的比例分别为 76% 和 67%，但调研方法未公开（[搜狐](https://www.sohu.com/a/1032100492_122638820)）。漫剧工具测评把三个问题列为核心痛点：跨集的角色/场景漂移、多集素材不同步、批量任务难管理（[IT之家](https://www.ithome.com/1/005/809.htm)）。一项 arXiv 管线实验中，去掉角色锚定图后，一致性评分从 **7.99 跌到 0.55**（[arXiv 2512.16954](https://arxiv.org/html/2512.16954v1)）。几乎所有短剧开源工具都把参考图当作头条功能，例如 huobao-drama 的 `@character` 和 LocalMiniDrama 的 `@图片N`（[huobao-drama](https://github.com/chatfire-AI/huobao-drama)；[LocalMiniDrama](https://github.com/xuanyustudio/LocalMiniDrama)）。第一阶段只走两条最便宜的路。一是 OpenRouter 的 `input_references`：一个字段就能打开 Veo、Seedance、Kling、Grok 等多家的参考生视频（[OpenRouter 参考生视频 cookbook](https://openrouter.ai/docs/projects/docs/cookbook/video-generation/reference-to-video)）。二是在 Wan 3 现有的 `input.media` 结构里加入 `reference_image`。CSV 新增 `ref_image_1..n` 列，沿用现有的图片文件夹匹配。**面向**：A、B。对广告和电商来说，这意味着同一产品、同一模特能在多条素材里保持一致。**预计价值**：高。补上它，基线能力就不再缺一块；同时能直接减少因一致性失败而重抽的花费。

**成本与风险。** 成本中等，需要两家的请求映射、逐模型的校验规则、UI 的多图输入和估价扩展。风险有三处。其一，有第三方集成报告称，`input_references` 只接受公开 HTTPS URL（[NodeTool PR #5946](https://github.com/nodetool-ai/nodetool/pull/5946)），而 videogen 的本地首帧走的是 base64 data URL（README）。如果 data URL 行不通，就只对接受内联或上传的厂商开放，绝不能由项目来托管图片；范围要在验证后再定。其二是角色互斥：两个字段同时出现时 `frame_images` 优先，参考图会被静默丢弃；Wan 3 的首尾帧模式不能与音频或其他媒体组合（[千问AI平台 FAQ](https://www.qianwenai.com/models/wan3.0-video)）；MiniMax H3 的帧角色与参考角色互斥（[MiniMax](https://platform.minimaxi.com/docs/api-reference/video-generation-v2-create)）。这些组合必须在提交前拦下来。其三是计价：OpenRouter 上 H3 超过前 5 张参考图后，每张加收 $0.04（[OpenRouter H3](https://openrouter.ai/minimax/hailuo-3)），估价需要增加参考图维度。**原则**：只用 Node 内置能力，与零依赖原则兼容。

### P0-2 发布准备：用真实样片和可验证构建换取第一批用户

**理由与证据。** 突围的同类项目都是靠真实产出传播的。Toonflow 上了少数派的报道，B站有"12 分钟快速上手"视频（[少数派](https://sspai.com/post/108900)；[B站](https://www.bilibili.com/video/BV1FsZDBHExJ/)）；Jellyfish 被报道"一周狂揽 1.7K+ Star"（[人人都是产品经理](https://www.woshipm.com/ai/6362694.html)）。videogen 的首屏却是离线 mock 录屏（代码库核查 2026-10-08）。信任层面的威胁很具体：2026 年 8 月起，攻击者克隆 AI 和 ComfyUI 仓库，用"ZIP + 批处理脚本"分发窃取 API 密钥的木马（[Cybersecurity News](https://cybersecuritynews.com/?p=67372)），外观与 videogen 未签名 ZIP 加 `.cmd`/`.command` 启动器一模一样。GitHub 构建证明对公开仓库免费，用户可以用 `gh attestation verify` 自行校验（[GitHub Docs](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)）；而 videogen 的 CI 目前没有证明或签名步骤（代码库核查 2026-10-08）。

**具体动作。** 共五步。第一，在 CI 中加入 `actions/attest-build-provenance`，README 写明校验命令，并声明唯一的官方下载地址是 GitHub Releases。第二，打开 GitHub 私密漏洞报告、Discussions 和 Issue 模板。第三，利用 CSV 现有的逐行模型覆盖，让同一张镜头表分别跑 Seedance 2.5、Wan 3.0、Gemini Omni 和 Veo 3.1 Lite，公开每条成片、单条成本和耗时；按本文引用的价格，十余条 5 秒 720p 片段约需十美元量级（粗估）。第四，README 首屏改写为"自带密钥、按次付费的分镜批量渲染与成本账本"，把"不排队、积分不清零"写成卖点。第五是首发顺序：等 P0-1 上线后，先安排中文渠道同周推送，包括 B站快速上手视频、少数派/掘金、V2EX「分享创造」，以及阮一峰周刊和 HelloGitHub 的自荐（[掘金](https://juejin.cn/post/7355845238907486271)；[HelloGitHub](https://hellogithub.com/en/periodical)；[V2EX](https://v2ex.com/t/1184674)）。然后在工作日美国上午发 HN。r/selfhosted 对不满 3 个月的项目只允许周五发帖（[r/selfhosted 规则](https://redlib.groet-infra.nl/r/selfhosted/comments/1rmt39o/rules_update_new_project_friday_here_to_stay/)）；videogen 仓库已超过 3 个月，但首次公开发布就在当天，稳妥起见仍选周五。

一次 HN 曝光平均一周带来约 **289 星**（[arXiv 2511.04453](https://arxiv.org/abs/2511.04453v1)），而上 GitHub Trending 当天通常需要数百到上千星，AionUi 上榜那几天分别是 +660 和 +1,192（[byteiota](https://byteiota.com/tag/aionui/)）。所以只能靠多渠道同周叠加，单靠 HN 上不了榜。**面向**：所有用户，尤其 E 和 A。**预计价值**：高。没有用户，其余改进都得不到反馈。**成本与风险**：证明与渠道配置约 1–2 人日，加上少量 API 费用和内容制作时间。最大的风险是在参考图上线前就大推，会被直接拿去和 Toonflow 等"一句话成片"工具比较，所以信任信号立即做，大推等到 P0-1 完成。r/StableDiffusion 要求帖子涉及本地或开源生成，调用云 API 的工具可能离题（[规则存档](https://gwern.net/doc/www/old.reddit.com/d385becd7297273fb9cc4e57f0333bb0197d4162.html)）。**原则**：完全兼容。Pinokio 单个版本首周安装包下载 31,832 次（[Pinokio 指南](https://pasqualepillitteri.it/en/news/9050/pinokio-ai-browser-install-guide)），说明公开的 Release 下载数本身就能代替遥测，充当使用信号。

### P0-3 价目与目录修正：让国内 Seedance 2.5 用户能设预算

**理由与证据。** Seedance 2.5 是 SuperCLUE 中文竞技场第一，但 videogen 目录里它的方舟国内价是 null，估价只能显示"未知"，也就无法设预算（代码库核查 2026-10-08），而预算恰恰是 videogen 的招牌功能。官方价格是 ¥70/百万 token（无视频输入）和 ¥42/百万 token（有视频输入）。token 数约等于时长 × 宽 × 高 × 24 / 1024，由此算出 720p 约 ¥1.51/秒，与媒体报道一致（[AITOP100](https://www.aitop100.cn/infomation/details/34378.html)）。1080p 的 ¥77/百万（约 ¥3.74/秒）有两个独立信号佐证：价目页的索引摘录，和媒体报道的"3.7 元/秒"（[雷锋网](https://www.leiphone.com/category/industrynews/xvsvCI7gPqM0YzFJ.html)）；但未能直接读到价目页正文。另外，`google/veo-3.1-lite` 的时长数组是未排序的 [8,4,6]，默认会选中单条最贵的 8 秒档（代码库核查 2026-10-08），而该模型支持 4、6、8 秒（[AI Studio](https://aistudio.google.com/models/veo-3)）。

**做法。** 在内置目录中写入 {480p: 70, 720p: 70, 1080p: 77} 元/百万 token，以及有视频输入时的 42 元/百万，并标注"待控制台核实"。Veo 3.1 Lite 的时长数组排序后，默认选最短档。Gemini Omni 的非 720p 价格只有单一第三方来源（[eesel](https://www.eesel.ai/blog/gemini-omni-1-1-flash-pricing)），继续保持"未知"，文档引导用户用现有的 `catalog.local.json` 自行覆盖。**面向**：A，以及所有 OpenRouter 用户。**预计价值**：高，成本极低。**成本与风险**：不到 1 人日。有视频输入时存在最低计费 token 下限，具体值未知（[火山方舟模型价格](https://www.volcengine.com/docs/82379/1099320)）。Seedance 2.5 文档还提到，会先按 480p 生成样片并计费，再按目标分辨率计费（[Seedance 2.5 教程](https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh)）；这一步是否在所有模式下都发生尚未核实。如果都发生，估价会每秒少算约 ¥0.67，UI 应标为"可能另计"。**原则**：兼容。

### P0-4 旁挂元数据与批次清单：每条成片可复现、可交接、可声明

**理由与证据。** 代理商希望像管理源代码一样管理提示词模板，为每个任务记录模板版本、模型设置、源素材和输出 ID（[Wireflow](https://www.wireflow.ai/blog/video-content-automation-for-agency-clients)）。结果 URL 只活一天左右，厂商还可能整体下线，本地档案必须自带上下文。GB 45438 要求的隐式标识元素包括生成合成标签、服务提供者和内容制作编号（[知乎解读](https://zhuanlan.zhihu.com/p/1891085128140293464)）。videogen 目前只写原始 mp4，文件名强制为 .mp4，没有旁挂文件，也不能导出清单（代码库核查 2026-10-08）。

**做法。** 每条输出旁边写一个同名的 `.videogen.json`，内容包括：提示词与模板变量、厂商/区域/模型、各项参数、种子、远端任务 ID、估算成本与币种、时间戳、保留/淘汰状态、"AI 生成"标记和服务提供者名称。另外提供批次级的 CSV/JSON 清单导出。**绝不改写 mp4 字节**。现有做法是保留厂商字节与元数据、不转码（PRIVACY.md，代码库核查 2026-10-08），这本身就符合《标识办法》的要求。**面向**：B（复现与交付）、A（交接与合规留痕）、C（Agent 读取结果）。**预计价值**：中高。它是 P1-1 剪映导出、P1-2 的 fetch 工具和 P1-3 良率统计共用的数据底座。**成本与风险**：3–5 人日。文档需要讲清，旁挂 JSON 不是嵌入式隐式标识，不能替代厂商写入的元数据。提示词可能含敏感内容，PRIVACY.md 需说明它会和视频放在同一目录。**原则**：兼容。

### P0-5 用环境变量注入密钥：让崩溃恢复真正无人值守

**理由与证据。** 密钥只存在内存里，每次服务重启都要在网页上逐个通道重新输入，否则已知的远端任务无法恢复轮询和下载（代码库核查 2026-10-08；README）。这削弱了崩溃可恢复队列的价值：过夜批量一旦重启，就会停在等密钥。本地 GPU 每条要 1–5 分钟，长片段还会 OOM（[bestgpuforai](https://bestgpuforai.com/articles/rtx-5090-vs-4090-for-video-gen/)），更需要无人值守。它也是 P1-2 的前提，因为 Agent 没法在网页上输入密钥。**做法**：启动时读取按通道命名的环境变量，例如 `VIDEOGEN_KEY_ARK_CN`。密钥只进内存，绝不写盘，照常脱敏。系统钥匙串留到 P2。**面向**：C、D，以及 A 中跑过夜批量的团队。**预计价值**：中高。**成本与风险**：2–3 人日。环境变量对同一用户的其他进程可见，也可能进入 shell 历史；文档应推荐从密码管理器注入，不要写进 profile。**原则**：兼容，videogen 自身仍然不持久化密钥。

## P1 把短剧工作流的两端接通：下游接剪映，上游接 Agent

**P1-1 剪映草稿与 FCPXML 导出。** 漫剧从业者的普遍做法是"外部生成、剪映精修"（[IT之家](https://www.ithome.com/1/005/809.htm)）。剪映自动化库 pyJianYingDraft 有约 3.4k–3.7k 星（[pyJianYingDraft](https://github.com/GuanYixuan/pyJianYingDraft)），ArcReel 和 oh-my-minimaxh3-director 都把导出剪映当卖点（[oh-my-minimaxh3-director](https://github.com/TFboy1/oh-my-minimaxh3-director)）。做法是：把保留的片段按镜头顺序导出为剪映草稿和 FCPXML，**只引用原文件，不转码**。时间线开头可选加一条"AI 生成"文字轨，这正好对应两项规定：《标识办法》要求视频起始画面显著提示（[网信办通知](https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm)），2026-09-01 起施行的《微短剧发展管理办法》要求 AI 微短剧每集在醒目位置标识（[新华网](https://www.news.cn/legal/20260731/4b8eea40226644d0a347c72ea1b21b75/c.html)）。面向 A、B，价值高，成本中等。主要风险是剪映草稿格式靠社区逆向，版本一升级就可能失效，需要做版本检测和回归测试。纯文件生成不需要 ffmpeg，与零依赖原则兼容。

**P1-2 CLI、本地 MCP 与无头令牌。** 主流 Agent 平台都没有原生视频生成，视频要靠托管 MCP 接入。Runway 在 2026-05-27 推出托管 MCP（[Runway](https://runwayml.com/news/mcp)）；fal 的 MCP 支持运行前查价（[fal](https://fal.ai/docs/model-apis/mcp)）。但专门的视频 MCP 星数只有几十到一千多，MiniMax-MCP 是 1,582（[MiniMax-MCP](https://github.com/MiniMax-AI/MiniMax-MCP)），说明 **MCP 是功能，不是产品**。技术上有两个约束：ChatGPT、Codex 和 Claude Desktop 的工具调用约 60 秒就超时（[OpenAI 社区](https://community.openai.com/t/responses-api-mcp-timeouts/1374557)；[Claude Desktop 问题](https://claudeissues.com/issue/63379-bug-desktop-app-cancels-stdio-mcp-tool-calls-at-60s-and-ignores-mcp-tool-timeout)）；客户端超时后重试，会导致两次生成都被计费（[GMI Cloud](https://www.gmicloud.ai/en/blog/long-running-operations-in-mcp-job-tracking-polling-and-idempotency)）。videogen 已有的预算和 `needs_review`，正是 vibeframe 拿来做标题的"硬成本上限"（[vibeframe](https://github.com/vericontext/vibeframe)）；而且本地工具还能挂接本地 GPU，这是托管 MCP 做不到的。设计上，CLI 支持 `submit`（接受 CSV/JSONL）、`--dry-run` 估价、`--budget`、`status` 和 `export`。MCP 提供 estimate、submit、status、wait、fetch 和标记保留/淘汰等工具：submit 带幂等键并立即返回，wait 有上限、控制在 60 秒内，fetch 返回本地路径和旁挂 JSON。本地 HTTP API 增加随机令牌，存成 0600 文件；它是 Host 检查之外的额外校验，不替代 Host 检查，也不暴露给浏览器。JSONL 格式要能直接接收分镜技能和短剧工具产出的镜头清单，这样 videogen 就成了它们的渲染后端，而不是正面竞争者。面向 C 和 A，价值高，成本中至大。风险在于令牌泄露可能导致花费失控。MCP 的 stdio 传输就是按行分隔的 JSON-RPC，用 Node 内置模块就能实现，不需要 SDK 依赖。

**P1-3 抽卡工作流与按模型良率。** 证据在前文已列出：接受率约 20%，每个镜头抽 4–10 次，超过上限要升级处理（[华人故事](https://www.ourchinastory.com/cn/17257)）。从业者建议先做 30 秒样片，测量浪费和一致性，再按"单镜头成本 × 预期抽卡次数"做预算（[搜狐](https://www.sohu.com/a/1032100492_122638820)）。Higgsfield 默认一次生成 4 个变体（[Hackceleration](https://hackceleration.com/higgsfield-review)）。失败扣费是可灵差评的主要来源，100 条 Trustpilot 评论中约 30% 抱怨这一点（[RainAI](https://rainaiservices.com/reviews/kling-ai/)）。videogen 已经做到只在有证据时才重试、审核失败只影响单个任务（README），但用户看不到各模型的失败率和审核拒绝率。做法是：每行支持指定变体数，每个镜头设抽卡上限，超过上限就把该行标为"需改提示词"；再按模型和厂商统计平均抽卡次数、每保留镜头成本、失败率和审核拒绝率，并写入清单。调研覆盖的竞品，从 ArcReel 到 huobao-drama，都没有这类良率指标。面向 A、B，价值高，成本小至中。花费会成 N 倍增长，由现有的确认和预算关卡兜底。统计只存在本地，与无遥测原则兼容。

**P1-4 参考图第二阶段与角色/资产库。** 这一阶段接入 Seedance 2.5 全模态参考（图像、视频、音频；有视频输入时按 ¥42/百万 token 计费且有最低下限）和 Gemini Omni 的 Files API 参考，并增加项目级的人物、场景、道具卡。CSV 里写 `@角色名`，就展开为对应的参考图。漫剧工具的需求清单里，明确包括从剧本中提取人/场/物资产库、全局锁定角色和项目级同步（[掘金](https://juejin.cn/post/7669994336818610227)）；Jellyfish 的报道也把一致性当作核心问题（[B站专栏](https://www.bilibili.com/read/cv47737600)）。开放的 `.char` 角色格式（[OmniChar](https://github.com/omnichar/OmniChar)）可以作为交换格式参考。风险是方舟限制直接上传真人面孔，需要走经授权的人像素材库（[方舟创建任务](https://docs.volcengine.com/docs/ark/create-video-generation-task-api)）。面向 A、B，价值高，成本中至大。

**P1-5 百炼转售的可灵、Vidu 与 PixVerse。** 百炼上的可灵按秒计费：kling-v3 带音频 720p ¥0.9/秒、1080p ¥1.2/秒，4K ¥3.0/秒，时长 3–15 秒，没有免费额度。要注意，它**默认 `mode` 为 `pro`（即 1080p）**，接入时应默认改为 std，或者让用户显式选择，以免成本超出预期（[百炼可灵 API](https://help.aliyun.com/zh/model-studio/kling-video-generation-api-reference/)）。Vidu 只能用北京区密钥（[百炼 Vidu](https://help.aliyun.com/zh/model-studio/vidu-image-to-video-api-reference)）。PixVerse r2v 接受 2–7 张图，¥0.47–0.70/秒（[百炼 PixVerse](https://help.aliyun.com/zh/model-studio/pixverse-v5-6-r2v)）。这样不用买 700 美元的资源包，就能补上 SuperCLUE 第 3 的 Kling 3.0，以及若干低价档。同时，在首个任务前提示各家的开通门槛：方舟要求余额 ¥200 以上（[Seedance 2.5 教程](https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh)），百炼要求开通模型并使用北京区密钥。面向 A，价值中高，成本中等，因为每个模型都要单独映射 schema。百炼版本的回调、Omni 视频输入、多主体输入等字段是否与直连对等，尚未核实。

**P1-6 签名与公证。** 两个平台的障碍都在变大。macOS Sequoia 取消了按住 Control 点击绕过 Gatekeeper 的方式，用户必须去"隐私与安全性"里点"仍要打开"，而这个按钮大约一小时后就会消失（[Macworld](https://www.macworld.com/article/2457844/what-to-do-when-you-cant-open-an-app-you-just-installed-in-macos-sequoia.html)）。Homebrew 从 2026-09-01 起禁用无法通过 Gatekeeper 的 cask（[Workbrew](https://workbrew.com/blog/what-homebrew-5-0-0-means-for-your-mac-fleet)）。Apple 开发者计划每年 99 美元，个人不能申请减免（[Apple](https://developer.apple.com/support/fee-waiver)）。Windows 方面，SignPath Foundation 免费为开源项目签名，条件包括：全部组件为 OSI 许可、由 CI 构建并可溯源到提交、公开代码签名政策；发布者名称会显示为 SignPath Foundation（[SignPath 条款](https://signpath.org/terms)）。Azure Artifact Signing 的个人账户只对美国和加拿大开放（[Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)）。做法是用签名的轻量启动器包住现有的内置 Node 和脚本，启动时不再弹出终端：Windows 用 SignPath 签名的 .exe，macOS 用公证过的 .app。之后再上 winget、Scoop 和 Homebrew cask。面向 E，价值中高，成本中等，外加每年 99 美元。即使签了名，每个新构建在 SmartScreen 上的信誉也从零开始（[Microsoft Learn](https://learn.microsoft.com/et-ee/windows/apps/package-and-deploy/smartscreen-reputation)），README 仍需附上"更多信息 → 仍要运行"的截图。启动器不是 npm 依赖，与原则兼容。

**P1-7 合规开关。** 《标识办法》自 2025-09-01 起施行。第十条禁止任何组织和个人提供帮助他人删除、篡改标识的工具（[网信办答记者问](https://www.cac.gov.cn/2025-03/14/c_1743654685896173.htm)）。厂商的可见水印大多默认关闭：方舟 `watermark` 默认为 false（[方舟创建任务](https://docs.volcengine.com/docs/ark/create-video-generation-task-api)）；万相 2.7 文档默认 false，但 Wan 3 指南的示例设为 true（[万相 2.7 文生视频](https://help.aliyun.com/zh/model-studio/text-to-video-api-reference)；[Wan 指南](https://help.aliyun.com/zh/model-studio/text-to-video-guide)）。方舟的隐式水印要按"推理接入点"单独开启，并填写主体名称和统一社会信用代码（[方舟隐式水印](https://docs.volcengine.com/docs/ark/add-invisible-watermark-to-ai-generated-content?lang=zh)）；而 videogen 按模型 ID 调用。代码中也没有任何 `watermark` 参数（本报告检索 src、public 和 data/catalog，2026-10-08）。欧盟 AI 法案第 50 条自 2026-08-02 起适用；行为准则要求至少两种机器可读技术（[Bird & Bird](https://www.twobirds.com/en/insights/2026/taking-the-eu-ai-act-to-practice-the-final-transparency-code-of-practice)），已上市系统的宽限期到 2026-12-02（[ComplianceHub](https://compliancehub.wiki/eu-ai-act-december-2-2026-legacy-systems-watermarking-grace-period-expiry/)）。做法有三点：如实暴露各家的可见水印开关；允许把方舟的 `ep-` 接入点 ID 填作模型，同时由用户声明对应的基础模型用于估价；可见水印关闭时提示"在中国境内发布需自行声明 AI 生成"。面向 A，以及面向欧盟市场的 B，价值中等，成本小。风险在于：videogen 是否构成"服务提供者"，以及欧盟第 50 条意义上的"提供者"，笔记中都没有结论。前者的推断是，作为本地工具大概率不需要备案或登记，但这不是法律意见。

## P2 等需求信号再上：本地推理、编辑延长与更多直连

**P2-1 延长、编辑、放大与"草稿转精"。** 多家厂商已提供这些能力：Seedance 2.5 支持编辑和延长；Omni 1.1 新增延长和 4K 放大（[Design Arena](https://x.com/DesignArena/status/2093068655756190104)）；Grok 有专门的编辑和延长端点（[xAI 文档](https://docs.x.ai/developers/model-capabilities/video/generation)）；FLUX 提供 Draft Enhance；MiniMax 有 2K 再生成。它们很适合放进画廊，做成"延长此条、编辑此条、放大此条"的操作。之所以放在 P2，是因为每一项都是新的任务类型：要上传源视频、按输入时长计价、有最低计费，FLUX 的视频到视频约为文生视频的 2.4 倍价（[BFL](https://bfl.ai/models/flux-3-video)）。再加上国内从业者大多在剪映里收尾，这类功能的边际价值低于 P1-1。真要做，建议先做 MiniMax 再生成（¥0.30/秒）和 Seedance 2.5 延长。

**P2-2 本地推理。** 开放模型的服务端已经收敛到 OpenAI 风格的 `/v1/videos`，但请求体并不一致。vLLM-Omni 用 multipart（[vLLM-Omni](https://docs.vllm.ai/projects/vllm-omni/en/stable/serving/videos_api/)）；NVIDIA Dynamo 用 JSON，并带 `nvext` 扩展（[Dynamo](https://docs.nvidia.com/dynamo/v1.3.0/backends/v-llm/v-llm-omni)）；LocalAI 用的是 `POST /video`（[LocalAI](https://localai.io/features/video-generation/)）。所以先做低成本的部分：把通用适配器的基础路径、请求体编码和字段映射（`size`/`seconds` 与 `width`/`height`/`num_frames`/`fps`）改为可配置。ComfyUI 是新开放模型首发当天就支持的运行时，MiniMax H3 发布当天就有原生支持（[Atlas Cloud](https://www.test.atlascloud.ai/blog/tips/minimax-h3-open-source-weights)），Comfy Cloud 也沿用同一套 API（[Comfy Cloud](https://docs.comfy.org/development/cloud/overview)）。ComfyUI 适配器需要一层"工作流模板 + 参数注入"，可以只靠 HTTP 轮询 `/history` 来实现。既然官方已经推出本地 MCP（[comfy-mcp](https://github.com/Comfy-Org/comfy-mcp)），videogen 应把 ComfyUI 当作后端来调用，而不是去做 ComfyUI 的控制器。同时要提示模型许可：只有 Wan 2.2 是宽松许可（[howaiworks](https://howaiworks.ai/blog/alibaba-wan-open-weights-stopped-at-2-2)）；MiniMax H3 的许可不授权美国、欧盟、英国和韩国使用（[NYU Shanghai RITS](https://rits.shanghai.nyu.edu/ai/minimax-ships-h3-weights-with-the-us-and-eu-excluded/)）；LTX-2.5 要求年收入低于 1,000 万美元（[ComfyUI Wiki](https://comfyui-wiki.com/en/news/2026-08-11-ltx-2-5-open-weights-release)）。放在 P2 的原因是硬件门槛高，除 H3 外的开放模型画质也落后闭源头部一档。

**P2-3 fal 与 Replicate。** 英文开发者默认用 fal，其次是 Replicate；两者都有自己的异步任务 schema，通用适配器无法直接对接（[Bifrost #7004](https://github.com/maximhq/bifrost/issues/7004)）。但 OpenRouter 已经用统一 schema 覆盖了大部分头部模型，而 fal 要逐个模型映射，在 Discussions 出现明确需求前不值得做。**P2-4 直连 xAI、BFL、MiniMax、可灵。** 只在 OpenRouter 缺功能、或价格明显更低时才做：xAI 的最多 4 个关键帧、编辑和延长，BFL 的草稿档，MiniMax 的 ¥0.5/秒 768P，可灵的 `external_task_id`（可用于崩溃后的幂等恢复，[可灵文生视频](https://kling.ai/document-api/apiReference/model/textToVideo)）。另据第三方报道，可灵 4.0 于 2026-09-28 宣布，完整模型预计 10 月推出，API 仍标为"即将推出"，尚无模型 ID 和价格（[SpicyAPI](https://spicyapi.ai/it/blog/kling-4-0-release-date-and-api)），值得跟进。

**P2-5 模型对比视图。** GenAIntel 等托管产品把同一提示词放在 40 多个模型上并排对比（[GenAIntel](https://www.genaintel.com/compare)），说明这类需求存在；公平比较的前提是提示词和源图完全一致（[YouArt](https://youart.ai/blog/how-to-compare-ai-video-models)）。CSV 已经支持逐行覆盖模型，做一个"同一行 × N 个模型"的预设加网格视图成本很小，既能帮新用户上手，也能产出获客内容。**P2-6 分发与资助。** OpenRouter 应用归因只需加上 `HTTP-Referer` 和 `X-OpenRouter-Title` 两个请求头，就能出现在公开的应用排行上（[OpenRouter 文档](https://openrouter.ai/docs/app-attribution)）。这些数据不会传给维护者，但会告诉 OpenRouter 请求来自哪个应用，所以应默认关闭，并在 PRIVACY.md 中披露。有了一定用户量后，可以争取像 Cherry Studio 那样被百炼官方文档收录（[阿里云帮助](https://help.aliyun.com/zh/model-studio/cherry-studio)）。阿里云云大使的返佣上限达 45%（[阿里云开发者社区](https://developer.aliyun.com/article/1667858)），可以作为公开披露、非强制的支持渠道。**P2-7 系统钥匙串。** 不需要 npm 依赖，调用系统自带的工具即可，但需要应对三个平台的差异，还会改变"密钥不落盘"的说法。应作为可选功能，排在环境变量之后。

## 十件明确不做的事，多数源于零依赖与合规底线

| 不做的事 | 理由 | 替代做法 |
|---|---|---|
| 托管积分、SaaS 或项目自营云服务 | CONTRIBUTING 禁止项目控制的云服务（代码库核查 2026-10-08）；要处理支付、KYC 和滥用；面向公众的服务在国内可能进入登记或备案范围（推断，非法律意见，[观韬](https://www.guantao.com/page4747)） | GitHub Sponsors、爱发电、公开披露的返利链接 |
| Webhook/回调接收端 | 127.0.0.1 没有公网入口；OpenRouter 会重复投递，需要去重（[OpenRouter](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)） | 继续轮询，完成后立即下载 |
| 厂商批量或离线折扣通道 | 方舟 `flex` 不支持 Seedance 2.x；Omni 没有 Batch 折扣 | 本地分通道队列就是实际的批量层 |
| 去水印、剥离或改写元数据，或会丢失元数据的内置转码/拼接 | 违反《标识办法》第十条；市面已有剥离 AIGC 元数据的工具（[aigc-tag-tool](https://github.com/AIPlayerDayu/aigc-tag-tool)），不应跟进 | 剪映/FCPXML 导出引用原文件，加上旁挂元数据 |
| 遥测与自动更新检查 | CONTRIBUTING 明确禁止（代码库核查 2026-10-08） | 看 Release 下载数，用 Discussions；"检查更新"只做成打开 Releases 页面的链接 |
| Electron 或 Tauri 重写 | Electron 安装包有数十到数百 MB（[PkgPulse](https://www.pkgpulse.com/guides/electron-vs-tauri-2026)），与零依赖相悖 | 签名的轻量启动器 |
| 自动化消费者订阅账号（Flow 网页、即梦会员 CLI 包装） | 有违反服务条款的风险；gflow-cli 本身就是非官方工具（[gflow-cli](https://github.com/ffroliva/gflow-cli)） | 只接官方 API；坦白告诉用户，对 Veo 重度用户来说 Flow 订阅更便宜 |
| 面向无脸内容农场的量产功能，以及数字人口播专用流程 | 平台在执法；数字人是另一条产品轴 | 需要数字人时，经 OpenRouter 调用 HeyGen |
| 在 UI 里嵌入排行榜实时名次 | 名次每周变化，置信区间重叠 | 在文档里写带日期的选型说明 |
| 接入没有公开 API 的模型（Midjourney、Meta Muse Video、Utopai X、Moonvalley）以及只走销售渠道的 Adobe Firefly 视频 | 没有自助 API；Midjourney 条款禁止自动化（[Apiframe](https://apiframe.ai/blog/best-midjourney-apis)；[OrcaRouter](https://www.orcarouter.ai/blog/muse-video-release-date-api-leak)） | 等它们开放 API 再说 |

这些"不做"大多有一个共同点：它们会把 videogen 从"用户本机上的透明账本"变成"替用户托管或绕过某样东西的服务"。这正是 MIT、本地优先、BYOK 定位承诺不做的事，也是《标识办法》第十条和各家服务条款的风险集中区。

## 结论

价格下行没有削弱成本账本的价值，反而放大了它。同规格片段价差可达 13 倍，计费单位有五种，按 token 计价和最低计费下限并存，"选哪家、抽几次"成了每分钟成片成本的决定因素。因此，videogen 最该打磨的指标是**跨厂商可比的"每保留秒成本"**。竞品都没有这个指标，而短剧团队的核心 KPI 正是每分钟成片成本。按这个思路，P0-1、P0-4、P1-1 和 P1-2 合起来，会把 videogen 从一个独立的"批量工作台"变成短剧与 Agent 管线下游的**渲染与记账层**：上游通过 CSV、JSONL 或 MCP 接收镜头清单，下游交出剪映草稿和可审计的清单。这样它不必与"一句话成片"工具正面竞争，还能借它们的流量。

决定后续节奏的不确定性有三个。第一，OpenRouter 的 `input_references` 能否接受 data URL，这决定 P0-1 的范围，几美分就能验证。第二，可灵 4.0 API 的开放时间和价格尚未公布。第三，Runway、fal 等托管 MCP 会扩张到什么程度，这会压缩只做云端的 MCP 的空间，也会抬高"本地 GPU + 预算护栏"的相对价值。合规方面，videogen 现在"不转码、保留原始字节"，起点是对的；今后的风险主要来自它自己新增的后处理功能。建议把"任何新功能都不得丢失或改写 AIGC 元数据"写进 CONTRIBUTING.md，作为与零依赖同级的硬原则。
