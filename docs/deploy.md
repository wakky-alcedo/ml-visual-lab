# デプロイ手順

## ビルド

```bash
cd site
npm ci        # 初回のみ
npm run build # dist/ に静的ファイル一式を生成
```

## 自前サーバーへの配置（ドメイン直下に置く場合）

```bash
rsync -av --delete site/dist/ user@your-server:/var/www/mlsite/
```

nginx例:

```nginx
server {
    listen 80;
    server_name your-domain.example;
    root /var/www/mlsite;
    index index.html;
}
```

## サブパス配下に置く場合（例: https://example.com/ml/）

`site/astro.config.mjs` の `base` を `/ml` に設定してビルドし直す。
サイト内リンクは `paths.href()` 経由なので base 変更に自動で追従する。

## Colabノートブックの公開

1. GitHubに public リポジトリ `wakky-alcedo/machine-learning-text` を作成
2. `git remote add origin git@github.com:wakky-alcedo/machine-learning-text.git && git push -u origin main`
3. これで本文中の「Open in Colab」バッジが有効になる（reference/ の講義PDFは
   .gitignore 済みでpushされない）

## 更新の流れ

本文（`site/src/content/modules/*.mdx`）やクイズ（`site/src/data/quiz/*.ts`）を編集 →
`npm run build` → rsync、の3ステップ。サーバー側にNode等は不要（純静的サイト）。
