// 2変数の損失地形（loss landscape）と、その上を降下する最適化アルゴリズムの軌跡計算。
// M4「学習のしくみ — 勾配降下と最適化」の可視化 LossLandscape が使う。
//
// 4種類の地形を用意する:
//   convex     … 素直なお椀（凸関数）。どこから始めても最小点へ収束する
//   valley     … 細長い谷（Rosenbrock風）。SGD はジグザグして遅い、Adam は速い
//   saddle     … 鞍点（saddle point）。勾配が小さくなり一度は止まりかけるが最小ではない
//   multimodal … 多峰性（局所最小がたくさん）。GD は近くの谷にはまる
//
// 最適化は仕様 §3 の Optimizer 型（"sgd" | "momentum" | "adam"）を再利用する。
// ここでは 2 パラメータ (x, y) に対して勾配降下を回し、軌跡（各ステップの座標と損失）を返す。
// 学習率を大きくすると軌跡が発散する様子もそのまま計算される（呼び出し側で発散を表示できる）。

import type { Optimizer } from "./types";

export type { Optimizer };

/** 地形の種類。 */
export type LandscapeKind = "convex" | "valley" | "saddle" | "multimodal";

/** 描画範囲。 */
export interface Domain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** 2変数損失地形の定義。 */
export interface Landscape {
  kind: LandscapeKind;
  /** 日本語表示名。 */
  name: string;
  /** 一言解説（UI のヒントに使う）。 */
  description: string;
  /** 損失 L(x, y)。 */
  loss(x: number, y: number): number;
  /** 勾配 ∇L(x, y) = [∂L/∂x, ∂L/∂y]。 */
  grad(x: number, y: number): [number, number];
  /** 等高線を描く座標範囲。 */
  domain: Domain;
  /** 既定の開始点（クリックで上書き可能）。 */
  start: [number, number];
  /** この地形で見やすい既定の学習率。 */
  defaultLearningRate: number;
  /** 最小点（存在すれば表示用に置く。鞍点には無い）。 */
  minimum?: [number, number];
}

const TWO_PI = Math.PI * 2;

// --- 4種類の地形 -----------------------------------------------------------

/** 凸関数（楕円のお椀）。曲率が軸ごとに違うので、素直だが真円ではない。 */
const convex: Landscape = {
  kind: "convex",
  name: "凸（お椀）",
  description: "どこから転がしても必ず谷底へ届きます。",
  loss: (x, y) => x * x + 2 * y * y,
  grad: (x, y) => [2 * x, 4 * y],
  domain: { xMin: -2.2, xMax: 2.2, yMin: -2.2, yMax: 2.2 },
  start: [-1.8, 1.7],
  defaultLearningRate: 0.1,
  minimum: [0, 0],
};

/** 細長い谷（Rosenbrock 風）。谷底が湾曲した溝で、素朴なSGDはジグザグして進みにくい。 */
const valley: Landscape = {
  kind: "valley",
  name: "細長い谷",
  description: "湾曲した溝。SGDはジグザグ、Momentum/Adamは速く進みます。",
  loss: (x, y) => {
    const a = 1 - x;
    const b = y - x * x;
    return a * a + 10 * b * b;
  },
  grad: (x, y) => {
    const b = y - x * x;
    const dx = -2 * (1 - x) - 40 * x * b;
    const dy = 20 * b;
    return [dx, dy];
  },
  domain: { xMin: -2, xMax: 2, yMin: -1, yMax: 3 },
  start: [-1.3, 1.6],
  defaultLearningRate: 0.004,
  minimum: [1, 1],
};

/** 鞍点。x方向は谷、y方向は山。原点で勾配が消えるが最小ではない。 */
const saddle: Landscape = {
  kind: "saddle",
  name: "鞍点",
  description: "馬の鞍の形。勾配が小さくなり止まりかけますが最小ではありません。",
  loss: (x, y) => x * x - y * y,
  grad: (x, y) => [2 * x, -2 * y],
  domain: { xMin: -2, xMax: 2, yMin: -2, yMax: 2 },
  start: [1.8, 0.04],
  defaultLearningRate: 0.05,
  // 最小点は存在しない（下に開いた方向がある）。
};

