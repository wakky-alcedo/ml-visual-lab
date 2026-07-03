# 基盤フェーズ 引き継ぎ（handoff-foundation）

Status: 完了（2026-07-03）。`npm run build`・`npm test`・`npx astro check` すべて通過。
対象読者: 可視化バッチA/B/C、本文MDXバッチ、notebooks 担当、統合検証担当。

前提: `CLAUDE.md` と `docs/tech-spec.md` を先に読むこと。本ドキュメントは基盤が実装した
API・ファイル配置・部品の使い方・注意点をまとめる。**基盤の lib と共有型（`src/lib/` の
`types` `rng` `matrix` `nn` `datasets` `slug` `paths` `quiz-progress`）は変更禁止**。
変更が必要ならメインエージェントに報告し、仕様を先に更新すること。

## 1. セットアップ・コマンド

プロジェクトルートは `site/`。Node 20+（開発環境は v22）、npm。

```bash
cd site
npm install
npm run dev       # 開発サーバ
npm run build     # 静的ビルド → dist/
npm run preview   # ビルド成果物のプレビュー
npm test          # Vitest（src/**/*.test.ts）
npx astro check   # 型チェック（TypeScript strict）
```

`astro.config.mjs` の `site`/`base` は環境変数で上書き可:
`SITE_URL=https://example.com BASE_PATH=/mlsite npm run build`。
サイト内リンクは必ず `src/lib/paths.ts` の `href()` / `moduleHref()` を通すこと（base 対応のため）。

## 2. ディレクトリ配置（実装済み）

```
site/
├── astro.config.mjs        # react + mdx + remark-math + rehype-katex, output:"static"
├── tsconfig.json           # astro/strict 継承。paths エイリアス @lib/@ui/@data
├── vitest.config.ts
├── src/
│   ├── content.config.ts   # modules コレクション（zod スキーマ）
│   ├── content/modules/    # m1.mdx … m7.mdx（プレースホルダ本文）
│   ├── layouts/
│   │   ├── BaseLayout.astro   # <head>/global.css/KaTeX CSS/ヘッダ/フッタ
│   │   └── ModuleLayout.astro # 目次サイドバー＋前後ナビ
│   ├── pages/
│   │   ├── index.astro        # 7モジュールカード＋クイズ達成率
│   │   ├── modules/[slug].astro
│   │   └── glossary.astro
│   ├── components/
│   │   ├── ui/                # Slider/PlaygroundFrame/QuizBlock/ColabBadge/Column/TermDef
│   │   └── interactive/
│   │       └── _DemoPlayground.tsx  # ★削除可のダミー（下記5参照）
│   ├── lib/                  # 数値計算・ユーティリティ（下記3）
│   ├── data/
│   │   ├── glossary.ts       # 用語集シード（10語）
│   │   └── quiz/             # index.ts（レジストリ）＋ m1.ts（サンプル1問）
│   └── styles/global.css     # デザイントークン
```

## 3. `src/lib/` — 実装済みAPI

### `types.ts`（共有型・単一の情報源）
- `Dataset2D` = `{ points: [number,number][]; labels: number[]; numClasses: number }`
- `Dataset2DKind` = `"circle" | "xor" | "gauss" | "spiral"`、`Dataset2DOptions` = `{ n?, noise?, seed? }`
- `Activation` = `"tanh" | "relu" | "sigmoid"`、`Optimizer` = `"sgd" | "momentum" | "adam"`
- `MLPConfig`、`MLP`（インターフェース）
- `QuizQuestion` = `{ question, choices[], answerIndex, explanation }`、`QuizSet`、`QuizProgress`
- `EmbeddingPoint` / `EmbeddingDataset`（M6 特徴埋め込みJSONのスキーマ。`synthetic: boolean` 必須）
- 部品 props 型: `SliderProps` `PlaygroundFrameProps` `QuizBlockProps`
  `ConvFilterLabProps`（`{imageSrc?}`）`AugmentPreviewProps`（`{imageSrc?}`）`FeatureSpaceExplorerProps`（`{dataUrl?}`）

