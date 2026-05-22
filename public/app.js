const form = document.querySelector("#generateForm");
const apiKeyInput = document.querySelector("#apiKey");
const promptInput = document.querySelector("#prompt");
const batchCountField = document.querySelector("#batchCountField");
const batchCountInput = document.querySelector("#batchCount");
const batchCountMeta = document.querySelector("#batchCountMeta");
const modelInput = document.querySelector("#model");
const secondsInput = document.querySelector("#seconds");
const sizeInput = document.querySelector("#size");
const outputDirInput = document.querySelector("#outputDir");
const filenameInput = document.querySelector("#filename");
const generateButton = document.querySelector("#generateButton");
const clearButton = document.querySelector("#clearButton");
const toggleApiKeyButton = document.querySelector("#toggleApiKey");
const selectOutputDirButton = document.querySelector("#selectOutputDir");
const languageInput = document.querySelector("#languageSelect");
const standardModeButton = document.querySelector("#standardModeButton");
const batchModeButton = document.querySelector("#batchModeButton");
const statusText = document.querySelector("#statusText");
const progressText = document.querySelector("#progressText");
const progressBar = document.querySelector("#progressBar");
const videoId = document.querySelector("#videoId");
const outputPath = document.querySelector("#outputPath");
const logBox = document.querySelector("#logBox");
const logCount = document.querySelector("#logCount");
const connectionState = document.querySelector("#connectionState");
const promptLabel = document.querySelector("#promptLabel");
const promptMetaText = document.querySelector("#promptMetaText");
const resultIdLabel = document.querySelector("#resultIdLabel");
const priceLabel = document.querySelector("#priceLabel");
const summaryMode = document.querySelector("#summaryMode");
const summaryModel = document.querySelector("#summaryModel");
const summarySeconds = document.querySelector("#summarySeconds");
const summaryPrice = document.querySelector("#summaryPrice");
const summaryBatchCountItem = document.querySelector("#summaryBatchCountItem");
const summaryBatchCount = document.querySelector("#summaryBatchCount");
const summarySize = document.querySelector("#summarySize");
const isFilePreview = window.location.protocol === "file:";

const storageKeys = {
  language: "sora2app.language",
  mode: "sora2app.mode",
  model: "sora2app.model",
  seconds: "sora2app.seconds",
  size: "sora2app.size",
  batchCount: "sora2app.batchCount",
};
const privateStorageKeys = ["sora2app.outputDir"];

