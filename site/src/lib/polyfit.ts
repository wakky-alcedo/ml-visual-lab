// 多項式最小二乗フィッティング（リッジ正則化オプション付き）。
// matrix.ts の solve を再利用して正規方程式を解く。

import { solve, matMul, matTVec, transpose } from "./matrix";

/**
 * 多項式最小二乗フィッティング。
 *
 * 設計行列 Φ（バンダーモンド行列）:
 *   Φ[i][j] = xs[i]^j  (i=0..n-1, j=0..degree)
 *
 * 正規方程式（リッジ正則化付き）:
 *   (ΦᵀΦ + λI) w = Φᵀy
 *
 * @param xs     入力値の配列（長さ n）
 * @param ys     出力値の配列（長さ n、xs と対応）
 * @param degree 多項式の次数（0=定数、1=線形、...、15 まで想定）
 * @param lambda L2 正則化（リッジ）係数（デフォルト 0）。
 *               n < degree+1 のとき必ず正の値を渡すこと（そうでないと特異行列になる）。
 * @returns 係数ベクトル w（長さ degree+1）。w[j] が x^j の係数。
 */
export function polyfit(
  xs: number[],
  ys: number[],
  degree: number,
  lambda = 0,
): number[] {
  const n = xs.length;
  const d = degree + 1; // 係数の数（切片含む）

  // ---- 設計行列 Φ（n × d）を構築 ----
  const Phi: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = new Array(d);
    let xpow = 1;
    for (let j = 0; j < d; j++) {
      row[j] = xpow;
      xpow *= xs[i];
    }
    Phi[i] = row;
  }

  // ---- 正規行列 A = ΦᵀΦ（d × d）----
  const A = matMul(transpose(Phi), Phi);

  // ---- リッジ項 λI を加算 ----
  for (let i = 0; i < d; i++) A[i][i] += lambda;

  // ---- 右辺 b = Φᵀy（長さ d）----
  const b = matTVec(Phi, ys);

  // ---- (ΦᵀΦ + λI) w = Φᵀy を解く ----
  return solve(A, b);
}

/**
 * 多項式の予測値を1点で計算する。
 *
 * y = Σ_{j=0}^{d-1} coeffs[j] * x^j
 *
 * @param coeffs polyfit の返り値（係数ベクトル、長さ degree+1）
 * @param x      予測したい入力値
 * @returns      予測値
 */
export function polyPredict(coeffs: number[], x: number): number {
  let y = 0;
  let xpow = 1;
  for (let j = 0; j < coeffs.length; j++) {
    y += coeffs[j] * xpow;
    xpow *= x;
  }
  return y;
}

/**
 * 複数点の予測値をまとめて計算する（polyPredict を配列化したユーティリティ）。
 */
export function polyPredictAll(coeffs: number[], xs: number[]): number[] {
  return xs.map((x) => polyPredict(coeffs, x));
}

/**
 * 平均二乗誤差（MSE: Mean Squared Error）を計算する。
 *
 * MSE = (1/n) Σ (ys[i] - ypred[i])²
 */
export function mse(ys: number[], ypred: number[]): number {
  const n = ys.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const diff = ys[i] - ypred[i];
    sum += diff * diff;
  }
  return sum / n;
}