### `rng.ts` — シード付き乱数（mulberry32）
```ts
import { mulberry32, DEFAULT_SEED } from "@lib/rng";
const rng = mulberry32(seed);
rng.next();                 // [0,1)
rng.uniform(min, max);      // [min,max)
rng.normal(mean=0, std=1);  // 正規乱数（Box–Muller）
rng.int(min, max);          // [min,max] 整数
rng.shuffle(arr);           // その場シャッフル（順列）
```
**リセット＝同じシードで rng を作り直す**、が全可視化の再現性の作法。

### `matrix.ts` — 行列/ベクトル演算
行列は `number[][]`（行優先）、ベクトルは `number[]`。
`zeros/zerosVec, matVec, matTVec(Aᵀ·x), addVec, subVec, mulVec, scaleVec, dot, outer,
transpose, matMul, solve(A,b)`。`solve` は部分ピボット付きガウス消去（**polyfit の正規方程式に使える**）。

### `nn.ts` — 小規模MLP（公開API固定）
```ts
import { createMLP } from "@lib/nn";
const mlp = createMLP({
  inputDim: 2, hiddenLayers: [8, 8], outputDim: 1,
  activation: "tanh", optimizer: "adam", learningRate: 0.05,
  momentum: 0.9, seed: 42, l2: 0,
});
const loss = mlp.trainStep(batch);   // Dataset2D → 平均損失
const out  = mlp.predict([x, y]);    // number[]
mlp.reset(seed?);                    // 重み初期化
```
- 出力/損失は `outputDim` で自動決定: `1` → シグモイド＋二値交差エントロピー（ラベル 0/1、`predict` は `[p]`）／
  `>1` → ソフトマックス＋交差エントロピー（ラベルはクラスindex、`predict` は確率ベクトル・和1）。
- 手書き backprop。SGD/Momentum/Adam 実装済み。He系初期化。想定規模: 層≤4・ノード≤8・数百点。
- 検証済み（`nn.test.ts`）: 出力妥当性、シード再現性、reset、固定バッチで損失単調減少（勾配の向き）、
  ガウス分類 >95%、**XOR を [8,8] tanh + Adam で学習 >90%**。
- 性能運用は呼び出し側の責務: 1フレームに N ステップ実行し、描画は requestAnimationFrame（仕様 §3）。

### `datasets.ts` — 2Dトイデータ
`makeCircle/makeXor/makeGauss/makeSpiral(opts)` と `makeDataset(kind, opts)`。
座標はおよそ [-1,1]、2クラス、シードで再現。既定 `n=200`。

### その他ユーティリティ
- `slug.ts` `toSlug(en)` — 英語→kebab-case（TermDef と glossary のアンカー一致に使用）
- `paths.ts` `href(path)` / `moduleHref(slug)` — base 対応リンク
- `quiz-progress.ts` `loadProgress/saveProgress/clearProgress/achievementRate/quizKey` —
  localStorage キー `mlsite:quiz:<moduleSlug>`

## 4. UI 部品の使い方

### 可視化部品（interactive/）の作り方 — 必読
- **全 interactive 部品は `PlaygroundFrame` でラップ**し、MDX からは `client:visible` で埋め込む。
- **原則 props なしで自己完結**。内部で意味のある初期値を持ち、`onReset` で初期状態へ戻す。
- props を受ける例外は仕様 §5.2 の表の型のみ（`types.ts` に定義済み）。**表が「—」の部品に props 追加禁止**。
- 乱数は必ず `mulberry32` を使い、リセットでシードを戻して再現性を担保。
- 描画既定: ピクセル塗り/リアルタイム更新は Canvas、軸/図形/ドラッグは SVG。リサイズは `ResizeObserver`。

```tsx
import PlaygroundFrame from "@ui/PlaygroundFrame";
import Slider from "@ui/Slider";

<PlaygroundFrame
  title="…"
  guide="…（「試してみよう:」は枠側が自動で付ける）"
  onReset={handleReset}
  controls={<><Slider label="次数" value={deg} min={0} max={15} onChange={setDeg} /></>}
>
  {/* SVG / Canvas をここに */}
</PlaygroundFrame>
```
完成した参考実装が `src/components/interactive/_DemoPlayground.tsx`（削除可）。丸ごとテンプレとして流用可。

### `Slider`（React）
`{ label, value, min, max, step?, unit?, format?, onChange, disabled? }`。`format` で表示文字列を自作可。