const supportedLanguages = ["zh", "ja", "en", "ko"];
const translations = {
  zh: {
    locale: "zh-CN",
    htmlLang: "zh-CN",
    documentTitle: "Sora 2 工作台",
    brandKicker: "Sora 视频生成器",
    brandTitle: "Sora 2 工作台",
    appAria: "Sora 视频生成器",
    languageLabel: "语言",
    controlsAria: "生成选项",
    monitorAria: "任务状态",
    connectionStandardReady: "标准 API 就绪",
    connectionBatchReady: "Batch API 就绪",
    connectionPreview: "预览模式",
    connectionStandardGenerating: "标准 API 生成中",
    connectionBatchGenerating: "Batch API 生成中",
    connectionCompleted: "已完成",
    connectionError: "出错",
    generateKicker: "生成",
    generationSettings: "生成参数",
    trustNote: "API key 仅用于本次请求",
    apiModeAria: "调用方式",
    modeStandard: "标准 API",
    modeBatch: "Batch API",
    batchDiscount: "-50%",
    apiKeyLabel: "API key",
    showApiKey: "显示",
    hideApiKey: "隐藏",
    showApiKeyAria: "显示 API key",
    hideApiKeyAria: "隐藏 API key",
    promptLabelStandard: "提示词",
    promptLabelBatch: "提示词队列",
    promptPlaceholderStandard: "描述画面、镜头、主体、动作、光线和风格...",
    promptPlaceholderBatch: "每条提示词之间空一行；单条提示词也可以用 Batch API 提交。",
    batchCountLabel: "提交条数",
    batchCountMeta: "最多 {max} 条",
    modelLabel: "模型",
    secondsLabel: "时长",
    sizeLabel: "分辨率",
    outputDirLabel: "输出目录",
    outputDirPlaceholder: "~/Downloads/SoraVideos",
    selectOutputDir: "选择",
    selecting: "选择中",
    filenameLabel: "文件名",
    filenamePlaceholder: "留空会自动生成 mp4 文件名",
    generateButtonStandard: "开始生成",
    generateButtonBatch: "提交 Batch 任务",
    clearStatus: "清空状态",
    statusKicker: "状态",
    taskStatus: "任务状态",
    statusIdle: "等待提交",
    statusSubmitting: "提交中",
    statusQueued: "排队中",
    statusUploading: "上传中",
    statusUploaded: "已上传",
    statusValidating: "准备中",
    statusInProgress: "生成中",
    statusFinalizing: "整理结果中",
    statusDownloading: "下载中",
    statusPartial: "部分失败",
    statusCompleted: "已完成",
    statusFailed: "失败",
    statusCancelled: "已取消",
    statusExpired: "已过期",
    summaryAria: "当前参数",
    summaryMethod: "方式",
    summaryModel: "模型",
    summarySeconds: "时长",
    estimatedPrice: "预估价格",
    batchEstimate: "Batch 预估",
    summaryBatchCount: "提交条数",
    summarySize: "分辨率",
    resultVideoId: "视频 ID",
    resultBatchId: "Batch ID / 视频 ID",
    outputFile: "输出文件",
    runLog: "运行日志",
    logCount: "{count} 条",
    emptyLog: "等待日志...",
    characterCount: "{count} 字符",
    promptCount: "{count} 条提示词 / {chars} 字符；{action}",
    willSubmit: "将提交 {count} 条",
    willSubmitFirst: "将提交前 {count} 条",
    promptQueueOnly: "提示词队列只有 {count} 条",
    secondUnit: "秒",
    requestUnit: "条",
    portrait: "竖屏",
    landscape: "横屏",
    unitSecond: "秒",
    batchPriceNote: "Batch 50% 价格",
    durationEstimate: "按当前时长估算",
    priceTitle: "{rate} / {unit}，{count} 条，{note}",
    noPriceConfig: "当前参数暂无价格配置",
    loadOptionsError: "读取官方选项配置失败，已使用内置兜底：{message}",
    invalidOptionsFormat: "选项配置格式不正确",
    invalidBatchCount: "Batch 提交条数必须是大于 0 的整数。",
    batchTooMany: "Batch 模式一次最多提交 {max} 条。",
    promptQueueTooShort: "提示词队列只有 {count} 条，请降低提交条数；如需重复生成同一提示词，请只保留一条提示词。",
    streamError: "生成失败。",
    eventStatus: "状态 {status}",
    eventProgress: "进度 {progress}%",
    savedMany: "已保存 {count} 个文件{failedSuffix}。",
    failedSuffix: "，{count} 条失败",
    savedOne: "已保存：{path}",
    filePreviewGenerateError: "当前是直接打开 HTML 的预览模式。要生成视频，请双击 Start Sora2App.command 启动本地服务。",
    requestFailed: "请求失败：HTTP {status}",
    submittingLog: "正在提交任务...",
    previewSelectDirError: "预览模式不能选择本机目录，请先启动本地服务。",
    selectDirFailed: "选择目录失败：HTTP {status}",
    selectDirFallbackError: "选择目录失败。",
    selectedOutputDir: "已选择输出目录：{path}",
    previewReadyLog: "预览模式已就绪，界面会正常显示。生成视频请双击 Start Sora2App.command 启动本地服务。",
    readyLog: "本地小程序已就绪。API key 不会保存到本地。",
  },
  ja: {
    locale: "ja-JP",
    htmlLang: "ja",
    documentTitle: "Sora 2 ワークベンチ",
    brandKicker: "Sora 動画生成ツール",
    brandTitle: "Sora 2 ワークベンチ",
    appAria: "Sora 動画生成ツール",
    languageLabel: "言語",
    controlsAria: "生成オプション",
    monitorAria: "タスク状態",
    connectionStandardReady: "標準 API 準備完了",
    connectionBatchReady: "Batch API 準備完了",
    connectionPreview: "プレビューモード",
    connectionStandardGenerating: "標準 API で生成中",
    connectionBatchGenerating: "Batch API で生成中",
    connectionCompleted: "完了",
    connectionError: "エラー",
    generateKicker: "生成",
    generationSettings: "生成設定",
    trustNote: "API key はこのリクエストでのみ使用",
    apiModeAria: "呼び出し方式",
    modeStandard: "標準 API",
    modeBatch: "Batch API",
    batchDiscount: "-50%",
    apiKeyLabel: "API key",
    showApiKey: "表示",
    hideApiKey: "非表示",
    showApiKeyAria: "API key を表示",
    hideApiKeyAria: "API key を非表示",
    promptLabelStandard: "プロンプト",
    promptLabelBatch: "プロンプトキュー",
    promptPlaceholderStandard: "画面、カメラ、被写体、動き、光、スタイルを記述...",
    promptPlaceholderBatch: "各プロンプトは空行で区切ります。1件だけでも Batch API で送信できます。",
    batchCountLabel: "送信件数",
    batchCountMeta: "最大 {max} 件",
    modelLabel: "モデル",
    secondsLabel: "長さ",
    sizeLabel: "解像度",
    outputDirLabel: "出力フォルダ",
    outputDirPlaceholder: "~/Downloads/SoraVideos",
    selectOutputDir: "選択",
    selecting: "選択中",
    filenameLabel: "ファイル名",
    filenamePlaceholder: "空欄の場合は mp4 ファイル名を自動生成",
    generateButtonStandard: "生成開始",
    generateButtonBatch: "Batch タスクを送信",
    clearStatus: "状態をクリア",
    statusKicker: "状態",
    taskStatus: "タスク状態",
    statusIdle: "送信待ち",
    statusSubmitting: "送信中",
    statusQueued: "キュー待ち",
    statusUploading: "アップロード中",
    statusUploaded: "アップロード済み",
    statusValidating: "準備中",
    statusInProgress: "生成中",
    statusFinalizing: "結果を整理中",
    statusDownloading: "ダウンロード中",
    statusPartial: "一部失敗",
    statusCompleted: "完了",
    statusFailed: "失敗",
    statusCancelled: "キャンセル済み",
    statusExpired: "期限切れ",
    summaryAria: "現在の設定",
    summaryMethod: "方式",
    summaryModel: "モデル",
    summarySeconds: "長さ",
    estimatedPrice: "概算料金",
    batchEstimate: "Batch 概算",
    summaryBatchCount: "送信件数",
    summarySize: "解像度",
    resultVideoId: "動画 ID",
    resultBatchId: "Batch ID / 動画 ID",
    outputFile: "出力ファイル",
    runLog: "実行ログ",
    logCount: "{count} 件",
    emptyLog: "ログ待機中...",
    characterCount: "{count} 文字",
    promptCount: "{count} 件のプロンプト / {chars} 文字；{action}",
    willSubmit: "{count} 件を送信",
    willSubmitFirst: "先頭 {count} 件を送信",
    promptQueueOnly: "プロンプトキューは {count} 件のみ",
    secondUnit: "秒",
    requestUnit: "件",
    portrait: "縦",
    landscape: "横",
    unitSecond: "秒",
    batchPriceNote: "Batch 50% 料金",
    durationEstimate: "現在の長さで概算",
    priceTitle: "{rate} / {unit}、{count} 件、{note}",
    noPriceConfig: "現在の設定には料金情報がありません",
    loadOptionsError: "公式オプションの読み込みに失敗したため、内蔵設定を使用します：{message}",
    invalidOptionsFormat: "オプション設定の形式が正しくありません",
    invalidBatchCount: "Batch 送信件数は 1 以上の整数にしてください。",
    batchTooMany: "Batch モードでは一度に最大 {max} 件まで送信できます。",
    promptQueueTooShort: "プロンプトキューは {count} 件のみです。送信件数を減らしてください。同じプロンプトを繰り返す場合は、プロンプトを1件だけ残してください。",
    streamError: "生成に失敗しました。",
    eventStatus: "状態 {status}",
    eventProgress: "進捗 {progress}%",
    savedMany: "{count} 個のファイルを保存しました{failedSuffix}。",
    failedSuffix: "、{count} 件失敗",
    savedOne: "保存しました：{path}",
    filePreviewGenerateError: "HTML を直接開いたプレビューモードです。動画を生成するには Start Sora2App.command をダブルクリックしてローカルサービスを起動してください。",
    requestFailed: "リクエスト失敗：HTTP {status}",
    submittingLog: "タスクを送信しています...",
    previewSelectDirError: "プレビューモードではローカルフォルダを選択できません。先にローカルサービスを起動してください。",
    selectDirFailed: "フォルダ選択に失敗しました：HTTP {status}",
    selectDirFallbackError: "フォルダ選択に失敗しました。",
    selectedOutputDir: "出力フォルダを選択しました：{path}",
    previewReadyLog: "プレビューモードの準備ができました。画面は通常どおり表示されます。生成するには Start Sora2App.command をダブルクリックしてください。",
    readyLog: "ローカルアプリの準備ができました。API key はローカルに保存されません。",
  },
  en: {
    locale: "en-US",
    htmlLang: "en",
    documentTitle: "Sora 2 Workbench",
    brandKicker: "Sora Video Generator",
    brandTitle: "Sora 2 Workbench",
    appAria: "Sora video generator",
    languageLabel: "Language",
    controlsAria: "Generation options",
    monitorAria: "Task status",
    connectionStandardReady: "Standard API ready",
    connectionBatchReady: "Batch API ready",
    connectionPreview: "Preview mode",
    connectionStandardGenerating: "Standard API generating",
    connectionBatchGenerating: "Batch API generating",
    connectionCompleted: "Completed",
    connectionError: "Error",
    generateKicker: "Generate",
    generationSettings: "Generation settings",
    trustNote: "API key is used only for this request",
    apiModeAria: "API mode",
    modeStandard: "Standard API",
    modeBatch: "Batch API",
    batchDiscount: "-50%",
    apiKeyLabel: "API key",
    showApiKey: "Show",
    hideApiKey: "Hide",
    showApiKeyAria: "Show API key",
    hideApiKeyAria: "Hide API key",
    promptLabelStandard: "Prompt",
    promptLabelBatch: "Prompt queue",
    promptPlaceholderStandard: "Describe the scene, camera, subject, action, lighting, and style...",
    promptPlaceholderBatch: "Separate prompts with a blank line. A single prompt can also be submitted with the Batch API.",
    batchCountLabel: "Request count",
    batchCountMeta: "Up to {max} requests",
    modelLabel: "Model",
    secondsLabel: "Duration",
    sizeLabel: "Resolution",
    outputDirLabel: "Output folder",
    outputDirPlaceholder: "~/Downloads/SoraVideos",
    selectOutputDir: "Choose",
    selecting: "Choosing",
    filenameLabel: "Filename",
    filenamePlaceholder: "Leave blank to auto-generate an mp4 filename",
    generateButtonStandard: "Start generation",
    generateButtonBatch: "Submit batch task",
    clearStatus: "Clear status",
    statusKicker: "Status",
    taskStatus: "Task status",
    statusIdle: "Waiting to submit",
    statusSubmitting: "Submitting",
    statusQueued: "Queued",
    statusUploading: "Uploading",
    statusUploaded: "Uploaded",
    statusValidating: "Preparing",
    statusInProgress: "Generating",
    statusFinalizing: "Finalizing",
    statusDownloading: "Downloading",
    statusPartial: "Partially failed",
    statusCompleted: "Completed",
    statusFailed: "Failed",
    statusCancelled: "Cancelled",
    statusExpired: "Expired",
    summaryAria: "Current settings",
    summaryMethod: "Mode",
    summaryModel: "Model",
    summarySeconds: "Duration",
    estimatedPrice: "Estimated price",
    batchEstimate: "Batch estimate",
    summaryBatchCount: "Request count",
    summarySize: "Resolution",
    resultVideoId: "Video ID",
    resultBatchId: "Batch ID / Video ID",
    outputFile: "Output file",
    runLog: "Run log",
    logCount: "{count} lines",
    emptyLog: "Waiting for logs...",
    characterCount: "{count} characters",
    promptCount: "{count} prompts / {chars} characters; {action}",
    willSubmit: "Will submit {count}",
    willSubmitFirst: "Will submit the first {count}",
    promptQueueOnly: "Prompt queue only has {count}",
    secondUnit: "sec",
    requestUnit: "requests",
    portrait: "portrait",
    landscape: "landscape",
    unitSecond: "second",
    batchPriceNote: "Batch 50% price",
    durationEstimate: "Estimated at the current duration",
    priceTitle: "{rate} / {unit}, {count} requests, {note}",
    noPriceConfig: "No price configuration for the current settings",
    loadOptionsError: "Failed to load official options. Using built-in fallback: {message}",
    invalidOptionsFormat: "Options configuration has an invalid format",
    invalidBatchCount: "Batch request count must be an integer greater than 0.",
    batchTooMany: "Batch mode can submit up to {max} requests at once.",
    promptQueueTooShort: "The prompt queue only has {count} prompts. Lower the request count; to repeat one prompt, keep only that prompt.",
    streamError: "Generation failed.",
    eventStatus: "Status {status}",
    eventProgress: "Progress {progress}%",
    savedMany: "Saved {count} files{failedSuffix}.",
    failedSuffix: ", {count} failed",
    savedOne: "Saved: {path}",
    filePreviewGenerateError: "This is preview mode from directly opening the HTML file. To generate video, double-click Start Sora2App.command to start the local service.",
    requestFailed: "Request failed: HTTP {status}",
    submittingLog: "Submitting task...",
    previewSelectDirError: "Preview mode cannot choose a local folder. Start the local service first.",
    selectDirFailed: "Folder selection failed: HTTP {status}",
    selectDirFallbackError: "Folder selection failed.",
    selectedOutputDir: "Selected output folder: {path}",
    previewReadyLog: "Preview mode is ready and the UI will display normally. To generate video, double-click Start Sora2App.command.",
    readyLog: "Local app is ready. The API key is not saved locally.",
  },
  ko: {
    locale: "ko-KR",
    htmlLang: "ko",
    documentTitle: "Sora 2 워크벤치",
    brandKicker: "Sora 동영상 생성기",
    brandTitle: "Sora 2 워크벤치",
    appAria: "Sora 동영상 생성기",
    languageLabel: "언어",
    controlsAria: "생성 옵션",
    monitorAria: "작업 상태",
    connectionStandardReady: "표준 API 준비됨",
    connectionBatchReady: "Batch API 준비됨",
    connectionPreview: "미리보기 모드",
    connectionStandardGenerating: "표준 API 생성 중",
    connectionBatchGenerating: "Batch API 생성 중",
    connectionCompleted: "완료",
    connectionError: "오류",
    generateKicker: "생성",
    generationSettings: "생성 설정",
    trustNote: "API key 는 이번 요청에만 사용됩니다",
    apiModeAria: "호출 방식",
    modeStandard: "표준 API",
    modeBatch: "Batch API",
    batchDiscount: "-50%",
    apiKeyLabel: "API key",
    showApiKey: "표시",
    hideApiKey: "숨기기",
    showApiKeyAria: "API key 표시",
    hideApiKeyAria: "API key 숨기기",
    promptLabelStandard: "프롬프트",
    promptLabelBatch: "프롬프트 대기열",
    promptPlaceholderStandard: "장면, 카메라, 피사체, 동작, 조명, 스타일을 설명하세요...",
    promptPlaceholderBatch: "각 프롬프트는 빈 줄로 구분하세요. 한 개의 프롬프트도 Batch API 로 제출할 수 있습니다.",
    batchCountLabel: "제출 수",
    batchCountMeta: "최대 {max}개",
    modelLabel: "모델",
    secondsLabel: "길이",
    sizeLabel: "해상도",
    outputDirLabel: "출력 폴더",
    outputDirPlaceholder: "~/Downloads/SoraVideos",
    selectOutputDir: "선택",
    selecting: "선택 중",
    filenameLabel: "파일명",
    filenamePlaceholder: "비워두면 mp4 파일명이 자동 생성됩니다",
    generateButtonStandard: "생성 시작",
    generateButtonBatch: "Batch 작업 제출",
    clearStatus: "상태 지우기",
    statusKicker: "상태",
    taskStatus: "작업 상태",
    statusIdle: "제출 대기",
    statusSubmitting: "제출 중",
    statusQueued: "대기 중",
    statusUploading: "업로드 중",
    statusUploaded: "업로드됨",
    statusValidating: "준비 중",
    statusInProgress: "생성 중",
    statusFinalizing: "결과 정리 중",
    statusDownloading: "다운로드 중",
    statusPartial: "일부 실패",
    statusCompleted: "완료",
    statusFailed: "실패",
    statusCancelled: "취소됨",
    statusExpired: "만료됨",
    summaryAria: "현재 설정",
    summaryMethod: "방식",
    summaryModel: "모델",
    summarySeconds: "길이",
    estimatedPrice: "예상 가격",
    batchEstimate: "Batch 예상",
    summaryBatchCount: "제출 수",
    summarySize: "해상도",
    resultVideoId: "동영상 ID",
    resultBatchId: "Batch ID / 동영상 ID",
    outputFile: "출력 파일",
    runLog: "실행 로그",
    logCount: "{count}개",
    emptyLog: "로그 대기 중...",
    characterCount: "{count}자",
    promptCount: "프롬프트 {count}개 / {chars}자; {action}",
    willSubmit: "{count}개 제출 예정",
    willSubmitFirst: "앞의 {count}개 제출 예정",
    promptQueueOnly: "프롬프트 대기열에는 {count}개만 있습니다",
    secondUnit: "초",
    requestUnit: "개",
    portrait: "세로",
    landscape: "가로",
    unitSecond: "초",
    batchPriceNote: "Batch 50% 가격",
    durationEstimate: "현재 길이 기준 예상",
    priceTitle: "{rate} / {unit}, {count}개, {note}",
    noPriceConfig: "현재 설정에 대한 가격 정보가 없습니다",
    loadOptionsError: "공식 옵션을 불러오지 못해 내장 기본값을 사용합니다: {message}",
    invalidOptionsFormat: "옵션 설정 형식이 올바르지 않습니다",
    invalidBatchCount: "Batch 제출 수는 0보다 큰 정수여야 합니다.",
    batchTooMany: "Batch 모드는 한 번에 최대 {max}개까지 제출할 수 있습니다.",
    promptQueueTooShort: "프롬프트 대기열에는 {count}개만 있습니다. 제출 수를 줄여 주세요. 같은 프롬프트를 반복하려면 프롬프트 하나만 남겨 주세요.",
    streamError: "생성에 실패했습니다.",
    eventStatus: "상태 {status}",
    eventProgress: "진행률 {progress}%",
    savedMany: "파일 {count}개를 저장했습니다{failedSuffix}.",
    failedSuffix: ", {count}개 실패",
    savedOne: "저장됨: {path}",
    filePreviewGenerateError: "HTML 파일을 직접 연 미리보기 모드입니다. 동영상을 생성하려면 Start Sora2App.command 를 더블 클릭해 로컬 서비스를 시작하세요.",
    requestFailed: "요청 실패: HTTP {status}",
    submittingLog: "작업을 제출하는 중...",
    previewSelectDirError: "미리보기 모드에서는 로컬 폴더를 선택할 수 없습니다. 먼저 로컬 서비스를 시작하세요.",
    selectDirFailed: "폴더 선택 실패: HTTP {status}",
    selectDirFallbackError: "폴더 선택에 실패했습니다.",
    selectedOutputDir: "출력 폴더 선택됨: {path}",
    previewReadyLog: "미리보기 모드가 준비되었습니다. 화면은 정상적으로 표시됩니다. 생성하려면 Start Sora2App.command 를 더블 클릭하세요.",
    readyLog: "로컬 앱이 준비되었습니다. API key 는 로컬에 저장되지 않습니다.",
  },
};

