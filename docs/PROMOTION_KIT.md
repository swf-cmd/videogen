# Promotion kit

Copy for the **1.1.0 phase 0** implementation. Publication is a maintainer action. Do not claim automatic restart recovery or direct Gemini/Alibaba/Ark support before the corresponding release is complete.

## English

videogen is a local AI video workbench for OpenRouter and OpenAI-compatible video servers. Bring your own key, separate prompts with blank lines, review the estimate, and let the service generate and download each result in order.

It has no package dependencies and supports Chinese, Japanese, English and Korean. Keys stay in service memory. Task records and first-frame images are saved locally, with a history-and-assets cleanup action and recovery by remote task ID.

Sora is retired; videogen replaces the old Sora2App integration. Version 1.1.0 uses a sequential queue. Automatic restart recovery is planned for phase 1.

[Source and setup](https://github.com/swf-cmd/videogen)

## 中文

videogen 是本机运行的 AI 视频工作台，支持 OpenRouter 和 OpenAI 兼容视频服务器。自带密钥，用空行分隔提示词，确认估算后依次生成并自动下载。

应用零依赖，提供中文、日文、英文、韩文界面。密钥仅存服务内存；任务记录和首帧图保存在本机，可清除历史和素材，并按远端任务 ID 找回结果。

Sora 已停用，videogen 接替旧 Sora2App 集成。1.1.0 使用顺序队列，服务重启后的自动续跑将在阶段 1 提供。

[源码与使用说明](https://github.com/swf-cmd/videogen)

## Suggested title

```text
videogen — local multi-provider AI video queues with automatic downloads
```

## New screenshots

The obsolete Sora artwork has been removed. Capture the current UI with mock or synthetic data. Keep keys empty, use `~/Downloads/videogen`, and remove private prompts, remote IDs, account information and personal paths. Describe mock output as test data; do not present it as a generated video.
