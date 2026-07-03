// 2次元トイデータ生成（circle / xor / gauss / spiral）。
// 決定境界やミニ訓練場（M2・M4）の題材。座標はおおよそ [-1, 1] の範囲に収める。
// すべてシード付き乱数を使い、同じシード→同じデータの再現性を保つ。

import type { Dataset2D, Dataset2DKind, Dataset2DOptions } from "./types";
import { DEFAULT_SEED, mulberry32 } from "./rng";

/** 2つの同心円（内側=クラス0、外側=クラス1）。 */
export function makeCircle(opts: Dataset2DOptions = {}): Dataset2D {
  const n = opts.n ?? 200;
  const noise = opts.noise ?? 0.1;
  const rng = mulberry32(opts.seed ?? DEFAULT_SEED);
  const points: Array<[number, number]> = [];
  const labels: number[] = [];
  for (let i = 0; i < n; i++) {
    const label = i % 2; // 0 と 1 を交互に
    // 内側は半径 0〜0.35、外側は 0.6〜1.0。
    const r = label === 0 ? rng.uniform(0, 0.35) : rng.uniform(0.6, 1.0);
    const theta = rng.uniform(0, 2 * Math.PI);
    const x = r * Math.cos(theta) + rng.normal(0, noise * 0.15);
    const y = r * Math.sin(theta) + rng.normal(0, noise * 0.15);
    points.push([x, y]);
    labels.push(label);
  }
  return { points, labels, numClasses: 2 };
}

/** XOR パターン（対角の象限が同じクラス）。線形分離できない代表例。 */
export function makeXor(opts: Dataset2DOptions = {}): Dataset2D {
  const n = opts.n ?? 200;
  const noise = opts.noise ?? 0.1;
  const rng = mulberry32(opts.seed ?? DEFAULT_SEED);
  const points: Array<[number, number]> = [];
  const labels: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = rng.uniform(-1, 1);
    const y = rng.uniform(-1, 1);
    const nx = x + rng.normal(0, noise * 0.1);
    const ny = y + rng.normal(0, noise * 0.1);
    // 同符号ならクラス0、異符号ならクラス1。
    const label = x * y > 0 ? 0 : 1;
    points.push([nx, ny]);
    labels.push(label);
  }
  return { points, labels, numClasses: 2 };
}

/** 2つのガウス塊（左下=クラス0、右上=クラス1）。線形分離しやすい基本形。 */
export function makeGauss(opts: Dataset2DOptions = {}): Dataset2D {
  const n = opts.n ?? 200;
  const noise = opts.noise ?? 0.15;
  const rng = mulberry32(opts.seed ?? DEFAULT_SEED);
  const points: Array<[number, number]> = [];
  const labels: number[] = [];
  const std = 0.15 + noise * 0.3;
  for (let i = 0; i < n; i++) {
    const label = i % 2;
    const cx = label === 0 ? -0.5 : 0.5;
    const cy = label === 0 ? -0.5 : 0.5;
    points.push([rng.normal(cx, std), rng.normal(cy, std)]);
    labels.push(label);
  }
  return { points, labels, numClasses: 2 };
}

/** 2本の渦巻き（spiral）。非線形分離の難題。 */
export function makeSpiral(opts: Dataset2DOptions = {}): Dataset2D {
  const n = opts.n ?? 200;
  const noise = opts.noise ?? 0.1;
  const rng = mulberry32(opts.seed ?? DEFAULT_SEED);
  const points: Array<[number, number]> = [];
  const labels: number[] = [];
  const perClass = Math.floor(n / 2);
  for (let c = 0; c < 2; c++) {
    for (let i = 0; i < perClass; i++) {
      const t = (i / perClass) * 3.5; // 巻き数
      const r = 0.15 + t * 0.25;
      const angle = t * 2.2 + c * Math.PI; // クラスごとに半周ずらす
      const x = r * Math.cos(angle) + rng.normal(0, noise * 0.1);
      const y = r * Math.sin(angle) + rng.normal(0, noise * 0.1);
      points.push([x, y]);
      labels.push(c);
    }
  }
  return { points, labels, numClasses: 2 };
}

/** 種類を指定してデータセットを生成するディスパッチャ。 */
export function makeDataset(kind: Dataset2DKind, opts: Dataset2DOptions = {}): Dataset2D {
  switch (kind) {
    case "circle":
      return makeCircle(opts);
    case "xor":
      return makeXor(opts);
    case "gauss":
      return makeGauss(opts);
    case "spiral":
      return makeSpiral(opts);
  }
}