let activeLanguage = "zh";
let connectionStateKey = isFilePreview ? "connectionPreview" : "connectionStandardReady";
let currentStatus = "idle";
let currentProgress = 0;
let progressTarget = 0;
let progressAnimationFrame = 0;

function normalizeLanguage(language) {
  const base = String(language || "").toLowerCase().split("-")[0];
  return supportedLanguages.includes(base) ? base : "zh";
}

function t(key, replacements = {}) {
  const value = translations[activeLanguage]?.[key] ?? translations.zh[key] ?? key;
  return value.replace(/\{(\w+)\}/g, (_, name) => String(replacements[name] ?? ""));
}

function currentLocale() {
  return translations[activeLanguage]?.locale || "zh-CN";
}

function setText(selector, key, replacements) {
  const element = document.querySelector(selector);
  if (element) element.textContent = t(key, replacements);
}

function setFieldText(selector, key, replacements) {
  const element = document.querySelector(selector);
  const label = element?.querySelector(":scope > span");
  if (label) label.textContent = t(key, replacements);
}

function setFieldTextForInput(input, key, replacements) {
  const label = input?.closest(".field")?.querySelector(":scope > span");
  if (label) label.textContent = t(key, replacements);
}

function setConnectionState(key) {
  connectionStateKey = key;
  connectionState.textContent = t(key);
}

