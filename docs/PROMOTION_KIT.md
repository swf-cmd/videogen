# Promotion kit

Copy for **videogen 2.0.0**. Publication, tags and release packages are maintainer actions. Review the [provider contracts](providers/) and [launch checklist](GITHUB_LAUNCH_CHECKLIST.md) before publishing current access or pricing claims.

## English

videogen is a local AI video render queue with adapters for OpenRouter, Gemini, Alibaba Cloud Model Studio, Volcengine/BytePlus Ark and OpenAI-compatible servers. Bring your own key, batch prompts, review estimates and budgets, then let the service track work and download the original results.

Version 2.0.0 replaces the retired Sora2App integration with a persistent queue. Each provider/region/endpoint lane has its own concurrency and pause controls. Closing the browser does not stop work; after a service restart, re-enter keys to resume. An ambiguous create stops for review instead of being automatically sent again. You can explicitly resubmit, abandon the item or attach an existing remote task ID.

The app has no npm dependencies, build step, telemetry or project-operated cloud service. It supports Chinese, Japanese, English and Korean. Keys stay in memory; prompts, first frames and task records persist locally, with a history-and-assets cleanup control. Original output bytes and metadata are preserved, and existing files are never overwritten.

Provider capabilities, account access and terms differ. Compatible endpoints are experimental; OpenRouter local first frames and Seedance 2.5 seed are disabled. Gemini uses blocking create and Files-specific manual recovery. Cost estimates may be unknown or omit provider charges. Offline contract and crash tests cover the implementation; this release did not make paid provider smoke calls.

[Source and setup](https://github.com/swf-cmd/videogen)

## 中文

videogen 是本机运行的 AI 视频渲染队列，提供 OpenRouter、Gemini、阿里云百炼、火山方舟／BytePlus Ark 以及 OpenAI 兼容服务器适配器。自带密钥，批量填写提示词，确认估算与预算后，由服务持续跟踪并下载原始结果。

2.0.0 用持久化队列接替已停用的 Sora2App 集成。不同供应商、区域和端点组成独立车道，可分别设置并发与暂停。关闭浏览器不会停止任务；服务重启后重新输入密钥即可继续。创建结果不明时先进入人工核实，不自动重发。用户可明确选择重新提交、放弃或关联已有远端任务 ID。

应用无需 npm 依赖和构建，没有遥测或项目自营云服务，提供中文、日文、英文、韩文界面。密钥仅留在内存；提示词、首帧和任务记录保存在本机，可清除历史与素材。下载保留原始字节和元数据，不覆盖已有文件。

供应商能力、账号资格和条款各不相同。兼容端点默认实验性；OpenRouter 本地首帧及 Seedance 2.5 seed 已禁用。Gemini 使用阻塞式创建，手动恢复需要 Files 地址。成本可能未知，也可能不包含额外计费。实现经过离线契约和崩溃测试，本次发布没有进行付费供应商实测。

[源码与使用说明](https://github.com/swf-cmd/videogen)

## Suggested title

```text
videogen 2.0 — local AI video queues with crash recovery and automatic downloads
```

## Screenshots and test claims

Capture the current UI with mock or synthetic data. Keep keys empty, use shortened paths such as `~/Downloads/videogen`, and remove private prompts, task IDs, account information, result URLs and proxy userinfo. Mock output is deterministic test data, not a playable generated video.

The default offline acceptance run used 100 jobs across two lanes, three SIGKILL restarts and five SSE disconnects: 92 succeeded, 5 moderation failures and 3 review items; duplicate creates, untracked remote jobs, output hash mismatches and exposed keys were all zero. Observed lane maxima were 3/5, with at most 3 downloads. Present these as mock-test results, not a guarantee about third-party uptime or billing. Update figures if a later release's acceptance run differs.
