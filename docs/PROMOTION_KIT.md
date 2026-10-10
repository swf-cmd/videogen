# Promotion kit

Copy for **videogen 2.3.0**. Publication is a separate maintainer action. Check the [launch checklist](GITHUB_LAUNCH_CHECKLIST.md), release artifacts and [provider contracts](providers/) before making availability or price claims.

## English

**videogen 2.3 — prompts or CSV in, reviewed takes out.**

OpenAI shut down the Sora 2 API on 2026-09-24. videogen (formerly Sora2App) keeps the local batch workflow and runs it on OpenRouter, Gemini, Alibaba Cloud Model Studio, Volcengine / BytePlus Ark or your own OpenAI-compatible server, with your own keys.

Import CSV rows with prompt templates, match images from a folder, set each shot's supported first/last frames and render every row up to 20 times. Every row is validated and priced before you confirm, and a slate beside the submit button always shows the model, format, request count and estimated price and time that will be sent. Finished takes land in a gallery grouped by shot: review from the keyboard (J/K, Space, 1 keep, 2 reject), see the estimated cost per kept clip, and export the kept takes as CSV/JSON with paths, prompts, settings and SHA-256 for your editor.

The queue is owned by a local service: close the browser without losing progress, and after a crash or restart it resumes known remote jobs once you re-enter keys. Ambiguous creates stop for manual review instead of being resent; a 100-job crash test produced zero duplicate creates.

Windows x64 and macOS universal portable bundles include Node: extract and double-click. Four interface languages, no telemetry, no npm dependencies, no project-operated cloud. Keys stay in memory; prompts, frames and job history stay in the local data directory.

The demo recording uses a local stand-in endpoint with synthetic test animations and an example price; it makes no paid video calls and shows no model output. Provider generation can cost money; estimates are not invoices, availability varies, and lost create responses can still require review. Community ZIPs may need OS first-open confirmation and are not notarized installers.

[Source and downloads](https://github.com/swf-cmd/videogen)

## 中文

**videogen 2.3：提示词或表格进去，挑好的片子出来。**

OpenAI 已于 2026-09-24 关停 Sora 2 API。videogen（原 Sora2App）保留本机批量工作流，改用 OpenRouter、Gemini、阿里云百炼、火山方舟／BytePlus 或你自己的 OpenAI 兼容服务器，使用你自己的密钥。

导入 CSV 和模板变量，从文件夹匹配图片，为每个镜头单独设置模型支持的首尾帧，每条最多生成 20 个 take。每一行都先校验、估价，再由你确认提交；提交按钮旁的场记板始终显示即将发出的模型、规格、请求数、预估价格和耗时。完成的 take 按镜头分组进入画廊：用键盘审片（J/K、空格、1 保留、2 淘汰），查看每条保留片的估算成本，并把保留片导出为含路径、提示词、参数和 SHA-256 的 CSV/JSON，直接交给剪辑软件。

队列由本机服务负责：关浏览器不丢进度；崩溃或重启后重新输入密钥即可继续跟踪已知远端任务。创建结果不明的任务会暂停等待人工核实，不会自动重发；100 任务崩溃测试中重复创建为 0。

Windows x64、macOS 通用 ZIP 内置 Node，完整解压后双击启动。提供中、日、英、韩四种界面，没有遥测、npm 依赖或项目自营云服务。密钥只在内存中，提示词、参考图与任务记录保存在本机。

演示录屏连接本地模拟端点，画面是程序绘制的测试动画，价格为示例值；没有调用付费视频接口，也不代表任何模型的生成效果。真实生成可能付费；估价不等于账单，可用性因账号而异，创建响应丢失时仍可能需要人工核实。社区 ZIP 首次打开可能要求系统确认，未进行商业签名或公证。

[源码和下载](https://github.com/swf-cmd/videogen)

## Media rules

Use the reviewed `docs/media/videogen-interface-light.webp`, `videogen-interface-dark.webp`, `videogen-workflow.gif`, `.webm`, `videogen-review.png`, `.github/social-preview.png` and `offline-preview.mp4`, or make a new recording with synthetic prompts, synthetic clips and local fixtures. Hide all real keys, account/task IDs, private output paths and provider URLs. Label synthetic clips and example prices as such; do not represent them as AI model samples or provider quotes, and do not make unverifiable model-popularity claims. Obtain separate authorization before spending provider credits or publishing user-owned sample media.

The current recording, gallery screenshot and social preview (redesigned interface, after 2.2.1) were made with the app running against a local OpenAI-compatible stand-in that returns pre-rendered clips labeled "SYNTHETIC TEST CLIP", and a `catalog.local.json` entry (`demo-video`, USD 0.05/second) that exists only in the recording's temporary data directory.

The light and dark interface stills (2880×1800) were captured on 2.3.0 in the same way: a local OpenAI-compatible stand-in returned freshly drawn clips labeled "SYNTHETIC TEST CLIP", the same `demo-video` entry priced USD 0.05/second lived only in a temporary data directory, and the gallery selections were made from the keyboard. No provider key, paid call or private path is shown.