function formatSizeLabel(value) {
  const [width, height] = String(value || "").split("x").map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return value || "-";
  return `${width} x ${height} ${width > height ? t("landscape") : t("portrait")}`;
}

function applyTranslations() {
  document.documentElement.lang = t("htmlLang");
  document.title = t("documentTitle");
  languageInput.value = activeLanguage;
  languageInput.setAttribute("aria-label", t("languageLabel"));
  logBox.dataset.empty = t("emptyLog");

  document.querySelector(".workbench")?.setAttribute("aria-label", t("appAria"));
  document.querySelector(".controls-panel")?.setAttribute("aria-label", t("controlsAria"));
  document.querySelector(".monitor-panel")?.setAttribute("aria-label", t("monitorAria"));
  document.querySelector(".mode-switch")?.setAttribute("aria-label", t("apiModeAria"));
  document.querySelector(".summary-grid")?.setAttribute("aria-label", t("summaryAria"));

  setText(".language-field .sr-only", "languageLabel");
  setText(".brand-copy .eyebrow", "brandKicker");
  setText(".brand-copy h1", "brandTitle");
  setText(".controls-panel .section-kicker", "generateKicker");
  setText(".controls-panel .section-head h2", "generationSettings");
  setText(".trust-note", "trustNote");
  standardModeButton.textContent = t("modeStandard");
  batchModeButton.innerHTML = `${t("modeBatch")} <span class="discount-badge"><span class="money-icon" aria-hidden="true">$</span>${t("batchDiscount")}</span>`;
  promptLabel.textContent = t(apiModes[activeMode].promptLabelKey);
  promptInput.placeholder = t(apiModes[activeMode].promptPlaceholderKey);
  generateButton.textContent = t(apiModes[activeMode].buttonLabelKey);
  setFieldText(".secret-field", "apiKeyLabel");
  setFieldText("#batchCountField", "batchCountLabel");
  setFieldTextForInput(modelInput, "modelLabel");
  setFieldTextForInput(secondsInput, "secondsLabel");
  setFieldTextForInput(sizeInput, "sizeLabel");
  setFieldTextForInput(outputDirInput, "outputDirLabel");
  setFieldTextForInput(filenameInput, "filenameLabel");
  outputDirInput.placeholder = t("outputDirPlaceholder");
  filenameInput.placeholder = t("filenamePlaceholder");
  selectOutputDirButton.textContent = t("selectOutputDir");
  selectOutputDirButton.setAttribute("aria-label", t("selectOutputDir"));
  clearButton.textContent = t("clearStatus");
  setText(".monitor-panel .section-kicker", "statusKicker");
  setText(".monitor-panel .section-head h2", "taskStatus");
  setText(".summary-item:nth-child(1) span", "summaryMethod");
  setText(".summary-item:nth-child(2) span", "summaryModel");
  setText(".summary-item:nth-child(3) span", "summarySeconds");
  setText("#summaryBatchCountItem span", "summaryBatchCount");
  setText(".span-summary span", "summarySize");
  resultIdLabel.textContent = t(activeMode === "batch" ? "resultBatchId" : "resultVideoId");
  const outputFileLabel = outputPath.closest(".job-card")?.querySelector("span");
  if (outputFileLabel) outputFileLabel.textContent = t("outputFile");
  setText(".log-head span:first-child", "runLog");

  const isHidden = apiKeyInput.type === "password";
  toggleApiKeyButton.textContent = isHidden ? t("showApiKey") : t("hideApiKey");
  toggleApiKeyButton.setAttribute("aria-label", isHidden ? t("showApiKeyAria") : t("hideApiKeyAria"));
  setConnectionState(connectionStateKey);
  setProgress(currentStatus, currentProgress);
  syncBatchCountBounds(false);
  updatePromptMeta();
  updateSummary();
}

