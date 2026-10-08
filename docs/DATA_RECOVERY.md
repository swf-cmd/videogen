# Recovering an old damaged data directory

A short API key in versions before 2.1.1 could replace parts of stored prompts,
URLs, paths or IDs with `[REDACTED]`. Version 2.1.2 prevents further corruption
and offers an explicit offline quarantine tool. It cannot reconstruct the lost
text or infer whether a provider accepted a request whose response is missing.

Stop every videogen instance using the source directory. Keep a complete backup
of the data and video output directories. A known-good backup from before the
damage is preferable. Never copy a backup over the only remaining evidence.

From the extracted application/source directory, use a supported Node runtime:

```sh
node scripts/recover-data.cjs --source "/absolute/old-data" --destination "/absolute/recovered-data"
```

The destination must not exist and must be outside the source. Its parent must
already exist; keep other programs from creating or modifying the destination
during recovery. In portable
Windows bundles, replace `node` with `.\runtime\node-win-x64\node.exe`; on macOS,
use `./runtime/node-darwin-arm64/node` or `./runtime/node-darwin-x64/node`.
The command does not start the service or contact any provider. If interrupted
before publication, a hidden staging directory/reservation may remain beside the
destination. Preserve it for inspection and choose a new destination when
retrying; an incomplete destination is never used as recovered data.

The original persistent files are read without repair or truncation. A temporary
instance lock prevents concurrent use; stale lock metadata may be reclaimed.
The new directory retains original evidence in `recovery-original/`, and a
private `recovery-report.json` identifies quarantined records and records source
file checksums. Treat this directory
and report as sensitive: they contain prompts, file paths and task metadata.
Do not upload them publicly.

Recovery only isolates corruption that can be attributed to specific records.
Invalid JSON/UTF-8, missing or out-of-order journal records, missing model
references and other ambiguity cause recovery to stop rather than silently lose
an accepted remote task. Symbolic links are rejected. The source remains
available for manual investigation or restoration from a complete backup.

Usable jobs with known remote IDs retain their tracking information. Uncertain
jobs without an ID require manual review, and recovered batch/lane submission
controls are paused. Re-enter keys to track accepted work. Check provider task
records and download results promptly before deciding whether to attach a remote
ID, abandon a task, or explicitly pay for a new submission. Quarantined jobs are
preserved as evidence and are not scheduled. Built-in provider catalogs are used;
original catalog overrides remain in the evidence directory.

Start with `VIDEOGEN_DATA_DIR` pointing to the recovered directory. For example:

```sh
VIDEOGEN_DATA_DIR="/absolute/recovered-data" npm start
```

For Windows Command Prompt:

```bat
set "VIDEOGEN_DATA_DIR=C:\path\recovered-data"
"Start videogen.cmd"
```

Keep output folders at their original locations: recovered job target paths are
absolute. The new data directory must support hard links (use a local system
disk rather than exFAT).

## 中文操作说明

先停止旧服务，完整备份数据目录和视频输出目录。在程序目录中运行：

```sh
node scripts/recover-data.cjs --source "旧数据目录的绝对路径" --destination "尚不存在的新目录的绝对路径"
```

便携版可使用上方列出的内置 Node 路径。工具保留原始数据，将能明确归属的坏记录
隔离，并生成恢复报告；不会猜测还原 `[REDACTED]` 之前的文字，也不会自动重新提交
可能已付费的任务。日志缺行、JSON 损坏等无法安全判明的情况仍会停止。

使用 `VIDEOGEN_DATA_DIR` 指向新目录后启动，再输入供应商密钥。先核对待复核及隔离
记录对应的供应商任务，及时下载结果，再决定是否关联远端 ID 或确认重新付费提交。
不要删除原目录或移动仍被任务引用的视频输出目录。
