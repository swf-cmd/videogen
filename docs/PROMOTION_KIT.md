# Promotion kit

Copy for **videogen 2.1.3**. Publication is a separate maintainer action. Check the [launch checklist](GITHUB_LAUNCH_CHECKLIST.md), release artifacts and [provider contracts](providers/) before making availability or price claims.

## English

**videogen 2.1 — turn a prompt list into a reviewed video batch.**

Run a local video workspace with your own provider keys. Import CSV rows and prompt templates, match images from a folder, set each shot's supported first/last frames, and inspect row estimates before you submit. Preview completed clips in a gallery, keep or reject takes, and see estimated spending per kept clip. Every regeneration asks you to confirm a new job.

The persistent queue handles separate provider/region lanes and automatic original-file downloads. Close the browser without losing progress; after a service restart, re-enter keys to resume known remote jobs. Gemini now saves a background interaction ID before polling. OpenRouter frame inputs and settings follow the model catalog. Ambiguous creates still stop for manual review.

Windows x64 and macOS universal portable bundles include Node: extract and double-click. Four interface languages and four READMEs are included. No telemetry, npm dependencies or project-operated cloud. API keys stay in memory; private prompts, frames and job history stay in the local data directory.

The demo uses offline fixtures and makes no paid video calls. Its preview clip is a playback test, not a model-quality example. Provider generation can cost money; estimates are not invoices, availability varies, and lost create responses can still require review. Community ZIPs may need OS first-open confirmation and are not notarized installers.

[Source and downloads](https://github.com/swf-cmd/videogen)

## 中文

**videogen 2.1：从提示词表格，到批量出片和挑片。**

自带供应商密钥，在本机导入 CSV、模板变量和图片文件夹；为每条镜头单独设置模型支持的首尾帧，逐行校验、估价后再提交。完成的视频可直接在画廊预览，标记保留或淘汰，并查看每条保留片的估算成本。每次重新生成都需要单独确认。

持久化队列按供应商和区域分车道，自动下载原始视频。关浏览器不丢进度，服务重启后重新输入密钥可继续跟踪已知任务。Gemini 改为先保存后台 interaction ID 再轮询；OpenRouter 的本地首帧和参数随模型目录能力变化。创建结果不明的任务仍会暂停等待人工核实。

Windows x64、macOS 通用 ZIP 内置 Node，完整解压后双击启动。提供中、日、英、韩四种界面及 README，没有遥测、npm 依赖或项目自营云服务。密钥只在内存中，提示词、参考图与任务记录保存在本机。

演示全部使用离线测试素材，没有调用付费视频接口。预览样片用于测试播放，不代表 AI 模型生成效果。真实生成可能付费；估价不等于账单，可用性因账号而异，创建响应丢失时仍可能需要人工核实。社区 ZIP 首次打开可能要求系统确认，未进行商业签名或公证。

[源码和下载](https://github.com/swf-cmd/videogen)

## Media rules

Use the reviewed `docs/media/videogen-workflow.gif`, `.webm` and `offline-preview.mp4`, or make a new recording with synthetic prompts and local fixtures. Hide all real keys, account/task IDs, output paths and provider URLs. Do not represent synthetic playback fixtures as AI model samples or make unverifiable model-popularity claims. Obtain separate authorization before spending provider credits or publishing user-owned sample media.