function setLanguage(language, shouldPersist = true) {
  activeLanguage = normalizeLanguage(language);
  applyTranslations();
  syncOptionControls();
  if (shouldPersist) {
    localStorage.setItem(storageKeys.language, activeLanguage);
  }
}

const apiModes = {
  standard: {
    labelKey: "modeStandard",
    endpoint: "/api/generate-stream",
    priceMultiplier: 1,
    promptLabelKey: "promptLabelStandard",
    promptPlaceholderKey: "promptPlaceholderStandard",
    resultLabelKey: "resultVideoId",
    buttonLabelKey: "generateButtonStandard",
  },
  batch: {
    labelKey: "modeBatch",
    endpoint: "/api/generate-batch-stream",
    priceMultiplier: 0.5,
    promptLabelKey: "promptLabelBatch",
    promptPlaceholderKey: "promptPlaceholderBatch",
    resultLabelKey: "resultBatchId",
    buttonLabelKey: "generateButtonBatch",
  },
};
let activeMode = "standard";

const fallbackOfficialOptions = {
  defaults: {
    model: "sora-2",
    seconds: "4",
    size: "720x1280",
  },
  seconds: ["4", "8", "12", "16", "20"],
  models: [
    {
      value: "sora-2",
      label: "Sora 2",
      sizes: [
        { value: "720x1280", label: "720 x 1280 竖屏" },
        { value: "1280x720", label: "1280 x 720 横屏" },
      ],
    },
    {
      value: "sora-2-pro",
      label: "Sora 2 Pro",
      sizes: [
        { value: "720x1280", label: "720 x 1280 竖屏" },
        { value: "1280x720", label: "1280 x 720 横屏" },
        { value: "1024x1792", label: "1024 x 1792 竖屏" },
        { value: "1792x1024", label: "1792 x 1024 横屏" },
        { value: "1080x1920", label: "1080 x 1920 竖屏" },
        { value: "1920x1080", label: "1920 x 1080 横屏" },
      ],
    },
  ],
  pricing: {
    currency: "USD",
    unit: "second",
    standard: {
      "sora-2": {
        "720x1280": 0.1,
        "1280x720": 0.1,
      },
      "sora-2-pro": {
        "720x1280": 0.3,
        "1280x720": 0.3,
        "1024x1792": 0.5,
        "1792x1024": 0.5,
        "1080x1920": 0.7,
        "1920x1080": 0.7,
      },
    },
  },
  batch: {
    maxRequests: 50000,
    maxInputFileBytes: 200 * 1024 * 1024,
  },
};
let officialOptions = fallbackOfficialOptions;
let isBatchCountUserEdited = false;

