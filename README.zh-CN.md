# videogen

本机运行、零依赖的 AI 视频工作台。自带供应商密钥，按提示词队列生成并自动下载。支持中文、日文、英文、韩文。[English](README.md)

**Sora 已停用。** videogen 接替 Sora2App 已失效的 Sora 集成。**1.1.0** 支持 OpenRouter 和可配置的 OpenAI 兼容视频端点；旧 OpenAI Batch 流程及折扣已移除。

## 启动

需要 Node.js 18 或更新版本，无需安装任何 npm 包。

```bash
git clone https://github.com/swf-cmd/videogen.git
cd videogen
npm start
```

打开服务打印的地址，默认 `http://127.0.0.1:5177`。可用 `PORT` 更换端口，服务始终只监听 `127.0.0.1`。

macOS 可双击 **Start videogen.command**，旧名 `Start Sora2App.command` 已废弃。移动时保持启动器和应用文件完整；维护者提供的完整包如包含 `runtime/`，也须保留。即使使用不同端口，同一个数据目录也只允许一个服务实例。Linux、Windows 可从源码运行，手动填写输出目录。直接打开 `public/index.html` 可预览界面，但不能生成。

## 生成与找回

1. 选择**供应商 · 区域**。兼容端点需要填写 API 根地址、模型 ID，并按该端点文档配置时长、分辨率、画幅及请求格式。
2. 输入该车道的密钥。车道由供应商、区域和 base URL 共同确定；密钥只保存在服务内存，切换车道或 URL 会清空输入框，重启服务后需要重新输入。本地端点可以不要求密钥。
3. 用空行分隔多条提示词；只有一条提示词时可以设置重复次数。选择参数、可选首帧图、输出目录和文件名。
4. 查看成本与耗时估算并确认提交。缺少价格时显示**未知**，不会按免费处理。估算不是供应商账单承诺。
5. 服务按**并发 1、逐条执行**的方式创建、轮询并下载。默认保存到 `~/Downloads/videogen`。重名时自动选择其他文件名，不覆盖旧文件；供应商返回的字节和元数据原样保存，不转码。

这是**阶段 0** 版本。任务记录和素材已经持久化，服务重启后的自动续跑及持久化队列界面将在阶段 1 提供。运行期间请保持服务开启。中断后可选择原供应商、区域、模型，在“找回已有任务”中输入远端 ID；此操作只轮询和下载，不创建新的付费视频。创建结果不明时，请先在供应商控制台核实，再考虑重新提交，因为可能已经扣费。

## 供应商

| 供应商 | 1.1.0 状态 | 说明 |
| --- | --- | --- |
| OpenRouter · 全球 | 已支持 | 目录快照包括 `alibaba/wan-3.0`、`alibaba/wan-2.7`、`runway/gen-4.5`，后续可用性可能变化。尚未核实本地图片上传或 data URL 协议，因此禁用本地首帧。[协议与来源](docs/providers/openrouter.md) |
| OpenAI 兼容端点 · 自定义 | 已支持，实验性 | 填写本地或可信服务器的模型与能力；提交前选定 JSON 或 multipart，不自动更换格式重发创建请求。[协议与来源](docs/providers/openai-compatible.md) |
| Mock · 本地 | 仅开发 | 设置 `VIDEOGEN_DEV=1` 显示；输出确定性测试字节，不是可播放的生成视频。 |
| Gemini、阿里云百炼、火山方舟、BytePlus ModelArk | 阶段 1 计划 | 本版本尚无直连适配器。下表用于接入准备，不代表已经可用。 |

目录和官方来源保存在 `data/catalog/`、`docs/providers/`。用户可在数据目录的 `catalog.local.json` 中覆盖配置；未核实的模型配置显示为**实验性**。

## 供应商、区域与条款

核实日期：**2026-10-08**。供应商条款、账号权限和计费与本项目的 MIT 许可分别适用。

