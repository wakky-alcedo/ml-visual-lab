// 共有型の一元定義。
// 複数バッチ（可視化A/B/C・本文MDX）から参照されるため、ここが単一の情報源となる。
// このファイルの型は基盤エージェントの所有物であり、後続バッチは変更禁止
//（変更が必要ならメインエージェントに報告して仕様を先に更新すること）。

// =====================================================================
// 2D データセット（datasets.ts・nn.ts が使用）
// =====================================================================

/**
 * 2次元のトイデータセット。
 * points[i] = [x, y] の座標、labels[i] = そのクラス（0,1,...）。
 * points と labels は同じ長さで、インデックスが対応する。
 */
export interface Dataset2D {
  points: Array<[number, number]>;
  labels: number[];
  /** クラス数（2値分類なら 2）。 */
  numClasses: number;
}

/** 2Dトイデータの種類。 */
export type Dataset2DKind = "circle" | "xor" | "gauss" | "spiral";

/** データ生成の共通オプション。 */
export interface Dataset2DOptions {
  /** 生成する総点数（既定 200）。 */
  n?: number;
  /** 付与するノイズの強さ（0で無ノイズ、既定は種類ごとに設定）。 */
  noise?: number;
  /** 乱数シード（省略時は rng.DEFAULT_SEED）。 */
  seed?: number;
}

// =====================================================================
// ニューラルネット（nn.ts）
// =====================================================================

/** 活性化関数の種類。 */
export type Activation = "tanh" | "relu" | "sigmoid";

/** 最適化アルゴリズム。 */
export type Optimizer = "sgd" | "momentum" | "adam";

/**
 * MLP の構成。
 * inputDim: 入力次元（2Dデータなら 2）。
 * hiddenLayers: 各隠れ層のノード数（例 [4, 4] で 2 隠れ層）。層数 ≤ 4・ノード数 ≤ 8 を想定。
 * outputDim: 出力次元（2値分類なら 1、多クラスなら クラス数）。
 * activation: 隠れ層の活性化関数。
 * optimizer: 最適化手法。
 * learningRate: 学習率 η。
 * momentum: momentum 係数（optimizer が "momentum" のとき使用、既定 0.9）。
 * seed: 重み初期化のシード。
 * l2: L2 正則化係数（既定 0）。
 */
export interface MLPConfig {
  inputDim: number;
  hiddenLayers: number[];
  outputDim: number;
  activation: Activation;
  optimizer: Optimizer;
  learningRate: number;
  momentum?: number;
  seed?: number;
  l2?: number;
}

/**
 * MLP の公開インターフェース（仕様 §3 で固定）。
 * 実装は nn.ts の createMLP が返す。
 */
export interface MLP {
  /** 1バッチ分の学習を1ステップ実行し、そのバッチでの平均損失を返す。 */
  trainStep(batch: Dataset2D): number;
  /** 入力 x に対する出力ベクトルを返す（出力層の値。2値分類なら [p]）。 */
  predict(x: [number, number]): number[];
  /** 重みを初期化し直す。seed 省略時は生成時のシードを使う。 */
  reset(seed?: number): void;
  /** 現在の構成（読み取り用）。 */
  readonly config: MLPConfig;
}

// =====================================================================
// クイズ（src/data/quiz/*, QuizBlock.tsx）
// =====================================================================

/**
 * クイズ1問の定義。
 * answerIndex は choices の 0 始まりインデックス。
 */
export interface QuizQuestion {
  /** 問題文（プレーンテキストまたは簡易 Markdown/KaTeX を含みうる）。 */
  question: string;
  /** 選択肢（2つ以上）。 */
  choices: string[];
  /** 正解の選択肢インデックス（0 始まり）。 */
  answerIndex: number;
  /** 解説（正誤判定後に表示）。 */
  explanation: string;
}

/** モジュール1回分のクイズ（複数問）。 */
export type QuizSet = QuizQuestion[];

/**
 * クイズの進捗（localStorage["mlsite:quiz:<moduleSlug>"] に保存する形）。
 * answered[i] = 選んだ選択肢インデックス（未回答は undefined）。
 */
export interface QuizProgress {
  /** 各問で選んだ選択肢。長さはクイズ問題数。 */
  answered: (number | undefined)[];
  /** 正解した問題数。 */
  correct: number;
  /** 総問題数。 */
  total: number;
}

// =====================================================================
// 特徴埋め込み JSON（FeatureSpaceExplorer / M6）
// =====================================================================

/**
 * 事前計算した特徴埋め込みの1点。
 * xy: 2次元に落とした座標（PCA/t-SNE 後）。
 * label: クラスのインデックス。
 */
export interface EmbeddingPoint {
  xy: [number, number];
  label: number;
}

/**
 * 特徴埋め込み JSON のスキーマ（src/data/ 同梱・public/ からのfetch共通）。
 * notebooks/feature_embedding.ipynb が実データからこの形式で書き出す。
 * synthetic が true の場合は合成データであり、UI 上にその旨を明記する。
 */
export interface EmbeddingDataset {
  /** バックボーン名（例 "resnet18"）。UIの切替表示に使う。 */
  backbone: string;
  /** 2D化の手法（"pca" | "tsne" など）。 */
  method: string;
  /** クラス名の一覧（label インデックスに対応）。 */
  classNames: string[];
  /** 埋め込み点群。 */
  points: EmbeddingPoint[];
  /** 合成データかどうか（true なら UI に「合成データ」表示）。 */
  synthetic: boolean;
}

// =====================================================================
// UI 部品の props（components/ui, components/interactive）
// =====================================================================

/** Slider の props。 */
export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** 表示単位（例 "点", "%"）。省略可。 */
  unit?: string;
  /** 値の表示フォーマッタ（省略時は数値をそのまま）。 */
  format?: (value: number) => string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** PlaygroundFrame の props。 */
export interface PlaygroundFrameProps {
  /** 可視化のタイトル。 */
  title: string;
  /** 「試してみよう」ガイド文（任意のノード）。 */
  guide?: import("react").ReactNode;
  /** 操作パネル（スライダー等）。 */
  controls?: import("react").ReactNode;
  /** 描画領域（SVG/Canvas）。children として渡す。 */
  children?: import("react").ReactNode;
  /** リセットボタン押下時の処理。省略時はボタン非表示。 */
  onReset?: () => void;
  /** リセットボタンのラベル（既定「リセット」）。 */
  resetLabel?: string;
}

/** QuizBlock の props。 */
export interface QuizBlockProps {
  /** モジュールのスラグ（例 "m1"）。localStorage キーと quiz データの読込に使う。 */
  module: string;
  /** 明示的に問題を渡す場合（省略時は module から読み込む想定）。 */
  questions?: QuizSet;
}

/** ConvFilterLab（M3）の props。 */
export interface ConvFilterLabProps {
  imageSrc?: string;
}

/** AugmentPreview（M5）の props。 */
export interface AugmentPreviewProps {
  imageSrc?: string;
}

/** FeatureSpaceExplorer（M6）の props。 */
export interface FeatureSpaceExplorerProps {
  /** 指定時のみ public/ 配下から fetch。省略時は src/data/ 同梱JSONを使う。 */
  dataUrl?: string;
}
