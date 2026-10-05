<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/LoKey-Typer/readme.png" alt="LoKey Typer" width="400" />
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/lokey-typer/actions/workflows/deploy.yml"><img src="https://github.com/mcp-tool-shop-org/lokey-typer/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/lokey-typer/"><img src="https://img.shields.io/badge/Pages-target-blue" alt="Pages target"></a>
  <a href="https://apps.microsoft.com/detail/9NRVWM08HQC4"><img src="https://img.shields.io/badge/Microsoft_Store-available-blue" alt="Microsoft Store"></a>
</p>

落ち着いた環境音と、パーソナライズされた日替わり練習、アカウント不要のタイピング練習アプリ。

## 概要

LoKey Typerは、ゲーム要素、ランキング、気を散らす要素を排除し、静かで集中できるセッションを求める大人向けのタイピング練習アプリです。

すべてのデータはデバイス内に保存されます。アカウントは不要です。クラウドも使用しません。追跡も行いません。

## 練習モード

- **集中** — リズムと正確性を高めるための、落ち着いた厳選された練習
- **実生活** — メール、フォーム、メッセージ、メモ、その他の日常的な文章での練習
- **競争** — 時間制限付きのスプリントで、自己ベストを目指す
- **日替わり練習** — 毎日生成される、最近の練習に合わせて調整された新しい練習
- **学習** — 独自のテキストを追加。このデバイスに保存され、順番に、またはシャッフルして、少しずつ表示されます。

## 機能

- 集中力を維持できるように設計された環境音。設定リストには、トラックを持つカテゴリのみが表示されます。
- 機械式タイプライターのキー入力音（オプション）、および、クリック音、カチッという音、ミュート。選択したキーボードは、その録音に使用されます。デフォルトは機械式です。
- 最近の練習に基づいてパーソナライズされた日替わり練習
- 最初の起動後の完全なオフラインサポート
- アクセシビリティ：スクリーンリーダーモード、モーションの軽減、サウンドのオプション

## インストール

**Microsoft Store**（推奨）：
[Microsoft Storeから入手](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**ブラウザ:**
`npm run dev`を実行し、ローカルアドレスを開きます。Pagesワークフローは、アプリを[Pagesサイト](https://mcp-tool-shop-org.github.io/lokey-typer/)に公開します。マニュアルは、同じサイトの`/handbook/`にあります。

**Docker（セルフホスト）:**

```bash
docker run -d --name lokey-typer -p 8080:8080 --restart unless-stopped ghcr.io/mcp-tool-shop-org/lokey-typer:latest
```

次に、`http://localhost:8080/`を開きます。マニュアルは`/lokey-typer/handbook/`にあります。進捗状況は、コンテナー内に保存されるのではなく、ブラウザでそのアドレスに対して保存されるため、コンテナーを停止、アップグレード、または置き換えても保持されます。毎回、同じホストとポートを開きます。異なるアドレスを使用すると、最初からやり直しになります。

## プライバシー

LoKey Typerは、データを収集しません。設定、実行履歴、自己ベスト、および学習のために追加したテキストは、このブラウザに保存されます。完全な[プライバシーポリシー](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html)をご覧ください。このページは、サイトに同梱されています。

## ライセンス

MIT。 [LICENSE](LICENSE)を参照してください。

---

## 開発

### ローカルで実行

```bash
npm ci
npm run dev
```

### ビルド

```bash
npm run build
npm run preview
```

### スクリプト

- `npm run dev` — 開発サーバー
- `npm run build` — 型チェック + 本番ビルド
- `npm run verify` — コンテンツチェック、サウンドゲート、型チェック、カバレッジ、および本番ビルド
- `npm run typecheck` — TypeScriptビルドのみの型チェック
- `npm run lint` — ESLint
- `npm run preview` — ローカルで本番ビルドをプレビュー
- `npm run validate:content` — すべてのコンテンツパックのスキーマ + 構造検証
- `npm run gen:phase2-content` — フェーズ2パックを再生成
- `npm run smoke:rotation` — 新機能/ローテーションの簡単なテスト
- `npm run qa:ambient:assets` — 環境WAVアセットのチェック
- `npm run qa:sound-design` — サウンドデザインの承認ゲート
- `npm run qa:phase3:novelty` — 日替わり練習の新規性のシミュレーション
- `npm run qa:phase3:recommendation` — レコメンデーションの妥当性シミュレーション

### コード構造

- `src/app` — アプリの配線（ルーター、シェル/レイアウト、グローバルプロバイダー）
- `src/features` — 機能に依存するUI（ページ + 機能コンポーネント）
- `src/lib` — 共有ドメインロジック（ストレージ、タイピングメトリクス、オーディオ/環境音など）
- `src/content` — コンテンツタイプ + コンテンツパックのロード

アーキテクチャの契約とインポート境界については、`modular.md`を参照してください。

### インポートエイリアス

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public`（パブリックAPIサーフェス）
- `@lib-internal` → `src/lib`（アプリの配線/プロバイダーに限定）

### ルート

- `/` — ホーム
- `/daily` — 日替わり練習
- `/focus` — 集中モード
- `/real-life` — 実生活モード
- `/competitive` — 競争モード
- `/study` — 学習（独自のテキストを追加）
- `/focus/run/:exerciseId`、`/real-life/run/:exerciseId`、`/competitive/run/:exerciseId` — 練習の実行
- `/practice`は`/focus`にリダイレクトします。`/arcade`は`/competitive`にリダイレクトします。

設定はヘッダーから開きます。練習リストページはありません。

### ドキュメント

- `modular.md` — アーキテクチャ + インポート境界の契約
- `docs/sound-design.md` — 環境音デザインフレームワーク
- `docs/sound-design-manifesto.md` — サウンドデザインマニフェスト + 受け入れテスト
- `docs/sound-philosophy.md` — パブリック向けのサウンド哲学
- `docs/accessibility-commitment.md` — アクセシビリティへの取り組み
- `docs/how-personalization-works.md` — パーソナライズの説明

---

## セキュリティとデータ範囲

LoKey Typerは、アカウントやテレメトリーを持たないタイピング練習Webアプリ（PWA + Microsoft Store）です。

- **アクセスされるデータ:** ブラウザのlocalStorage（設定、実行履歴、自己ベスト）およびIndexedDBデータベース`lokey-study`（学習ページに追加したテキスト）
- **アクセスされないデータ:** クラウド同期は行いません。テレメトリーも行いません。分析も行いません。アカウントも使用しません。追跡も行いません。
- **ネットワーク:** アプリは、独自のページとオーディオを同じオリジンからロードします。アカウントサービス、テレメトリーエンドポイント、またはサードパーティAPIを呼び出しません。
- **テレメトリーは**収集または送信されません。

完全なポリシー：[SECURITY.md](SECURITY.md)

---

## スコアカード

| カテゴリ | スコア |
|----------|-------|
| A. セキュリティ | 10/10 |
| B. エラー処理 | 10/10 |
| C. 運用ドキュメント | 10/10 |
| D. リリース衛生 | 10/10 |
| E. 識別（ソフト） | 10/10 |
| **Overall** | **50/50** |

---

<p align="center">
  Built by <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
</p>
