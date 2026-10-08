# CSV, template and image-folder import

Select the shared provider, region, model and defaults first. The task editor supports up to 1,000 rows per import; the existing text-only queue continues to support larger batches. Importing or estimating does not create provider jobs. Submission always shows a confirmation; invalid rows block the whole batch before any job is dispatched.

## CSV columns

UTF-8 CSV may have a BOM, quoted commas, escaped double quotes, and multiline quoted prompts. Download an example from the app or use [batch-example.csv](batch-example.csv).

| Column | Behavior |
| --- | --- |
| `prompt` | Prompt text; may contain `{{column_name}}` variables. If empty, use the import template field. |
| `firstFrame`, `lastFrame` | Names or relative paths of images in the selected folder. Import CSV first, then select the image folder. Ambiguous or missing names block submission. |
| `model`, `provider`, `region`, `baseUrl` | Optional row overrides. A changed provider/region uses its own default endpoint unless the row supplies one. Workspace providers still require their workspace URL. |
| `durationSeconds`, `resolution`, `aspectRatio`, `audio`, `seed`, `requestFormat` | Optional model parameter overrides. `audio` accepts `true`, `false`, `1`, `0`. |
| `filename` | Optional output name/prefix; collisions never overwrite existing videos. |
| Other columns | Named template variables; for example `subject` substitutes into `{{subject}}`. |

Missing variables are errors. Text is substituted literally, never evaluated as code. A row with invalid duration, frames, model, price/budget combination or missing files cannot be silently skipped.

## Images and per-task editing

Selecting an image folder without CSV references creates one task per supported JPEG, PNG or WebP. The import template can use `{{filename}}`, `{{stem}}` (filename without extension), and `{{index}}` (starting at 1). Files are sorted by relative path.

In task-editing mode, each row can override prompt, model, duration, resolution, aspect ratio, seed, audio, filename and first/last image. A blank first-frame field inherits the shared frame; the explicit disable control opts that row out. Last frames require a first frame and a model that advertises last-frame support. The generic compatible adapter does not assume tail-frame support.

The browser fits uploads to the row's selected dimensions where a pixel target is available. Images are limited to 25 MiB each (some providers impose lower limits), and an upload request is limited to 128 MiB including payload/overhead. The UI keeps images below 120 MiB per request and reuses an identical fitted file. Split larger folders into batches. Native providers can accept original dimensions through the API where their image limits allow it; compatible endpoints retain exact pixel validation.

## Cost and review

Every row is revalidated and re-estimated server-side when submitted. Dynamic OpenRouter pricing/capabilities come from the model catalog; refresh it before important batches. Unknown costs stay unknown, and different currencies remain separate. A budget requires a known estimate in one currency.

Gallery Keep/Reject choices are local, survive service restarts and do not delete files. Cost per kept clip includes all accepted or possibly accepted attempts in the selected batch, including discarded takes and confirmed regeneration. It uses the kept count of the matching currency; unknown costs or zero kept clips show Unknown. These are estimates, not invoice totals.

Regenerate requests fetch a fresh quote and require an explicit confirmation for one task. Cancel creates nothing. Replaying one confirmation token returns the same new take, including after a restart. Original videos remain untouched. A paused batch stays paused; the new take waits for resume and the required provider key.
