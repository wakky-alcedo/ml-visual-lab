# 技術仕様書 — インタラクティブML学習サイト

Status: **approved**（レビューエージェント承認 2026-07-03。審査記録: 必須修正2件を反映のうえ再審査でAPPROVED）
前提: `CLAUDE.md`（プロジェクト決定事項・モジュール構成）を先に読むこと。

## 1. 技術スタック

| 項目 | 選定 | 理由 |
|---|---|---|
| サイト生成 | Astro 5（static output） | 本文をMDXで書け、成果物は純静的HTML。自前サーバーに置くだけでデプロイ完了 |
| インタラクティブ部品 | React 18 + TypeScript（Astro islands, `client:visible`） | 可視化コンポーネントだけJSを配信。ページ本体は軽量なHTML |
| 本文 | MDX（`@astrojs/mdx`） | Markdown中にReact部品を直接埋め込める |
| 数式 | remark-math + rehype-katex（KaTeX） | ビルド時レンダリング。クライアントJS不要 |
| 描画 | SVG / Canvas 直描画 | チャートライブラリ不使用。依存を最小化しバンドルを軽く保つ |
| 数値計算 | 自前TS実装（`src/lib/`） | ミニMLP・多項式回帰程度なら依存なしで十分高速 |
| スタイル | グローバルCSSデザイントークン + コンポーネント別CSS | Tailwind等は導入しない（依存最小・第三者が読んでも追える構成） |
| テスト | Vitest（`src/lib/` の数値計算のみ） | 可視化の土台となる計算の正しさを担保 |
| デプロイ | `npm run build` → `dist/` を rsync でユーザーのサーバーへ | ドメイン・サーバーは所有済み。運用コストゼロ |

Node 20+ 前提。パッケージマネージャは npm。

## 2. ディレクトリ構成

```
machine-learning-text/
├── CLAUDE.md                 # プロジェクト決定事項（既存）
├── docs/                     # フェーズ成果物（本ファイル等）
├── reference/                # 原典PDF（既存・触らない）
├── notebooks/                # Colab用 .ipynb（GitHub経由でColabリンク）
└── site/                     # Astroプロジェクト
    ├── astro.config.mjs      # site/base 設定可能に
    ├── package.json
    ├── public/
    │   └── img/              # 畳み込み実験用サンプル画像等（パブリックドメイン）
    └── src/
        ├── content/
        │   └── modules/      # m1.mdx … m7.mdx（本文）
        ├── content.config.ts # コレクション定義（zodスキーマ）
        ├── layouts/
        │   └── ModuleLayout.astro
        ├── pages/
        │   ├── index.astro       # トップ（コース概要・進捗）
        │   ├── modules/[slug].astro
        │   └── glossary.astro    # 用語集（日英対訳）
        ├── components/
        │   ├── ui/           # 共通部品（下記 §4）
        │   └── interactive/  # 可視化15部品（下記 §5）
        ├── lib/              # 数値計算・ユーティリティ（下記 §3）
        ├── data/             # クイズ定義・用語集・特徴埋め込みJSON
        └── styles/global.css # デザイントークン
```

## 3. `src/lib/` — 数値計算コア（Vitest対象）

**所有権**: 複数バッチから参照されるlib（`rng` `matrix` `types` `nn` `datasets`）は
**基盤エージェントが先行実装**する。単一モジュール専用のlib（`polyfit` `conv` `optim-landscape` `iou`）は
対応する可視化バッチが実装する（§9の一覧参照）。

- `types.ts` — 共有型の一元定義（部品props・2Dデータセット形状・特徴埋め込みJSONスキーマ・クイズ定義型）【基盤】
- `rng.ts` — シード付き乱数（mulberry32）。**全可視化で再現性を保証**（リセット→同じ結果）【基盤】
- `matrix.ts` — 最小限の行列・ベクトル演算【基盤】
- `nn.ts` — 小規模MLP（全結合＋tanh/ReLU/sigmoid、手書きbackprop、SGD/Momentum/Adam）: M2/M4用【基盤】
  - 公開API（固定）: `createMLP(config: MLPConfig): MLP` ／ `mlp.trainStep(batch: Dataset2D): number`（損失を返す）／
    `mlp.predict(x: [number, number]): number[]` ／ `mlp.reset(seed?: number): void` ／
    `type Optimizer = "sgd" | "momentum" | "adam"`。層数≤4・ノード数≤8・数百点の2Dデータを想定
  - 性能要件: 訓練ステップと描画を分離し、「1フレームあたりNステップ実行、描画はrequestAnimationFrameで
    60fpsを維持」とする（訓練速度自体を60fpsに縛る意味ではない）
