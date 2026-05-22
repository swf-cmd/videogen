# Sora2App

Sora2App 是一个本地运行的小网页，用来调用 OpenAI Video API 生成 `sora-2` 或 `sora-2-pro` 视频，并把完成后的 MP4 保存到你指定的输出目录。

## 功能

- 支持标准 Video API 和 Batch API 两种调用方式。
- 支持 `sora-2` 与 `sora-2-pro` 的时长、分辨率组合校验。
- Batch 模式可把提示词按空行拆成任务队列，并自动下载完成的视频。
- API key 只在本机浏览器和本机服务之间传递，不会写入磁盘。
- 界面内置中文、日文、英文、韩文。

## 运行要求

- Node.js 18 或更新版本
- 一个可用的 OpenAI API key

源码仓库不包含 macOS Node.js 运行时二进制。原本本地包里的 `runtime/` 目录体积超过 200 MB，不适合放入 git 历史；如果需要免安装 Node 的分发包，请将运行时放到 Release 附件或单独打包。

## 快速开始

```bash
git clone https://github.com/swf-cmd/videogen.git
cd videogen
npm start
```

打开终端显示的地址，默认是：

```text
http://127.0.0.1:5177
```

macOS 用户也可以双击：

```text
Start Sora2App.command
```

这个启动器会自动寻找 Node.js 18+，并在默认端口被占用时尝试后续可用端口。

页面里填入：

- OpenAI API key
- 调用方式：`标准 API` 或 `Batch API`
- 提示词
- 模型：`sora-2` 或 `sora-2-pro`
- 时长：`4`、`8`、`12`、`16`、`20` 秒
- 分辨率：
  - `sora-2`：`720x1280`、`1280x720`
  - `sora-2-pro`：`720x1280`、`1280x720`、`1024x1792`、`1792x1024`、`1080x1920`、`1920x1080`
- 输出目录和文件名

Batch API 模式会把提示词按空行拆成多条任务，并可在界面里选择本次提交条数。未手动修改条数时，提交条数会跟随提示词队列数量；单条提示词可以选择重复提交多条任务，多条提示词则会提交队列前 N 条。根据 OpenAI Batch API 官方限制，单个 batch 最多 50,000 条请求、输入文件最多 200 MB。Batch 任务最多 24 小时完成，官方价格相对同步接口有 50% 折扣；视频资源会在 batch 完成后自动下载到输出目录。

## 安全说明

- 本应用只监听 `127.0.0.1`，不对局域网开放。
- API key 不会保存到本地文件、localStorage 或日志中。
- 输出目录不会持久化到 localStorage；选择后仅在当前页面会话中使用。
- 输出目录由用户选择，生成的视频文件会保存到该目录。

## 官方接口依据

当前实现按 OpenAI 官方 Video API 文档：

生成参数参考 OpenAI 官方 Video generation guide、Pricing 和 Sora 2 Pro model 页：`sora-2` 开放 720p 横竖屏；`sora-2-pro` 开放 720p、1024p、1080p 横竖屏；时长开放 `4`、`8`、`12`、`16`、`20` 秒。当前 Create video API Reference 与 guide/pricing 对 `16/20` 秒和 1080p 的列举不完全一致；如果接口返回参数错误，请改用 `4/8/12` 秒或非 1080p 后重试。

- 创建任务：`POST /v1/videos`
- 查询任务：`GET /v1/videos/{video_id}`
- 下载内容：`GET /v1/videos/{video_id}/content`
- Batch 文件上传：`POST /v1/files`
- Batch 创建与查询：`POST /v1/batches`、`GET /v1/batches/{batch_id}`
- Batch 结果读取：`GET /v1/files/{file_id}/content`

视频生成是异步任务，本应用会以默认 10 秒间隔轮询任务状态，完成后自动下载 MP4。
Batch 模式会以默认 15 秒间隔轮询 batch 状态，完成后读取输出文件中的 video id 并下载 MP4。

## License

MIT
