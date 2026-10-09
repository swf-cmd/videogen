# CSV, template and image-folder import

Select the shared provider, region, model and defaults first. The task editor supports up to 1,000 rows per import; the existing text-only queue continues to support larger batches. Importing or estimating does not create provider jobs. Submission always shows a confirmation; invalid rows block the whole batch before any job is dispatched.

## CSV columns

UTF-8 CSV may have a BOM, quoted commas, escaped double quotes, and multiline quoted prompts. Invalid UTF-8 is rejected rather than imported as replacement characters. If Excel exported GBK, Shift_JIS or CP949, use its **CSV UTF-8** format or convert the file to UTF-8 before importing. Download an example from the app or use [batch-example.csv](batch-example.csv); it uses plain prompts, so it imports correctly with the default settings.

| Column | Behavior |
| --- | --- |
| `prompt` | Prompt text, sent exactly as written unless template expansion is turned on (see below). If empty, the import template field fills the row. |
| `firstFrame`, `lastFrame` | Names or relative paths of images in the selected folder. Import CSV first, then select the image folder. Ambiguous or missing names block submission. |
| `model`, `provider`, `region`, `baseUrl` | Optional row overrides. A changed provider/region uses its own default endpoint unless the row supplies one. Workspace providers still require their workspace URL. |
| `durationSeconds`, `resolution`, `aspectRatio`, `audio`, `seed`, `requestFormat` | Optional model parameter overrides. `audio` accepts `true`, `false`, `1`, `0`. |
| `filename` | Optional output name/prefix; collisions never overwrite existing videos. |
| Other columns | Named template variables; for example `subject` substitutes into `{{subject}}` when template expansion is on. |

Spreadsheet quirks that are accepted: comma or semicolon delimiters (and Excel's `sep=;` first line), case-insensitive header names, empty header cells at the end of the header row (`prompt,filename,`) as long as the cells below them are empty, and spaces between a delimiter and an opening quote (`a, "b, c"`). Error messages name the **line** of the file, which differs from the row number when a quoted prompt spans several lines.

## Templates

**Literal mode is the default.** A CSV prompt such as `A cinematic shot of {{subject}}` is sent with the braces unchanged unless **Expand template variables in CSV prompts** is ticked before importing. When an imported prompt contains `{{name}}` and `name` is one of the CSV's columns (or `index`), the editor shows a warning with **Expand variables and re-import**, which ticks the option and imports the same file again. The warning disappears once you edit the imported rows, so the re-import cannot overwrite your changes.

```csv
prompt,subject,filename
"A cinematic shot of {{subject}}",a quiet forest,forest
"A cinematic shot of {{subject}}",a sunlit garden,garden
```

With expansion on, the rows become `A cinematic shot of a quiet forest` and `A cinematic shot of a sunlit garden`. The import template field fills rows whose `prompt` cell is empty and always expands variables.

`{{index}}` is the 1-based row number. If the CSV has its own `index` column, `{{index}}` uses that column's value instead. Missing variables are errors. Text is substituted literally, never evaluated as code, and substituted values are not expanded again. A row with invalid duration, frames, model, price/budget combination or missing files cannot be silently skipped.

## Takes per prompt

**Takes per prompt** (1–20, default 1) renders every prompt or task row that many times. The estimate, the confirmation and the budget all count every take: four rows with three takes are twelve jobs. Each take keeps its row's settings and frames; files with a `filename` get a `-t1`, `-t2`… suffix. The gallery groups takes by shot (source row) and labels them **Shot N · Take M**.

## Images and per-task editing

Selecting an image folder without CSV references creates one task per supported JPEG, PNG or WebP. The import template can use `{{filename}}`, `{{stem}}` (filename without extension), and `{{index}}` (starting at 1). Files are sorted by relative path.

In task-editing mode, each row can override prompt, model, duration, resolution, aspect ratio, seed, audio, filename and first/last image. A blank first-frame field inherits the shared frame; the explicit disable control opts that row out. Last frames require a first frame and a model that advertises last-frame support. The generic compatible adapter does not assume tail-frame support.

The browser fits uploads to the row's selected dimensions where a pixel target is available. An image that already has exactly the target size is uploaded unchanged. Phone photos with an EXIF rotation are redrawn upright first, so the provider receives the orientation you saw in the preview. Images are limited to 25 MiB each (some providers impose lower limits), and an upload request is limited to 128 MiB including payload/overhead. Submission shows **Preparing images i/N**, reuses one fitted file for identical frames, and stops as soon as the images would exceed 120 MiB; split larger folders into batches. Native providers can accept original dimensions through the API where their image limits allow it; compatible endpoints retain exact pixel validation.

## Cost and review

Every row is revalidated and re-estimated server-side when submitted. Dynamic OpenRouter pricing/capabilities come from the model catalog; refresh it before important batches. Unknown costs stay unknown, and different currencies remain separate. A budget requires a known estimate in one currency.

Gallery Keep/Reject choices are local, survive service restarts and do not delete files. With focus in the gallery, **J/K** or **←/→** move between takes, **Space** plays or pauses, **1** keeps, **2** rejects, **3** or **U** resets to unreviewed, and **Enter** enlarges a take. After Keep or Reject the next unreviewed take is focused. Cost per kept clip includes all accepted or possibly accepted attempts in the selected batch, including discarded takes and confirmed regeneration. It uses the kept count of the matching currency; unknown costs or zero kept clips show Unknown. These are estimates, not invoice totals.

**Export kept (CSV)** downloads a manifest of the kept takes for the selected batch (or all batches), with absolute output paths, prompt, model, parameters, shot, take, estimated cost and SHA-256. More export options offer JSON and all finished takes.

Regenerate requests fetch a fresh quote and require an explicit confirmation for one task. Cancel creates nothing. Replaying one confirmation token returns the same new take, including after a restart. Original videos remain untouched. A paused batch stays paused; the new take waits for resume and the required provider key. A take that would exceed the batch budget is refused instead of waiting forever.