- `datasets.ts` — 2Dトイデータ生成（circle / xor / gauss / spiral）【基盤】
- `polyfit.ts` — 多項式最小二乗（正規方程式＋リッジ項オプション）: M1用【バッチA】
- `conv.ts` — 2D畳み込み（グレースケール、3×3カーネル、padding対応）: M3用【バッチA】
- `optim-landscape.ts` — 2変数損失関数群（凸・谷・鞍点・多峰）と GD/Momentum/Adam の軌跡計算: M4用【バッチB】
- `iou.ts` — 矩形IoU計算とNMS: M7用【バッチC】

## 4. `src/components/ui/` — 共通UI部品

- `Slider.tsx` — ラベル・現在値・単位表示つきスライダー（タッチ対応）
- `PlaygroundFrame.tsx` — 可視化の共通枠: タイトル／操作パネル／描画領域／**リセットボタン**／
  「試してみよう」ガイド文スロット。全interactive部品はこれでラップする
- `QuizBlock.tsx` — 選択式クイズ。即時正誤判定＋解説表示。進捗は
  `localStorage["mlsite:quiz:<moduleSlug>"]` に保存。モジュール一覧に達成率表示
- `ColabBadge.astro` — 「Open in Colab」バッジリンク（URLは `notebooks/` のGitHub raw経由）
- `Column.astro` — 教養コラム用の囲み
- `TermDef.astro` — 用語の初出マーク（日英対訳、用語集ページへリンク）

## 5. `src/components/interactive/` — 可視化部品一覧

すべて `PlaygroundFrame` でラップ、`client:visible` で遅延ハイドレート、シード付き乱数使用。

### 5.1 props契約（MDXとの結合規約）

- **原則: 自己完結**。必須propsなし・内部で意味のある初期値を持ち、MDXからは
  `<PolyFitLab client:visible />` の形で埋め込む（`client:visible` はMDX側が付ける）
- 例外的にpropsを受ける部品は下表の「props」列に型を明記する。**props列が「—」の部品に
  propsを追加してはならない**（追加が必要になったら仕様を先に更新）
- props型・データ形状はすべて `src/lib/types.ts`（基盤エージェントが先行作成）に定義する

### 5.2 描画方式の既定

ピクセル塗り・リアルタイム更新系（決定境界・画像処理）は**Canvas**、
軸・図形・ドラッグ操作系は**SVG**を既定とする。リサイズは全部品 `ResizeObserver` で追従。

| 部品 | モジュール | 描画 | props | 操作 → 表示 |
|---|---|---|---|---|
| `PolyFitLab` | M1 | SVG | — | 次数(0–15)・データ数・ノイズのスライダー → フィット曲線＋train/test誤差バー |
| `LogicNeuronBoard` | M2 | SVG | — | w1,w2,b スライダー → 真理値表の各行PASS/FAIL、課題モード（AND/OR/NOT/NAND切替） |
| `NeuronBoundary` | M2 | Canvas | — | w,b操作 → 2D平面上の決定境界線と分類領域の色分け |
| `ConvFilterLab` | M3 | Canvas | `{ imageSrc?: string }` | 3×3カーネル値を直接編集（プリセット: エッジ/ぼかし/シャープ） → サンプル画像に即時適用 |
| `ActivationGallery` | M3 | SVG | — | 関数切替＋入力xスライダー → 曲線と勾配（勾配消失の観察） |
| `SoftmaxCEViz` | M3 | SVG | — | ロジット3本をスライダー → softmax確率棒グラフとCE損失値 |
| `LossLandscape` | M4 | Canvas | — | 地形選択（凸/谷/鞍点/多峰）、η・momentum、SGD/Momentum/Adam切替 → 等高線上をボールが降下（発散も再現） |
| `MiniNNTrainer` | M4 | Canvas | — | データセット・層数・ノード数・η・活性化を選択、Run/Pause → 決定境界のリアルタイム更新＋損失曲線 |
| `LearningCurveSim` | M5 | SVG | — | データ量・モデル容量・Dropout率・拡張ON/OFF → train/val学習曲線の乖離 |
| `AugmentPreview` | M5 | Canvas | `{ imageSrc?: string }` | flip/crop/erase/明度のトグル → サンプル画像に適用、「1枚が何枚分になるか」表示 |
| `BatchNormViz` | M5 | SVG | — | 入力分布のずれ・γ・β → 正規化前後のヒストグラムアニメーション |
| `FeatureSpaceExplorer` | M6 | Canvas | `{ dataUrl?: string }`（既定は `src/data/` の同梱JSONを静的import。`dataUrl` 指定時のみ `public/` 配下からfetch） | バックボーン切替（事前計算JSON） → 2D埋め込み散布図、クラス着色、線形分離線の表示 |
| `TransferPipeline` | M6 | SVG | — | ステップ実行ボタン → 画像→特徴抽出→分類器の各段階を図解ハイライト |
| `IoUNMSPlayground` | M7 | SVG | — | ボックスをドラッグ/リサイズ → IoU値・重なり面積の即時表示。NMSモードで閾値スライダー＋ステップ実行 |
| `LogisticBoundary` | M7 | Canvas | — | 2Dデータ上でλ（L2正則化）・しきい値 → 決定境界と確率の色勾配 |

