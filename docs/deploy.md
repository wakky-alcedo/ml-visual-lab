# デプロイ手順（Cloudflare Pages）

ドメインはCloudflareで管理している前提。静的サイトなので自前サーバーは使わず、
Cloudflare Pages（無料・HTTPS自動・CDN配信）に置く。

## 全体像

```
site/ を npm run build → dist/ を wrangler で Cloudflare Pages にアップロード
→ Pages プロジェクトにカスタムドメインを紐付け（DNSはCloudflareが自動設定）
```

## 初回セットアップ

### 1. Cloudflareへの認証（どちらか一方）

**A. ブラウザログイン（このマシンにブラウザがある場合）**

```bash
cd site
npx wrangler login   # ブラウザが開くので許可する
```

**B. APIトークン（ヘッドレス環境・CI向け）**

1. https://dash.cloudflare.com/profile/api-tokens で「トークンを作成」
2. テンプレート不使用のカスタムトークンで、権限に
   「アカウント → Cloudflare Pages → 編集」を付与
3. 環境変数に設定:

```bash
export CLOUDFLARE_API_TOKEN=<トークン>
export CLOUDFLARE_ACCOUNT_ID=<アカウントID>  # ダッシュボード右下に表示
```

### 2. Pagesプロジェクト作成と初回デプロイ

```bash
cd site
npm run build
npx wrangler pages project create mlsite --production-branch=main
npx wrangler pages deploy dist --project-name=mlsite
```

成功すると `https://mlsite.pages.dev` の一時URLが発行される。

### 3. カスタムドメインの紐付け

Cloudflareダッシュボード → Workers & Pages → mlsite → カスタムドメイン →
「カスタムドメインを設定」で `ml.your-domain.example`（好きなサブドメイン）を入力。
ドメインが同じCloudflareアカウントにあるため、DNSレコード（CNAME）は自動で作成される。
反映は通常数分。

※ドメイン直下でもサブパス（`/ml/`）でもなく**サブドメイン**を推奨。サブパス配信は
Pagesでは手間がかかる（astro.config.mjs の `base` 変更＋Worker経由が必要）。

## 2回目以降の更新

```bash
cd site
npm run build
npx wrangler pages deploy dist --project-name=mlsite
```

の3行だけ。数十秒で世界に反映される。

## （任意）GitHub連携による自動デプロイ

GitHubにpushするだけで自動ビルド＆デプロイしたい場合:
ダッシュボード → Workers & Pages → 作成 → Pages → 「Gitに接続」で
`wakky-alcedo/machine-learning-text` を選び、
ビルド設定を「フレームワーク: Astro／ルートディレクトリ: `site`／
ビルドコマンド: `npm run build`／出力: `dist`」とする。
※直アップロード運用（上記）と混在はできないため、切り替える場合はプロジェクトを作り直す。

## Colabノートブックの公開（サイトとは独立）

本文中の「Open in Colab」バッジは GitHub 上のノートブックを参照する。

1. GitHubで public リポジトリ `wakky-alcedo/machine-learning-text` を作成
2. `git remote add origin git@github.com:wakky-alcedo/machine-learning-text.git`
3. `git push -u origin main`

`reference/`（講義PDF）は .gitignore 済みでpushされない。
リポジトリ名を変える場合は `site/src/content/modules/m*.mdx` frontmatter内の
ColabのURLを一括置換してビルドし直すこと。