function formatInteger(value) {
  return new Intl.NumberFormat(currentLocale()).format(value);
}

function maxBatchRequests() {
  const value = Number(officialOptions.batch?.maxRequests);
  return Number.isInteger(value) && value > 0 ? value : fallbackOfficialOptions.batch.maxRequests;
}

function readBatchCount() {
  const value = Number(batchCountInput.value);
  if (!Number.isInteger(value) || value < 1) return 1;
  return Math.min(value, maxBatchRequests());
}

function syncBatchCountBounds(shouldClamp = true) {
  const max = maxBatchRequests();
  batchCountInput.max = String(max);
  batchCountMeta.textContent = t("batchCountMeta", { max: formatInteger(max) });
  if (!shouldClamp) return;
  batchCountInput.value = String(readBatchCount());
}

function syncBatchCountWithPromptQueue() {
  if (activeMode !== "batch" || isBatchCountUserEdited) return;
  const promptCount = parsePromptItems().length;
  batchCountInput.value = String(Math.max(1, promptCount));
  syncBatchCountBounds();
}

function requestCountForEstimate() {
  if (activeMode !== "batch") return Math.max(1, parsePromptItems().length);
  return readBatchCount();
}

function hasOptionValue(select, value) {
  return [...select.options].some((option) => option.value === value);
}

function renderSelectOptions(select, options, selectedValue, fallbackValue = "") {
  select.textContent = "";
  for (const option of options) {
    const element = document.createElement("option");
    const value = typeof option === "string" ? option : option.value;
    element.value = value;
    element.textContent = typeof option === "string" ? `${option} ${t("secondUnit")}` : formatSizeLabel(value);
    element.selected = value === selectedValue;
    select.appendChild(element);
  }
  if (!hasOptionValue(select, selectedValue)) {
    select.value = hasOptionValue(select, fallbackValue) ? fallbackValue : select.options[0]?.value || "";
  }
}

function renderModelOptions(selectedValue) {
  modelInput.textContent = "";
  for (const model of officialOptions.models) {
    const element = document.createElement("option");
    element.value = model.value;
    element.textContent = model.label || model.value;
    element.selected = model.value === selectedValue;
    modelInput.appendChild(element);
  }
  if (!hasOptionValue(modelInput, selectedValue)) {
    modelInput.value = officialOptions.defaults.model;
  }
}

function selectedModelConfig() {
  return officialOptions.models.find((model) => model.value === modelInput.value) || officialOptions.models[0];
}

function selectedSizeLabel() {
  const model = selectedModelConfig();
  const value = model?.sizes?.find((size) => size.value === sizeInput.value)?.value || sizeInput.value;
  return formatSizeLabel(value);
}

function selectedPrice() {
  const pricing = officialOptions.pricing || fallbackOfficialOptions.pricing;
  const rate = pricing?.standard?.[modelInput.value]?.[sizeInput.value];
  const seconds = Number(secondsInput.value);
  if (!Number.isFinite(rate) || !Number.isFinite(seconds)) return null;
  const requestCount = requestCountForEstimate();
  const multiplier = apiModes[activeMode].priceMultiplier;
  return {
    total: rate * seconds * requestCount * multiplier,
    standardTotal: rate * seconds * requestCount,
    rate,
    requestCount,
    multiplier,
    currency: pricing.currency || "USD",
    unit: pricing.unit || "second",
  };
}