| 供应商 · 区域 | 条件与限制 |
| --- | --- |
| OpenRouter · 全球 | 可用性取决于账号和底层模型供应商。视频生成需要临时保留数据，不能假定零数据留存。[视频指南](https://openrouter.ai/docs/guides/overview/multimodal/video-generation) |
| 兼容端点 · 自定义 | 由你运营或选择端点，需遵守模型许可、使用规则及账号要求；远程端点应使用 HTTPS。 |
| Gemini API · 支持地区，计划接入 | [可用地区列表](https://ai.google.dev/gemini-api/docs/available-regions)不包含中国大陆；使用者须年满 18 岁，面向专业或商业开发用途。向 EEA、英国、瑞士用户提供 API 客户端时须使用付费服务。[条款](https://ai.google.dev/gemini-api/terms) |
| Gemini Omni · EEA / 英国 / 瑞士，计划接入 | 不支持编辑或延长**用户上传的视频**；含未成年人的图片也有上传、编辑限制。这并非全面禁止首帧图片。[Omni 限制](https://ai.google.dev/gemini-api/docs/omni) |
| 阿里云百炼 · 北京 / 新加坡，计划接入 | 各地域分别开通；国内付费使用需实名认证，免费额度的条件可能不同。开通要求余额非负，付费调用需保持足额资金；预览模型可能另需申请。[常见问题](https://help.aliyun.com/zh/model-studio/faq-about-alibaba-cloud-model-studio)、[额度规则](https://help.aliyun.com/zh/model-studio/new-free-quota)、[地域](https://help.aliyun.com/zh/model-studio/regions) |
| 火山方舟 · 北京，计划接入 | 完成适用的实名认证。Seedance 开通条件包括余额**大于 200 元**、符合条件的节省计划或尚有余额的资源包，满足其一；以账号当时的开通界面为准。[平台说明](https://docs.volcengine.com/docs/ark/platform-capabilities-overview?lang=zh)、[视频 API 开通要求](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh) |
| BytePlus ModelArk · 海外，计划接入 | 一般服务地区列表不含美国，但包含加拿大、英国、澳大利亚、新西兰。受限模型另有规则，最终资格在购买时确定。[国际可用性](https://docs.byteplus.com/en/docs/ModelArk/availability) |

## 隐私与本机文件

**提示词、参数、首帧图、远端任务 ID、成本估算、输出路径现在都会写入磁盘**，同时保存任务状态、供应商信息及输出哈希。这与旧版 Sora2App 仅跟随请求运行的方式不同。

| 系统 | 默认数据目录 |
| --- | --- |
| macOS | `~/Library/Application Support/videogen/` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/videogen/` |
| Windows | `%APPDATA%\videogen\` |

可用 `VIDEOGEN_DATA_DIR` 覆盖位置。`jobs.ndjson` 是事件日志，`jobs.snapshot.json` 是压缩快照，`assets/` 按内容哈希保存首帧图；系统支持时采用受限权限。

“**清除历史和素材**”会删除已结束任务的记录和不再引用的图片。未完成及 `needs_review` 记录会保留，已下载视频也会保留；视频需自行从文件管理器删除。应用不会把密钥写入文件、浏览器存储或 URL。非机密界面偏好使用 `videogen.*` localStorage；输出目录偏好不保存，但任务记录会保存实际输出路径。

提交的提示词和图片会发往你选择的供应商；下载可能访问该供应商返回的存储或 CDN 地址。预签名下载不携带密钥，重定向也不转发密钥。应用没有遥测、更新检查或项目自营云服务。界面中的主目录路径缩写为 `~`；分享截图或报告前仍应检查敏感信息。

[隐私详情](PRIVACY.md) · [安全策略](SECURITY.md) · [架构](docs/ARCHITECTURE.md)

## 开发

```bash
npm test
VIDEOGEN_DEV=1 npm start
```

测试使用 Node 内置测试器，离线执行，不需要供应商密钥。独立 mock 服务在 `test/fixtures/mock-provider-server.js`。应用使用 CommonJS 和浏览器经典脚本，无构建步骤。参见[贡献说明](CONTRIBUTING.md)、[更新日志](CHANGELOG.md)、维护者[打包清单](docs/GITHUB_LAUNCH_CHECKLIST.md)。

[MIT 许可](LICENSE)。不要把 `runtime/`、生成媒体、本机任务数据或密钥提交进源码仓库。