### `QuizBlock`（React・`client:visible`）
MDX から `<QuizBlock module="m2" client:visible />`。`module` から `src/data/quiz` のクイズを読む。
即時正誤判定＋解説、進捗を localStorage 保存、やり直しボタン付き。問題未登録なら「準備中」表示。

### Astro 部品
- `<TermDef en="Gradient Descent">勾配降下法</TermDef>` → 「勾配降下法（Gradient Descent）」を
  `/glossary#gradient-descent` にリンク。`id` を明示しなければ `en` から kebab-case 自動生成。
- `<Column title="…">…</Column>` — 教養コラムの囲み。
- `<ColabBadge url="…" label="…" />` — Open in Colab バッジ。

## 5. コンテンツ／データの追加方法

- **本文**: `src/content/modules/mN.mdx`。frontmatter は `content.config.ts` の zod で検証:
  `number`(1–7), `title`, `minutes`, `description`, `colab?: {label,url}[]`。
  現状は全7ファイルがプレースホルダ（仮見出し＋1段落・ですます調）。本文バッチが差し替える。
  MDX で部品を使うには先頭で import（例 `import QuizBlock from "../../components/ui/QuizBlock.tsx";`）。
  数式は `$…$` / `$$…$$`（remark-math + KaTeX、ビルド時レンダリング・クライアントJS不要）。
- **クイズ**: `src/data/quiz/mN.ts` に `QuizSet` を default export し、`src/data/quiz/index.ts` の
  `registry` に登録する。現在は `m1` にサンプル1問のみ。**m1 の内容も後続が正式版へ差し替え可**。
- **用語集**: `src/data/glossary.ts` の `rawTerms` に追加（現在10語）。`id` 省略で `en` から自動生成。
  50語程度まで拡充予定。
- **M6 埋め込みJSON**: `EmbeddingDataset` 型で `src/data/`（同梱 import）または `public/`（fetch）に置く。
  初期は合成データでよいが `synthetic:true` にして UI に明記する（仕様 §5.2）。

## 6. 後続が実装する未実装分（基盤スコープ外）

- 単一モジュール専用 lib: `polyfit.ts`(A) `conv.ts`(A) `optim-landscape.ts`(B) `iou.ts`(C)。
  `polyfit` は `matrix.solve` を使うと正規方程式が書ける。
- interactive/ の15部品（バッチA/B/C）。props 契約は仕様 §5.2、型は `types.ts` に定義済み。
- 本文MDX 7本の執筆、クイズ各回5問前後、用語集の拡充、notebooks 4本＋埋め込み生成。

## 7. 注意点・決定事項

- **依存最小**: チャートライブラリ・Tailwind・UIフレームワーク導入禁止。React 18 + 素のCSS。
  部品CSSは co-located `.css` を import（例 `Slider.css`）。共通トークンは `global.css`。
- **Preact エイリアス化の余地**: React 固有APIへの深依存を避ける。使用中は `useState/useEffect/useRef/
  useMemo/useId` のみ（いずれも preact/compat 互換）。context/forwardRef 等の多用は避ける。
- **クイズ進捗の SSR 安全性**: localStorage アクセスは必ず `quiz-progress.ts` 経由（window ガード済み）。
  トップの達成率はクライアントスクリプトで反映（キー `mlsite:quiz:<slug>`、`answered` 配列で回答数判定）。
- **リンクは base 対応**: 直書きせず `paths.href()`。TermDef/glossary のアンカーは `slug.toSlug` で一致させる。
- **`_DemoPlayground.tsx` は削除可**。本番ルート未接続。可視化の着手時テンプレとして参照後、不要なら削除。
- ダークモード: 初期対象外だが `[data-theme="dark"]` トークンを用意済み（未適用）。
- KaTeX CSS とフォントは `BaseLayout` の `import "katex/dist/katex.min.css"` で全ページに供給済み。

## 8. 検証結果

- `npm test`: 34 passed（rng 6 / matrix 10 / datasets 11 / nn 7、XOR学習含む）
- `npm run build`: 9 ページ生成成功（index, glossary, m1–m7）。KaTeX ビルド時レンダリング確認、
  KaTeX フォント19個を dist へ同梱。
- `npx astro check`: 0 errors / 0 warnings（TypeScript strict）。