function formatUsd(amount) {
  return new Intl.NumberFormat(currentLocale(), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function updateSummary() {
  const model = selectedModelConfig();
  const price = selectedPrice();
  summaryMode.textContent = t(apiModes[activeMode].labelKey);
  summaryModel.textContent = model?.label || modelInput.value || "-";
  summarySeconds.textContent = secondsInput.value ? `${secondsInput.value} ${t("secondUnit")}` : "-";
  summaryPrice.textContent = price ? formatUsd(price.total) : "-";
  summaryPrice.title = price
    ? t("priceTitle", {
        rate: formatUsd(price.rate),
        unit: price.unit === "second" ? t("unitSecond") : price.unit,
        count: formatInteger(price.requestCount),
        note: activeMode === "batch" ? t("batchPriceNote") : t("durationEstimate"),
      })
    : t("noPriceConfig");
  priceLabel.textContent = activeMode === "batch" ? t("batchEstimate") : t("estimatedPrice");
  summaryBatchCountItem.hidden = activeMode !== "batch";
  summaryBatchCount.textContent = `${formatInteger(requestCountForEstimate())} ${t("requestUnit")}`;
  summarySize.textContent = selectedSizeLabel();
}

function parsePromptItems() {
  const value = promptInput.value.trim();
  if (!value) return [];
  if (activeMode !== "batch") return [value];
  return value
    .split(/\n\s*\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function updatePromptMeta() {
  const charCount = promptInput.value.trim().length;
  if (activeMode === "batch") {
    const count = parsePromptItems().length;
    const requestedCount = readBatchCount();
    const actionText = count <= 1
      ? t("willSubmit", { count: formatInteger(requestedCount) })
      : requestedCount <= count
        ? t("willSubmitFirst", { count: formatInteger(requestedCount) })
        : t("promptQueueOnly", { count: formatInteger(count) });
    promptMetaText.textContent = t("promptCount", {
      count: formatInteger(count),
      chars: formatInteger(charCount),
      action: actionText,
    });
    return;
  }
  promptMetaText.textContent = t("characterCount", { count: formatInteger(charCount) });
}

function updateLogCount() {
  const count = logBox.children.length;
  logCount.textContent = t("logCount", { count: formatInteger(count) });
}

function syncOptionControls(preferredSize = "") {
  const selectedSeconds = secondsInput.value;
  const selectedSize = preferredSize || sizeInput.value;
  const selectedModelValue = modelInput.value;
  renderModelOptions(selectedModelValue);
  const modelOptions = new Map(officialOptions.models.map((model) => [model.value, model]));
  const selectedModel = modelOptions.has(modelInput.value) ? modelInput.value : officialOptions.defaults.model;
  modelInput.value = selectedModel;

  const selectedModelSizes = modelOptions.get(selectedModel).sizes;
  renderSelectOptions(secondsInput, officialOptions.seconds, selectedSeconds, officialOptions.defaults.seconds);
  renderSelectOptions(sizeInput, selectedModelSizes, selectedSize, officialOptions.defaults.size);
  updateSummary();
}

async function loadOfficialOptions() {
  if (isFilePreview) {
    officialOptions = fallbackOfficialOptions;
    return;
  }

  try {
    const response = await fetch("/api/options", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const options = await response.json();
    if (!Array.isArray(options.models) || !Array.isArray(options.seconds) || !options.defaults) {
      throw new Error(t("invalidOptionsFormat"));
    }
    officialOptions = {
      ...fallbackOfficialOptions,
      ...options,
      batch: {
        ...fallbackOfficialOptions.batch,
        ...(options.batch || {}),
      },
    };
  } catch (error) {
    appendLog(t("loadOptionsError", { message: error.message }), "error");
    officialOptions = fallbackOfficialOptions;
  }
}

const statusLabels = {
  idle: "statusIdle",
  submitting: "statusSubmitting",
  queued: "statusQueued",
  uploading: "statusUploading",
  uploaded: "statusUploaded",
  validating: "statusValidating",
  in_progress: "statusInProgress",
  processing: "statusInProgress",
  running: "statusInProgress",
  finalizing: "statusFinalizing",
  downloading: "statusDownloading",
  partial: "statusPartial",
  completed: "statusCompleted",
  failed: "statusFailed",
  cancelled: "statusCancelled",
  expired: "statusExpired",
};

function formatStatus(status) {
  return statusLabels[status] ? t(statusLabels[status]) : status;
}

function shouldResetProgress(status) {
  return status === "idle" || status === "submitting";
}

function shouldFreezeProgress(status) {
  return status === "failed" || status === "cancelled" || status === "expired";
}

function paintProgress(value) {
  progressText.textContent = `${Math.round(value)}%`;
  progressBar.style.width = `${value}%`;
}

function stopProgressAnimation() {
  if (!progressAnimationFrame) return;
  cancelAnimationFrame(progressAnimationFrame);
  progressAnimationFrame = 0;
}

function animateProgress(targetValue) {
  stopProgressAnimation();
  progressTarget = targetValue;
  const startValue = currentProgress;
  const delta = targetValue - startValue;
  if (delta <= 0) {
    currentProgress = targetValue;
    paintProgress(currentProgress);
    return;
  }

  const startTime = performance.now();
  const duration = Math.min(1800, Math.max(450, delta * 24));
  const step = (now) => {
    const elapsed = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - elapsed, 3);
    currentProgress = startValue + delta * eased;
    paintProgress(currentProgress);
    if (elapsed < 1) {
      progressAnimationFrame = requestAnimationFrame(step);
      return;
    }
    progressAnimationFrame = 0;
    currentProgress = targetValue;
    paintProgress(currentProgress);
  };
  progressAnimationFrame = requestAnimationFrame(step);
}

function setProgress(status, progress = 0) {
  const value = Math.max(0, Math.min(100, Number(progress) || 0));
  const displayValue = shouldResetProgress(status)
    ? value
    : shouldFreezeProgress(status)
      ? Math.max(value, currentProgress)
      : Math.max(value, currentProgress, progressTarget);
  currentStatus = status;
  statusText.textContent = formatStatus(status);
  if (shouldResetProgress(status) || shouldFreezeProgress(status) || displayValue <= currentProgress + 1) {
    stopProgressAnimation();
    progressTarget = displayValue;
    currentProgress = displayValue;
    paintProgress(currentProgress);
    return;
  }
  animateProgress(displayValue);
}

function appendLog(message, tone = "") {
  const line = document.createElement("div");
  line.className = tone ? `log-line-${tone}` : "";
  line.textContent = `[${new Date().toLocaleTimeString(currentLocale())}] ${message}`;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
  updateLogCount();
}

function outputDisplayPath(output) {
  return output?.displayPaths?.join("\n") || output?.displayPath || output?.paths?.join("\n") || output?.path || "-";
}

function readForm() {
  return {
    language: activeLanguage,
    mode: activeMode,
    apiKey: apiKeyInput.value.trim(),
    prompt: promptInput.value.trim(),
    model: modelInput.value,
    seconds: secondsInput.value,
    size: sizeInput.value,
    batchCount: batchCountInput.value,
    outputDir: outputDirInput.value.trim(),
    filename: filenameInput.value.trim(),
  };
}

function validateBatchSelection(payload) {
  if (payload.mode !== "batch") return;
  const max = maxBatchRequests();
  const requestedCount = Number(payload.batchCount);
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    throw new Error(t("invalidBatchCount"));
  }
  if (requestedCount > max) {
    throw new Error(t("batchTooMany", { max: formatInteger(max) }));
  }
  const promptCount = parsePromptItems().length;
  if (promptCount > 1 && requestedCount > promptCount) {
    throw new Error(t("promptQueueTooShort", { count: formatInteger(promptCount) }));
  }
}

function persistSettings() {
  const payload = readForm();
  for (const key of Object.keys(storageKeys)) {
    if (key === "batchCount" && payload.mode !== "batch") continue;
    localStorage.setItem(storageKeys[key], payload[key] || "");
  }
}

function forgetPrivateSettings() {
  for (const key of privateStorageKeys) {
    localStorage.removeItem(key);
  }
}

function restoreSettings() {
  const restored = {};
  for (const [key, storageKey] of Object.entries(storageKeys)) {
    const value = localStorage.getItem(storageKey);
    if (!value) continue;
    restored[key] = value;
    if (key === "language") continue;
    if (key === "mode") continue;
    if (key === "size") continue;
    const input = document.querySelector(`#${key}`);
    if (input) input.value = value;
  }
  return restored;
}

function setApiMode(mode, shouldPersist = true) {
  activeMode = apiModes[mode] ? mode : "standard";
  document.body.classList.toggle("batch-mode", activeMode === "batch");

  for (const button of [standardModeButton, batchModeButton]) {
    const isActive = button.dataset.mode === activeMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  const modeConfig = apiModes[activeMode];
  batchCountField.hidden = activeMode !== "batch";
  batchCountInput.disabled = activeMode !== "batch";
  syncBatchCountWithPromptQueue();
  syncBatchCountBounds();
  promptLabel.textContent = t(modeConfig.promptLabelKey);
  promptInput.placeholder = t(modeConfig.promptPlaceholderKey);
  resultIdLabel.textContent = t(modeConfig.resultLabelKey);
  generateButton.textContent = t(modeConfig.buttonLabelKey);
  setConnectionState(isFilePreview ? "connectionPreview" : activeMode === "batch" ? "connectionBatchReady" : "connectionStandardReady");
  applyTranslations();
  updatePromptMeta();
  updateSummary();

  if (shouldPersist) {
    localStorage.setItem(storageKeys.mode, activeMode);
  }
}

function applyStreamEvent(event) {
  if (event.type === "error") {
    throw new Error(event.error?.message || t("streamError"));
  }
  if (event.batchId) videoId.textContent = event.batchId;
  if (event.id) videoId.textContent = event.id;
  if (event.status) setProgress(event.status, event.progress ?? currentProgress);
  if (event.message) {
    const parts = [event.message];
    if (event.status) parts.push(t("eventStatus", { status: formatStatus(event.status) }));
    if (event.progress !== undefined) parts.push(t("eventProgress", { progress: event.progress }));
    appendLog(parts.join(" / "));
  }
  if (event.type === "done") {
    const doneId = event.batch?.id || event.video?.id || event.videos?.[0]?.id || "-";
    videoId.textContent = doneId;
    outputPath.textContent = outputDisplayPath(event.output);
    setProgress("completed", 100);
    const failedSuffix = event.output?.failedCount ? t("failedSuffix", { count: formatInteger(event.output.failedCount) }) : "";
    appendLog(event.output?.paths
      ? t("savedMany", { count: formatInteger(event.output.paths.length), failedSuffix })
      : t("savedOne", { path: outputDisplayPath(event.output) }), "ok");
    setConnectionState("connectionCompleted");
  }
}

async function streamGenerate(payload) {
  if (isFilePreview) {
    throw new Error(t("filePreviewGenerateError"));
  }

  const response = await fetch(apiModes[payload.mode || activeMode].endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sora-language": activeLanguage },
    body: JSON.stringify(payload),
  });
  if (!response.ok || !response.body) {
    throw new Error(t("requestFailed", { status: response.status }));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      applyStreamEvent(JSON.parse(line));
    }
  }

  if (buffer.trim()) {
    applyStreamEvent(JSON.parse(buffer));
  }
}

async function generateVideo(event) {
  event.preventDefault();
  const payload = readForm();
  persistSettings();
  generateButton.disabled = true;
  clearButton.disabled = true;
  setConnectionState(payload.mode === "batch" ? "connectionBatchGenerating" : "connectionStandardGenerating");
  videoId.textContent = "-";
  outputPath.textContent = "-";
  setProgress("submitting", 0);
  appendLog(t("submittingLog"));

  try {
    validateBatchSelection(payload);
    await streamGenerate(payload);
  } catch (error) {
    setProgress("failed", currentProgress);
    appendLog(error.message, "error");
    setConnectionState("connectionError");
  } finally {
    generateButton.disabled = false;
    clearButton.disabled = false;
  }
}

function clearStatus() {
  logBox.textContent = "";
  updateLogCount();
  videoId.textContent = "-";
  outputPath.textContent = "-";
  setConnectionState(isFilePreview ? "connectionPreview" : activeMode === "batch" ? "connectionBatchReady" : "connectionStandardReady");
  setProgress("idle", 0);
}

function toggleApiKeyVisibility() {
  const isHidden = apiKeyInput.type === "password";
  apiKeyInput.type = isHidden ? "text" : "password";
  toggleApiKeyButton.textContent = isHidden ? t("hideApiKey") : t("showApiKey");
  toggleApiKeyButton.setAttribute("aria-label", isHidden ? t("hideApiKeyAria") : t("showApiKeyAria"));
  apiKeyInput.focus();
}

async function selectOutputDirectory() {
  if (isFilePreview) {
    appendLog(t("previewSelectDirError"), "error");
    return;
  }

  const previousText = selectOutputDirButton.textContent;
  selectOutputDirButton.disabled = true;
  selectOutputDirButton.textContent = t("selecting");

  try {
    const response = await fetch("/api/select-output-dir", {
      method: "POST",
      headers: { "x-sora-language": activeLanguage },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error?.message || data.message || t("selectDirFailed", { status: response.status }));
    }
    if (!data.path) return;
    outputDirInput.value = data.displayPath || data.path;
    persistSettings();
    appendLog(t("selectedOutputDir", { path: data.displayPath || data.path }), "ok");
  } catch (error) {
    appendLog(error.message || t("selectDirFallbackError"), "error");
  } finally {
    selectOutputDirButton.disabled = false;
    selectOutputDirButton.textContent = previousText;
  }
}

async function init() {
  forgetPrivateSettings();
  const restored = restoreSettings();
  setLanguage(restored.language || navigator.language || "zh", false);
  await loadOfficialOptions();
  isBatchCountUserEdited = Boolean(restored.mode === "batch" && restored.batchCount && restored.batchCount !== "1");
  syncBatchCountBounds();
  setApiMode(restored.mode || "standard", false);
  syncOptionControls(restored.size || officialOptions.defaults.size);
  updatePromptMeta();
  updateLogCount();
  setProgress("idle", 0);
  if (isFilePreview) {
    setConnectionState("connectionPreview");
    appendLog(t("previewReadyLog"), "ok");
    return;
  }
  appendLog(t("readyLog"), "ok");
}

form.addEventListener("submit", generateVideo);
clearButton.addEventListener("click", clearStatus);
toggleApiKeyButton.addEventListener("click", toggleApiKeyVisibility);
selectOutputDirButton.addEventListener("click", selectOutputDirectory);
languageInput.addEventListener("change", () => setLanguage(languageInput.value));
promptInput.addEventListener("input", () => {
  syncBatchCountWithPromptQueue();
  updatePromptMeta();
  updateSummary();
});
batchCountInput.addEventListener("input", () => {
  isBatchCountUserEdited = true;
  syncBatchCountBounds(false);
  updatePromptMeta();
  updateSummary();
});
batchCountInput.addEventListener("change", () => {
  isBatchCountUserEdited = true;
  syncBatchCountBounds();
  updatePromptMeta();
  updateSummary();
  persistSettings();
});
standardModeButton.addEventListener("click", () => setApiMode("standard"));
batchModeButton.addEventListener("click", () => setApiMode("batch"));
modelInput.addEventListener("change", () => {
  syncOptionControls();
  persistSettings();
});
for (const input of [secondsInput, sizeInput, outputDirInput]) {
  input.addEventListener("change", () => {
    updateSummary();
    persistSettings();
  });
}

init();
