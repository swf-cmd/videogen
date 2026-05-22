# Promotion Kit

Use these short posts after the README, release, and privacy notes are ready.

## English Short Post

I built Sora2App: a local web UI for OpenAI Sora 2 / Sora 2 Pro video generation.

It supports the standard Video API, Batch API prompt queues, automatic polling, and MP4 downloads. It runs on `127.0.0.1`, and the API key is not saved to disk, localStorage, or logs.

GitHub: https://github.com/swf-cmd/videogen

## English Launch Post

I made Sora2App, a local-first web UI for generating videos with OpenAI Sora 2 / Sora 2 Pro.

Why I built it:

- I wanted a simple local tool for testing video prompts.
- I wanted Batch API support for prompt queues.
- I wanted generated MP4 files to download automatically.
- I did not want the API key written to disk or browser localStorage.

It runs on `127.0.0.1`, supports Chinese/Japanese/English/Korean, and works with Node.js 18+ or the bundled macOS release package.

GitHub: https://github.com/swf-cmd/videogen

## Chinese Short Post

我做了一个本地运行的 Sora 2 / Sora 2 Pro 视频生成小工具：支持标准 Video API、Batch API、自动轮询和自动下载 MP4。它只监听 `127.0.0.1`，API key 不写入磁盘、localStorage 或日志。

GitHub: https://github.com/swf-cmd/videogen

## Chinese Launch Post

我做了一个 Sora2App，本地运行的小网页，用来调用 OpenAI Sora 2 / Sora 2 Pro 生成视频。

主要功能：

- 标准 Video API 和 Batch API 两种模式。
- 多条提示词按空行拆成 Batch 队列。
- 自动轮询任务状态，完成后自动下载 MP4。
- 支持中文、日文、英文、韩文界面。
- API key 不保存到磁盘、localStorage 或日志。
- 输出路径展示会尽量缩写成 `~/...`，减少截图时泄露本机用户名。

适合批量测试 prompt、对比不同参数、整理生成结果。

GitHub: https://github.com/swf-cmd/videogen

## Hacker News Title

```text
Show HN: Sora2App - local web UI for OpenAI Sora 2 video generation
```

## Product Hunt Tagline

```text
Local-first Sora 2 video generation UI with Batch API and automatic MP4 downloads.
```

## Screenshot Checklist

Before posting screenshots:

- Use a fake prompt or a prompt you are happy to publish.
- Keep the API key field empty or hidden.
- Use `~/Downloads/SoraVideos`, not a full personal path.
- Clear logs that contain private paths, video IDs, or Batch IDs.
- Do not show generated videos that contain private or client material.