**M6の埋め込みデータ**: ブラウザでCNNは動かさない。`notebooks/feature_embedding.ipynb` で
実特徴量（img2feat相当）を2D化（PCA/t-SNE）したJSONを事前計算して `src/data/` に置く。
初期実装はガウス混合の合成データでよいが、その旨をUI上に明記し、後で実データJSONに差し替え可能な形にする。

## 6. コンテンツとルーティング

- コンテンツコレクション `modules`: frontmatter = `{ number, title, minutes, description, colab?: {label,url}[] }`（zodで検証）
- `/` トップ: コース説明＋7モジュールカード（所要時間・クイズ達成率）
- `/modules/m1` … `/modules/m7`: 本文。前後モジュールへのナビ、目次サイドバー
- `/glossary`: `src/data/glossary.ts` から生成（日英対訳・50語程度）。用語IDは
  **英語名のkebab-case**（例: `gradient-descent`）で一意とし、`TermDef` は
  `/glossary#<id>` にリンクする
- クイズ定義は `src/data/quiz/m1.ts` 等（型: `{question, choices[], answerIndex, explanation}`）。
  本文MDXから `<QuizBlock module="m1" />` で読み込む

## 7. デザイン

- `styles/global.css` にトークン定義: カラー（ライトベース、アクセント1色＋正解緑/不正解赤）、
  余白スケール、フォント（システムフォントスタック＋Noto Sans JP fallback）
- 本文最大幅 720px、可視化部品は最大幅いっぱい（900px）まで拡張可
- レスポンシブ: 可視化はコンテナ幅に追従（`ResizeObserver`）。スマホでは操作パネルを縦積み
- ダークモード: 初期リリースでは対象外（トークン設計だけ対応可能にしておく）

## 8. ビルド・デプロイ・検証

- `npm run dev` / `npm run build` / `npm run preview`、`npm test`（Vitest）
- `astro.config.mjs` の `site`/`base` は環境変数で上書き可能（ドメイン直下配置を既定）
- デプロイ手順は `docs/deploy.md` に記載（例: `rsync -av dist/ user@server:/var/www/mlsite/`）
- 完了条件: build成功／全7モジュール＋トップ＋用語集が表示／各可視化の操作→即時反映／
  クイズ正誤判定とlocalStorage保存／KaTeX表示／モバイル幅で崩れない

## 9. 実装フェーズの分担計画（Opus/Sonnetサブエージェント）

依存順序（ゲート）:
```
基盤（tokens / ui / types.ts / rng / matrix / nn / datasets）
  → バッチA・B・C 並列（各モジュール専用lib＋可視化部品）
  → 本文MDX M1–M7 並列（props契約は §5.1 で確定済みのため部品完成を待たず着手可、
     ただしビルド確認は部品完成後）
notebooks/ は独立して並列可
  → 統合検証
```

1. **基盤**（1エージェント）: Astro初期化、レイアウト、デザイントークン、ui/部品、
   lib/のうち `types` `rng` `matrix` `nn` `datasets`（§3の公開API通り）、トップ＋用語集の骨組み
2. **可視化バッチA**（M1–M3の部品＋`polyfit` `conv`）、**バッチB**（M4–M5の部品＋`optim-landscape`）、
   **バッチC**（M6–M7の部品＋`iou`）: 基盤完了後に並列。基盤のlib・共有型は**変更禁止**
   （変更が必要ならメインエージェントに報告して仕様を先に更新）
3. **本文MDX**（M1–M7）: モジュール単位で並列。部品の埋め込みは §5.1 の契約に従う
4. **notebooks/**: Colab 4本（logic練習、CIFAR-100×2、img2feat多クラス分類）＋埋め込み生成
5. **統合検証**: build・表示・動作確認、`docs/verification.md` に記録

補足: islandランタイムはReactを採用（サブエージェントの実装安定性優先）。バンドルをさらに
削りたくなった場合の将来最適化として Preact エイリアス化が可能な構成を保つ（React固有API依存を避ける）。

各エージェントへの指示に含めること: CLAUDE.md と本仕様の遵守、`npm run build` 通過後に完了報告、
成果物の要約をMarkdownで返すこと。
