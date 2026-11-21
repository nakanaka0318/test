# Gunsmoke Arcana

西部劇のガンマン × 荒野 × ファンタジーの、スマホ縦持ち向けカード対戦ゲーム。

- 本体: [`gunsmoke-arcana.html`](./gunsmoke-arcana.html) — 単一ファイル（約1.0MB / 約14,000行）。
  ビルド不要で、ブラウザでそのまま開けば動く。
- 公開先（Claude Artifact）: https://claude.ai/artifact/5Bsv1BNoQd8YSbKy4Y6SXi

## 中身

| 項目 | 現在値 |
| --- | --- |
| カード種類 | 497 |
| バージョン | ver1 〜 ver8 |
| フォーマットデッキ | 40（8バージョン × 5クラス） |
| クラス | フォーメーション / アクセル / ドミニオン / アルカナ / マキナ（＋エニグマ＝ニュートラル） |

主な仕組み: PP・進化(EP)・超進化(SEP)・バッジ・融合（手札で行う）・奥義・成長・
状態（温存／強気／全力）。

## 触るときの決まりごと

- **1行目の `<meta charset="utf-8">` は動かさない。** 文字化けする。
- **タイプ（種族）は、カードの「タイプ」行に書かれていない限り付けない。** `token` も同じ。
  仕様書の `タイプ:エニグマ　ゴールド　アミュレット` は「クラス・レアリティ・カード種別」であって、
  種族ではない。エニグマは `cls: 'neutral'` に対応する。
- 公開しているのは上記の1つの Artifact URL。更新は毎回その同じ URL に上書きする。

## 構造のあらまし

データ駆動。`CARDS` 配列（→ `CARD_BY_ID`）がカードの定義で、効果は
`{hook, cond, once, type, params}` の形で持ち、`EFFECTS` レジストリ（`registerEffect`）が実体を持つ。
発動タイミング（hook）の一覧は `ABILITY_TERMS` にあり、ゲーム内のルールブック画面にそのまま出る。

## 検証について

Playwright による自動テスト一式（カードのデータ整合性、効果の挙動、画面操作、
バージョンごとの対戦シミュレーション、スマホ表示の実測など）で確認してきたが、
テストはコンテナの一時領域にあったため現存しない。作り直す場合は
`/opt/pw-browsers/chromium` と `/opt/node22/lib/node_modules/playwright` を使い、
Google Fonts へのリクエストは必ず中断すること（`pg.route('**/*fonts.g*.com/**', r => r.abort())`）。
