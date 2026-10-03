<p align="center">
  <strong>English</strong> | <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/LoKey-Typer/readme.png" alt="LoKey Typer" width="400" />
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/lokey-typer/actions/workflows/deploy.yml"><img src="https://github.com/mcp-tool-shop-org/lokey-typer/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/lokey-typer/"><img src="https://img.shields.io/badge/Web_App-live-blue" alt="Web App"></a>
  <a href="https://apps.microsoft.com/detail/9NRVWM08HQC4"><img src="https://img.shields.io/badge/Microsoft_Store-available-blue" alt="Microsoft Store"></a>
</p>

心地よい環境音と、個人のレベルに合わせたカスタマイズされた練習メニューが用意された、アカウント登録不要のタイピング練習アプリです。

## それが何であるか

LoKey Typerは、ゲーム要素やランキング、そして気が散るような要素を一切排除し、静かで集中できるタイピング練習環境を大人の方に提供することを目的としたアプリケーションです。

すべてのデータはあなたのデバイス内に保存されます。アカウントは不要です。クラウドも利用しません。また、追跡機能もありません。

## 練習モード

- **Focus (集中)**：リズムと正確性を高めるための、落ち着いて構成された練習メニュー。
- **Real-Life (実用)**：メール、コードの断片、日常的な文章を使った実践的な練習。
- **Competitive (競技)**：制限時間内にできるだけ多く問題を解くスピード練習で、自身の最高記録に挑戦。
- **Daily Set (デイリーセット)**：毎日、あなたの最近の練習履歴に合わせて調整された、新しい練習メニューが提供されます。

## 特徴

- 集中力を維持するための環境音（42トラック、非リズミカル）。
- 機械式タイプライターのキー音（オプション）。
- 過去の利用状況に基づいてカスタマイズされた日々のエクササイズ。
- 初回起動後は、完全にオフラインで使用可能。
- アクセシビリティ：スクリーンリーダー対応、モーション効果の軽減、音声のオン/オフ設定。

## インストールする

**Microsoft Store** (推奨):
[Microsoft Storeから入手](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**ブラウザ版PWA：**
EdgeまたはChromeで、[ウェブアプリケーション](https://mcp-tool-shop-org.github.io/lokey-typer/) を開き、アドレスバーにあるインストールアイコンをクリックしてください。

## プライバシー

LoKey Typerは、いかなるデータも収集しません。すべての設定、実行履歴、および個人記録は、すべてローカルにブラウザに保存されます。詳細については、プライバシーポリシー（[https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html)）をご覧ください。

## ライセンス

MITライセンス。詳細は[LICENSE](LICENSE)をご参照ください。

---

## 開発

### ローカル環境で実行する

```bash
npm ci
npm run dev
```

### ビルド

```bash
npm run build
npm run preview
```

### スクリプト。
または、台本

- `npm run dev`：開発サーバー
- `npm run build`：型チェックと本番環境ビルド
- `npm run typecheck`：TypeScriptの型チェックのみ
- `npm run lint`：ESLint
- `npm run preview`：ローカル環境での本番環境ビルドのプレビュー
- `npm run validate:content`：すべてのコンテンツパックに対するスキーマと構造の検証
- `npm run gen:phase2-content`：Phase 2のコンテンツパックを再生成
- `npm run smoke:rotation`：新規コンテンツのローテーションに関するテスト
- `npm run qa:ambient:assets`：環境音（WAV形式）アセットのチェック
- `npm run qa:sound-design`：サウンドデザインの品質チェック
- `npm run qa:phase3:novelty`：デイリーセットの新規コンテンツシミュレーション
- `npm run qa:phase3:recommendation`：レコメンデーション機能の動作確認シミュレーション

### コードの構造

- `src/app`: アプリケーションの構成 (ルーティング、シェル/レイアウト、グローバルプロバイダー)
- `src/features`: 各機能に紐づいたUI (ページと機能コンポーネント)
- `src/lib`: 共有されるドメインロジック (ストレージ、型定義、メトリクス、オーディオ/環境音など)
- `src/content`: コンテンツの種類と、コンテンツパックの読み込み処理

アーキテクチャに関する契約やインポートの範囲については、`modular.md` を参照してください。

### インポートのエイリアス

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public` (公開API)
- `@lib-internal` → `src/lib` (アプリケーションの構成やプロバイダーに限定)

### ルート

- `/`：ホーム
- `/daily`：デイリーセット
- `/focus`：集中モード
- `/real-life`：実生活モード
- `/competitive`：競技モード
- `/<mode>/exercises`：エクササイズのリスト
- `/<mode>/settings`：設定
- `/<mode>/run/:exerciseId`：エクササイズを実行する

### ドキュメント

- `modular.md`：アーキテクチャとインポートに関する規定
- `docs/sound-design.md`：アンビエントサウンドデザインのフレームワーク
- `docs/sound-design-manifesto.md`：サウンドデザインに関する宣言と、その検証テスト
- `docs/sound-philosophy.md`：公開されているサウンドに関する哲学
- `docs/accessibility-commitment.md`：アクセシビリティに関する取り組み
- `docs/how-personalization-works.md`：パーソナライゼーションの仕組みに関する解説
