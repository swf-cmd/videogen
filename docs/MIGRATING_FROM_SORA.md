# From Sora2App / Sora 2 to videogen

videogen 2.x keeps a local queue and supports OpenRouter, Gemini, Alibaba Cloud Model Studio, Volcengine / BytePlus Ark, and explicitly configured OpenAI-compatible endpoints. It does not restore the retired Sora integration. There is no default Sora model, legacy OpenAI Batch upload, or assumed Batch discount.

## Move in five steps

1. **Keep your old downloads.** Back up videos, prompts and settings before replacing the old application. Old OpenAI Batch IDs and Files/JSONL submissions cannot become jobs on another provider. This release does not import those task records or recover expired provider files.
2. **Start the new app.** Extract the Windows/macOS portable ZIP and double-click its launcher, or clone the repository and run `npm start` with Node `^22.21.0 || >=24.5.0`. The launcher is now named **Start videogen.command** (macOS) or **Start videogen.cmd** (Windows).
3. **Choose provider, region and model.** Reuse your prompts, then check the selected model's supported duration, size, audio and frame inputs. An OpenAI key does not authenticate another provider. Enter that provider's key; Model Studio also needs your real workspace-specific hostname. See the [provider contracts](providers/).
4. **Prepare and inspect.** Paste prompts or import CSV/template rows and an image folder. Assign first/last frames per job where the model supports them. Fix row errors, review each estimate, and confirm the batch. Unsupported inputs are rejected; unknown prices remain unknown. No migration step creates videos automatically.
5. **Keep and export.** The service downloads results in their original format. Preview them in the gallery, keep/reject takes and review estimated cost per kept clip. Regeneration is a new potentially billable job and requires an explicit confirmation each time.

| Old Sora2App expectation | videogen 2.1 behavior |
| --- | --- |
| One OpenAI key and fixed Sora models | Key and capabilities belong to the selected provider/region/endpoint |
| OpenAI Batch discount | Provider-specific estimates; no assumed discount or currency conversion |
| Browser must stay open | The local service owns the queue; keep its terminal running |
| A failed page means resubmit | Inspect the job. Restart resumes known remote IDs after key re-entry |
| One image for an entire batch | Each row may use its own first frame and supported last frame |
| Outputs silently replaced | Existing files are preserved; collisions get a different name |
| Retry every failed request | Ambiguous creates stop at `needs_review`; only you authorize resubmission |

An ambiguous create might already be charged. Check the provider console before choosing **Confirm not created → resubmit**, **Abandon**, or **Attach remote ID**. Abandoning local tracking does not cancel the provider's task or refund a charge. Gemini background mode saves the interaction ID before polling; a connection failure before the ID is received can still require review.

Keys stay in memory and must be entered again after restart. Prompts, reference images, task state and output paths persist locally. Portable bundles use `portable-data/` and `portable-output/`; source startup uses the OS data directory and `~/Downloads/videogen`. Keep the old downloads until you have verified the migration. See [privacy](../PRIVACY.md), [portable setup](PORTABLE.md), and [中文使用说明](../README.zh-CN.md).
