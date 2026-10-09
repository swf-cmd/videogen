<div align="center">

# videogen

**プロンプトの一覧や CSV から、選別済みの AI 動画バッチを。自分の PC で、自分のプロバイダーキーで。**

[![最新リリース](https://img.shields.io/github/v/release/swf-cmd/videogen?label=release)](https://github.com/swf-cmd/videogen/releases/latest)
[![テストとポータブル版](https://github.com/swf-cmd/videogen/actions/workflows/portable.yml/badge.svg?branch=main)](https://github.com/swf-cmd/videogen/actions/workflows/portable.yml)
[![MIT ライセンス](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![Node.js ^22.21 または 24.5 以上](https://img.shields.io/badge/node-%5E22.21%20%7C%7C%20%E2%89%A524.5-339933?logo=nodedotjs&logoColor=white)
![npm 依存パッケージ 0](https://img.shields.io/badge/npm%20dependencies-0-brightgreen)
![Windows・macOS・Linux](https://img.shields.io/badge/platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-lightgrey)

[English](README.md) · [中文](README.zh-CN.md) · **日本語** · [한국어](README.ko.md)

</div>

[![操作デモ：CSV と画像フォルダーの取り込み、費用の確認、キューの進行、キーボードでの選別](docs/media/videogen-workflow.gif)](docs/media/videogen-workflow.webm)

<sub>ローカルの代替エンドポイントに接続してオフラインで録画しています。映像はプログラムで描いたテスト用アニメーションで、**AI の生成結果ではありません**。1 秒あたり $0.05 の料金はローカルの例示カタログの値で、プロバイダーの見積もりではありません。有料 API は一切呼び出していません。</sub>

**[Windows / macOS 版をダウンロード](https://github.com/swf-cmd/videogen/releases/latest)** · [ソースから起動](#起動) · [録画（原寸）](docs/media/videogen-workflow.webm) · [Sora 2 からの移行](docs/MIGRATING_FROM_SORA.md)

> [!NOTE]
> **OpenAI は 2026-09-24 に Sora 2 API を終了しました**（[非推奨化の一覧](https://developers.openai.com/api/docs/deprecations)）。videogen は Sora2App の後継で、同じローカルのバッチ作業を OpenRouter、Gemini、Alibaba Cloud Model Studio、Volcengine / BytePlus Ark、または自前の OpenAI 互換サーバーで続けられます。旧 Sora のジョブは自動移行できません。残しておくべきものは[移行ガイド](docs/MIGRATING_FROM_SORA.md)を参照してください。

## videogen の特長

- **1 本ずつではなく、まとめて。** 空行で区切ったプロンプトを貼り付けるか、テンプレート変数入りの UTF-8 CSV と画像フォルダーを取り込みます。行ごとに開始フレーム（モデルが対応していれば終了フレームも）を指定でき、「プロンプトごとのテイク数」で各行を 1〜20 回生成できます。
- **良いテイクをすばやく選ぶ。** 完成した動画はショット・テイクごとにギャラリーへ並びます。**J/K** で移動、**Space** で再生、**1** で保持、**2** で除外。保持したテイクはパス・プロンプト・設定・SHA-256 付きの CSV / JSON で書き出して編集ソフトへ渡せます。
- **送信前に費用がわかる。** 各行をモデルの対応機能で検証し、見積もってから送信します。バッチ予算と、保持した 1 本あたりの推定費用も確認できます。不明な料金は推測せず「不明」と表示します。
- **二重課金を起こさない設計。** キューはローカルのサービスが持つため、ブラウザーを閉じても影響はなく、クラッシュや再起動後も既知のジョブを追跡し続けます。結果が不明な生成要求は自動で再送せず、判断を待ちます。SIGKILL による再起動を含む 100 ジョブの試験で重複作成は 0 件でした。
- **ローカルで完結、プライバシーを保護。** サービスは `127.0.0.1` だけで待ち受けます。キーはメモリー上だけに保持され、プロンプトや画像、履歴は自分のデータフォルダーに残ります。アカウント登録、テレメトリー、更新チェック、npm 依存はありません。
- **複数のプロバイダーを同じ手順で。** 日付付きの同梱カタログには OpenRouter・Gemini・Model Studio・Ark の動画モデル 31 種（Veo 3.1、Kling 3.0、Seedance 2.5、Wan 3.0、Runway Gen-4.5 など）が載っており、自前の OpenAI 互換サーバーも使えます。[詳細（英語）](README.md#providers-and-estimates)

<p align="center"><img src="docs/media/videogen-review.png" width="680" alt="ショットとテイクごとにまとまったギャラリー。保持・除外・未選別の状態、合計と保持 1 本あたりの推定費用、書き出しボタン、キーボード操作の案内"></p>
<p align="center"><sub>同じオフライン実行の選別画面（テスト用アニメーション、例示料金）。</sub></p>

## 起動

**インストール不要版：** [Releases](https://github.com/swf-cmd/videogen/releases/latest) から Windows x64 または macOS universal の ZIP をダウンロードし、書き込み可能なフォルダーにすべて展開します。Windows は **Start videogen.cmd**、Mac は **Start videogen.command** をダブルクリックしてください。Node 24 LTS が同梱され、Apple Silicon と Intel Mac の両方に対応します。

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
3. 空行で区切ったプロンプトを入力するか、UTF-8 CSV・テンプレート・画像フォルダーを取り込みます。各行に開始フレームを指定でき、モデルが対応する場合は終了フレームも指定できます。「プロンプトごとのテイク数」（1〜20）で各プロンプト・各行を複数回生成して比較できます（ファイル名に `-t1`、`-t2`… が付きます）。
4. 行ごとの検証結果と費用の見積もりを確認し、明示的にバッチを送信します。不明な料金は「不明」と表示され、通貨は別々に集計されます。
5. 完成した動画はショット・テイクごとにまとめてギャラリーに表示されます。キーボードだけで選別でき（**J/K** または矢印キーで移動、**Space** で再生、**1** 保持、**2** 除外、**3/U** 未選別に戻す）、選んだ後は次の未選別テイクに移動します。保持した動画 1 本当たりの推定費用を確認し、「保持分を書き出す（CSV）」で出力パス・プロンプト・モデル・設定・ショット/テイク・費用・SHA-256 を含む一覧を編集ソフトやチーム向けに保存できます（JSON や全テイク版はメニューから）。再生成は毎回確認が必要で、新たなプロバイダー料金が発生する場合があります。バッチ予算を超える再生成は受け付けません。任意のデスクトップ通知でバッチ完了・確認待ち・キー待ちを知らせます。

予算は今後のジョブ送信を見積もりで制限するもので、請求額の保証ではありません。残高不足やモデル権限エラーによる停止中も、送信済みジョブのポーリングとダウンロードは継続します。動画は元のバイト列を保ち、同名ファイルを上書きしません。

## 復旧とプロバイダー

生成要求の結果が不明なジョブは `needs_review` となり、自動で再送信されません。プロバイダーの管理画面を確認してから、「未作成を確認して再送信」「追跡を放棄」「既存のリモート ID を関連付ける」のいずれかを選択してください。追跡の放棄は返金やリモート処理のキャンセルではありません。実行中のジョブも「追跡を停止」できます（誤ったリモート ID を関連付けた場合など）。プロバイダーが 15 分間途切れずに 404/410 だけを返した実行中ジョブは `remote_not_found` で失敗となり、リモート ID は確認用に残ります。残高不足を含むその他の 4xx は、受理済みジョブのポーリング・ダウンロードでは再試行され、支払い済みの結果をすぐに破棄しません。

Gemini は `background: true` で interaction ID を先に保存し、再起動後もポーリングを再開します。ID を受け取る前に通信が切れた場合は、手動確認が必要になる可能性が残ります。OpenRouter はモデルが対応を宣言した場合にローカル画像を data URL で `frame_images` に渡し、モデル一覧の機能と料金に従います。Seedance のトークン料金は OpenRouter が公開する計算式（高さ × 幅 × 秒数 × 24 / 1024）で見積もります。OpenRouter へのリクエストには videogen を示すアプリ帰属ヘッダー（ユーザーデータなし）が付きます。`VIDEOGEN_OPENROUTER_ATTRIBUTION=0` で無効化できます。Google は 2026-10-22 に Gemini API から Veo 3.1 プレビューモデルを提供終了し、Omni を後継としています。Veo は OpenRouter 経由で引き続き利用できます。

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
