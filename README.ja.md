# videogen

ローカルで動く AI 動画のバッチ制作ツール。ショットごとの開始・終了フレーム、CSV とテンプレート変数、ギャラリーでの選別、自動ダウンロード、再起動からの復旧に対応します。利用するプロバイダーの API キーを用意してください。

[English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

[![オフライン操作デモ](docs/media/videogen-workflow.gif)](docs/media/videogen-workflow.webm)

[操作録画](docs/media/videogen-workflow.webm) · [再生テスト用クリップ](docs/media/offline-preview.mp4) · [Sora 2 からの移行](docs/MIGRATING_FROM_SORA.md)

録画はローカルのテスト素材を使っています。サンプルは再生確認用に作成した映像で、**AI モデルの生成品質を示すものではありません**。有料 API によるサンプル生成は行っていません。

## 起動

**インストール不要版：** [Releases](https://github.com/swf-cmd/videogen/releases) から Windows x64 または macOS universal の ZIP をダウンロードし、書き込み可能なフォルダーにすべて展開します。Windows は **Start videogen.cmd**、Mac は **Start videogen.command** をダブルクリックしてください。Node 24 LTS が同梱され、Apple Silicon と Intel Mac の両方に対応します。公開前で ZIP がない場合はソース版を使用できます。

OS が初回起動の確認を求めることがあります。macOS では「システム設定 → プライバシーとセキュリティ → このまま開く」を確認してください。この ZIP は公証済みの `.app` ではありません。詳細とチェックサムは [ポータブル版の説明](docs/PORTABLE.md) を参照してください。

**ソース版：** Node `^22.21.0 || >=24.5.0` が必要です。Node 18、20、23 は非対応です。`npm install` は不要です。

```bash
git clone https://github.com/swf-cmd/videogen.git
cd videogen
npm start
```

表示されたローカル URL（通常 `http://127.0.0.1:5177`）を開きます。処理中はターミナルを開いたままにし、停止するときは Ctrl+C を押し、進行中の処理の記録が終わるまで最大 15 秒待ってください。保存先にはハードリンクが必要で、exFAT は非対応です。ブラウザーを閉じてもサービスのキューは動作します。ポータブル版の記録は `portable-data/`、動画は `portable-output/` に保存されます。ソース版の動画保存先は `~/Downloads/videogen` です。

## バッチの作成と選別

[CSV 列・テンプレート・画像の対応付け](docs/BATCH_IMPORT.md)にコピー可能な例があります。

1. プロバイダー・地域・モデルを選びます。互換サーバーは正確な URL、モデル ID、対応機能とリクエスト形式を指定してください。Model Studio はワークスペース専用ホスト名が必要です。
2. その接続先の API キーを保存します。キーはサービスのメモリーだけに保持され、終了すると消去されます。再起動後は再入力してください。
3. 空行で区切ったプロンプトを入力するか、UTF-8 CSV・テンプレート・画像フォルダーを取り込みます。各行に開始フレームを指定でき、モデルが対応する場合は終了フレームも指定できます。
4. 行ごとの検証結果と費用の見積もりを確認し、明示的にバッチを送信します。不明な料金は「不明」と表示され、通貨は別々に集計されます。
5. 完成した動画をギャラリーで再生し、「保持」「除外」を選びます。保持した動画 1 本当たりの推定費用を確認できます。再生成は毎回確認が必要で、新たなプロバイダー料金が発生する場合があります。

予算は今後のジョブ送信を見積もりで制限するもので、請求額の保証ではありません。残高不足やモデル権限エラーによる停止中も、送信済みジョブのポーリングとダウンロードは継続します。動画は元のバイト列を保ち、同名ファイルを上書きしません。

## 復旧とプロバイダー

生成要求の結果が不明なジョブは `needs_review` となり、自動で再送信されません。プロバイダーの管理画面を確認してから、「未作成を確認して再送信」「追跡を放棄」「既存のリモート ID を関連付ける」のいずれかを選択してください。追跡の放棄は返金やリモート処理のキャンセルではありません。

Gemini は `background: true` で interaction ID を先に保存し、再起動後もポーリングを再開します。ID を受け取る前に通信が切れた場合は、手動確認が必要になる可能性が残ります。OpenRouter はモデルが対応を宣言した場合にローカル画像を data URL で `frame_images` に渡し、モデル一覧の機能と料金に従います。

対応先は OpenRouter、Gemini、Alibaba Cloud Model Studio、Volcengine / BytePlus Ark、設定済みの OpenAI 互換サーバーです。アカウント、地域、モデルの許可、料金は各サービスの条件に従います。[機能・料金と地域条件の詳細](README.md#providers-and-estimates) · [プロバイダー仕様](docs/providers/)

## ローカルデータと開発

プロンプト、参照画像、タスク状態、選別結果、出力パスはローカルに保存されます。生成時には選択したプロバイダーにプロンプト・画像が送信されます。プロジェクト運営のクラウド、テレメトリー、更新チェックはありません。フォルダーを共有する前に私的データがないことを確認してください。[プライバシー](PRIVACY.md)

`VIDEOGEN_DATA_DIR` と `VIDEOGEN_OUTPUT_DIR` で保存先を変更できます。プロキシには `HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY` を使用し、ローカル通信はプロキシを迂回します。詳細は [英語版](README.md#proxy-configuration) を参照してください。

```bash
npm test
npm run test:e2e
```

テストはローカルの模擬サービスを使用し、有料 API を呼び出しません。Sora2App の旧 Batch / Files ジョブを他社サービスへ自動移行する機能はありません。旧動画とプロンプトをバックアップし、[移行ガイド](docs/MIGRATING_FROM_SORA.md) に従ってください。

[MIT ライセンス](LICENSE) · [更新履歴](CHANGELOG.md) · [コントリビューション](CONTRIBUTING.md)

旧バージョンの短いキーでデータが破損した場合は、[オフライン隔離復旧](docs/DATA_RECOVERY.md)を参照してください。