/** 多峰性（Rastrigin 風）。お椀に細かな凹凸が重なり、局所最小が多数できる。 */
const multimodal: Landscape = {
  kind: "multimodal",
  name: "多峰（でこぼこ）",
  description: "局所最小がたくさん。GDは近くの谷にはまりがちです。",
  loss: (x, y) => 0.5 * (x * x + y * y) - Math.cos(TWO_PI * x) - Math.cos(TWO_PI * y) + 2,
  grad: (x, y) => [
    x + TWO_PI * Math.sin(TWO_PI * x),
    y + TWO_PI * Math.sin(TWO_PI * y),
  ],
  domain: { xMin: -2.5, xMax: 2.5, yMin: -2.5, yMax: 2.5 },
  start: [-2.15, 1.85],
  defaultLearningRate: 0.02,
  minimum: [0, 0],
};

/** 全地形の一覧（UI の選択順）。 */
export const LANDSCAPES: Landscape[] = [convex, valley, saddle, multimodal];

const BY_KIND: Record<LandscapeKind, Landscape> = {
  convex,
  valley,
  saddle,
  multimodal,
};

/** 種類から地形を取り出す。 */
export function getLandscape(kind: LandscapeKind): Landscape {
  return BY_KIND[kind];
}

// --- 軌跡計算 ---------------------------------------------------------------

/** 軌跡計算のオプション。 */
export interface TrajectoryOptions {
  optimizer: Optimizer;
  learningRate: number;
  /** Momentum 係数（optimizer が "momentum" のとき使用、既定 0.9）。 */
  momentum?: number;
  /** ステップ数（既定 200）。 */
  steps?: number;
  /** 開始点（省略時は地形の既定開始点）。 */
  start?: [number, number];
}

/** 軌跡の1点。 */
export interface TrajectoryPoint {
  x: number;
  y: number;
  loss: number;
}

/** 軌跡の計算結果。 */
export interface TrajectoryResult {
  points: TrajectoryPoint[];
  /** 途中で発散（非有限 or 極端に大きな値）したか。 */
  diverged: boolean;
}

// これを超えたら発散とみなして計算を打ち切る（配列を有限に保つため）。
const DIVERGE_LIMIT = 1e6;

/**
 * 指定した地形の上を最適化アルゴリズムで降下させ、各ステップの座標と損失を返す。
 * 乱数を使わない決定論的計算なので、同じ入力なら必ず同じ軌跡になる（再現性）。
 * 学習率が大きすぎると座標が発散し、その様子も軌跡として記録される。
 */
export function computeTrajectory(
  landscape: Landscape,
  opts: TrajectoryOptions,
): TrajectoryResult {
  const steps = opts.steps ?? 200;
  const lr = opts.learningRate;
  const mom = opts.momentum ?? 0.9;
  const opt = opts.optimizer;
  let [x, y] = opts.start ?? landscape.start;

  // Momentum 用の速度、Adam 用の1次・2次モーメント。
  let vx = 0;
  let vy = 0;
  let mx = 0;
  let my = 0;
  let sx = 0;
  let sy = 0;
  const beta1 = 0.9;
  const beta2 = 0.999;
  const adamEps = 1e-8;

  const points: TrajectoryPoint[] = [{ x, y, loss: landscape.loss(x, y) }];
  let diverged = false;

  for (let t = 1; t <= steps; t++) {
    const [gx, gy] = landscape.grad(x, y);

    if (opt === "sgd") {
      x -= lr * gx;
      y -= lr * gy;
    } else if (opt === "momentum") {
      vx = mom * vx - lr * gx;
      vy = mom * vy - lr * gy;
      x += vx;
      y += vy;
    } else {
      // adam
      mx = beta1 * mx + (1 - beta1) * gx;
      my = beta1 * my + (1 - beta1) * gy;
      sx = beta2 * sx + (1 - beta2) * gx * gx;
      sy = beta2 * sy + (1 - beta2) * gy * gy;
      const bc1 = 1 - Math.pow(beta1, t);
      const bc2 = 1 - Math.pow(beta2, t);
      const mxHat = mx / bc1;
      const myHat = my / bc1;
      const sxHat = sx / bc2;
      const syHat = sy / bc2;
      x -= (lr * mxHat) / (Math.sqrt(sxHat) + adamEps);
      y -= (lr * myHat) / (Math.sqrt(syHat) + adamEps);
    }

    const loss = landscape.loss(x, y);

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.abs(x) > DIVERGE_LIMIT ||
      Math.abs(y) > DIVERGE_LIMIT ||
      !Number.isFinite(loss)
    ) {
      diverged = true;
      break;
    }

    points.push({ x, y, loss });
  }

  return { points, diverged };
}
