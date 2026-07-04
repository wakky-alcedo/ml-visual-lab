# 統合検証記録（2026-07-03）

## 自動検証（すべてパス）

| 項目 | 結果 |
|---|---|
| `npm test`（Vitest） | 8ファイル・99テスト パス（rng/matrix/datasets/nn/polyfit/conv/iou/optim-landscape） |
| `npm run build` | 9ページ生成成功（トップ・m1〜m7・用語集） |
| `npx tsc --noEmit` | エラーゼロ |
| `npx astro check` | エラー0・警告0（ヒント5件のみ） |
| 全ページHTTP応答 | 9ページすべて200 |
| アイランド数 | m1:2 / m2:3 / m3:4 / m4:3 / m5:4 / m6:3 / m7:3（可視化15部品＋クイズ7個、想定どおり） |
| KaTeX | ビルド時レンダリング確認（m4で17式） |
| 用語集 | 85アンカー、本文TermDefとの機械照合で不一致ゼロ |
| Colabリンク | 4ノートブックへのバッジ確認（GitHub公開後に有効化、下記） |

## 修正した問題

- **SSR出力へのnullバイト混入**（m2/m5/m6）: React 18.3.1の
  ストリーミングSSRでマルチバイト文字がチャンク境界をまたぐ際の既知バグ。
  React 19（react/react-dom/@types）へのアップグレードで解消を確認。

## 残る手動確認（ブラウザで実施推奨）

- [ ] 各可視化のスライダー操作 → 即時反映の体感確認
- [ ] クイズ回答 → 正誤判定・解説表示・リロード後の進捗保持（localStorage）
- [ ] スマホ幅（375px）でのレイアウト崩れ
- [ ] IoUNMSPlaygroundのドラッグ操作（タッチ含む）

## Colabリンクの有効化に必要な作業

バッジURLは `https://colab.research.google.com/github/wakky-alcedo/ml-visual-lab/blob/main/notebooks/…` を想定。
GitHubに **public** リポジトリ `wakky-alcedo/ml-visual-lab` としてpushすると有効になる。
リポジトリ名を変える場合は `site/src/content/modules/m*.mdx` のfrontmatter内URLを一括置換すること。
