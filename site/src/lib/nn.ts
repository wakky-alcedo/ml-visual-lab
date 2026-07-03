// 小規模 MLP（多層パーセプトロン）。全結合層＋手書きの誤差逆伝播。
// 想定規模: 層数 ≤ 4・ノード数 ≤ 8・数百点の 2D データ（M2 の決定境界・M4 のミニ訓練場）。
//
// 公開API（仕様 §3 で固定・変更禁止）:
//   createMLP(config: MLPConfig): MLP
//   mlp.trainStep(batch: Dataset2D): number   // そのバッチの平均損失を返す
//   mlp.predict(x: [number, number]): number[]
//   mlp.reset(seed?: number): void
//   type Optimizer = "sgd" | "momentum" | "adam"（types.ts で定義）
//
// 出力層と損失は出力次元で自動的に決まる:
//   outputDim === 1 → シグモイド出力＋二値交差エントロピー（ラベルは 0/1）
//   outputDim  > 1 → ソフトマックス出力＋交差エントロピー（ラベルはクラスindex）
// どちらの場合も出力層の勾配は (出力 − 目標) に一致するため、逆伝播が簡潔になる。

import type { Activation, Dataset2D, MLP, MLPConfig, Optimizer } from "./types";
import { mulberry32 } from "./rng";
import { addVec, matTVec, matVec, type Matrix, type Vector, zeros, zerosVec } from "./matrix";

export type { Optimizer };

const EPS = 1e-12;

// --- 活性化関数とその微分 --------------------------------------------

function applyActivation(z: number, kind: Activation): number {
  switch (kind) {
    case "tanh":
      return Math.tanh(z);
    case "relu":
      return z > 0 ? z : 0;
    case "sigmoid":
      return 1 / (1 + Math.exp(-z));
  }
}

/** 活性化の微分を「出力 a」から計算する（tanh/sigmoid は出力で書けるため高速）。 */
function activationGradFromOutput(a: number, z: number, kind: Activation): number {
  switch (kind) {
    case "tanh":
      return 1 - a * a;
    case "relu":
      return z > 0 ? 1 : 0;
    case "sigmoid":
      return a * (1 - a);
  }
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/** 数値的に安定なソフトマックス。 */
function softmax(z: Vector): Vector {
  let max = -Infinity;
  for (const v of z) if (v > max) max = v;
  const exps = new Array(z.length);
  let sum = 0;
  for (let i = 0; i < z.length; i++) {
    const e = Math.exp(z[i] - max);
    exps[i] = e;
    sum += e;
  }
  for (let i = 0; i < z.length; i++) exps[i] /= sum;
  return exps;
}

// --- Adam などの状態 --------------------------------------------------

interface LayerState {
  W: Matrix; // (out × in)
  b: Vector; // (out)
  // momentum 用の速度、Adam 用の一次・二次モーメント。
  vW: Matrix;
  vb: Vector;
  mW: Matrix;
  mb: Vector;
  sW: Matrix;
  sb: Vector;
}

// --- 実装本体 ---------------------------------------------------------

class MLPImpl implements MLP {
  readonly config: MLPConfig;
  private sizes: number[];
  private layers: LayerState[];
  private currentSeed: number;
  private adamT = 0;

  constructor(config: MLPConfig) {
    this.config = config;
    this.sizes = [config.inputDim, ...config.hiddenLayers, config.outputDim];
    this.currentSeed = config.seed ?? 42;
    this.layers = [];
    this.reset(this.currentSeed);
  }

  reset(seed?: number): void {
    if (seed !== undefined) this.currentSeed = seed;
    const rng = mulberry32(this.currentSeed);
    this.adamT = 0;
    this.layers = [];
    for (let l = 0; l < this.sizes.length - 1; l++) {
      const fanIn = this.sizes[l];
      const fanOut = this.sizes[l + 1];
      // He 系初期化。ReLU で死なず、tanh/sigmoid でも学習が進む妥当な分散。
      const scale = Math.sqrt(2 / fanIn);
      const W = zeros(fanOut, fanIn);
      for (let i = 0; i < fanOut; i++) {
        for (let j = 0; j < fanIn; j++) W[i][j] = rng.normal(0, 1) * scale;
      }
      this.layers.push({
        W,
        b: zerosVec(fanOut),
        vW: zeros(fanOut, fanIn),
        vb: zerosVec(fanOut),
        mW: zeros(fanOut, fanIn),
        mb: zerosVec(fanOut),
        sW: zeros(fanOut, fanIn),
        sb: zerosVec(fanOut),
      });
    }
  }

  /** 単一入力の順伝播。各層の活性 a と線形出力 z を返す（逆伝播で使う）。 */
  private forward(x: Vector): { activations: Vector[]; zs: Vector[]; output: Vector } {
    const activations: Vector[] = [x];
    const zs: Vector[] = [];
    let a = x;
    const L = this.layers.length;
    for (let l = 0; l < L; l++) {
      const layer = this.layers[l];
      const z = addVec(matVec(layer.W, a), layer.b);
      zs.push(z);
      let out: Vector;
      if (l === L - 1) {
        // 出力層。
        if (this.config.outputDim === 1) {
          out = [sigmoid(z[0])];
        } else {
          out = softmax(z);
        }
      } else {
        out = z.map((v) => applyActivation(v, this.config.activation));
      }
      activations.push(out);
      a = out;
    }
    return { activations, zs, output: a };
  }

  predict(x: [number, number]): number[] {
    return this.forward(x).output;
  }

  trainStep(batch: Dataset2D): number {
    const L = this.layers.length;
    const n = batch.points.length;
    if (n === 0) return 0;

    // 勾配の蓄積器。
    const gW: Matrix[] = this.layers.map((ly) => zeros(ly.W.length, ly.W[0].length));
    const gb: Vector[] = this.layers.map((ly) => zerosVec(ly.b.length));

    let totalLoss = 0;

    for (let s = 0; s < n; s++) {
      const x = batch.points[s];
      const label = batch.labels[s];
      const { activations, zs, output } = this.forward(x);

      // 目標ベクトルと出力層 delta（= 出力 − 目標）、および損失。
      let deltaOut: Vector;
      if (this.config.outputDim === 1) {
        const y = label; // 0 or 1
        const p = output[0];
        deltaOut = [p - y];
        totalLoss += -(y * Math.log(p + EPS) + (1 - y) * Math.log(1 - p + EPS));
      } else {
        deltaOut = output.slice();
        deltaOut[label] -= 1;
        totalLoss += -Math.log(output[label] + EPS);
      }

      // 逆伝播。delta は各層の z に関する損失勾配。
      let delta = deltaOut;
      for (let l = L - 1; l >= 0; l--) {
        const aPrev = activations[l]; // 層 l への入力
        const gWl = gW[l];
        const gbl = gb[l];
        // 勾配を蓄積: dW += delta ⊗ aPrev, db += delta。
        for (let i = 0; i < delta.length; i++) {
          const di = delta[i];
          gbl[i] += di;
          const row = gWl[i];
          for (let j = 0; j < aPrev.length; j++) row[j] += di * aPrev[j];
        }
        if (l > 0) {
          // 前の層へ伝播: delta_prev = (Wᵀ · delta) ⊙ act'(z_prev)。
          const back = matTVec(this.layers[l].W, delta);
          const zPrev = zs[l - 1];
          const aAtPrev = activations[l];
          const newDelta = new Array(back.length);
          for (let j = 0; j < back.length; j++) {
            newDelta[j] =
              back[j] * activationGradFromOutput(aAtPrev[j], zPrev[j], this.config.activation);
          }
          delta = newDelta;
        }
      }
    }

    // バッチ平均へ。L2 正則化項を加える。
    const invN = 1 / n;
    const l2 = this.config.l2 ?? 0;
    for (let l = 0; l < L; l++) {
      const W = this.layers[l].W;
      const gWl = gW[l];
      const gbl = gb[l];
      for (let i = 0; i < gWl.length; i++) {
        gbl[i] *= invN;
        const row = gWl[i];
        const wrow = W[i];
        for (let j = 0; j < row.length; j++) row[j] = row[j] * invN + l2 * wrow[j];
      }
    }

    this.applyUpdate(gW, gb);
    return totalLoss * invN;
  }

  /** 蓄積した勾配で重みを更新する（optimizer に応じた規則）。 */
  private applyUpdate(gW: Matrix[], gb: Vector[]): void {
    const lr = this.config.learningRate;
    const opt: Optimizer = this.config.optimizer;
    const mom = this.config.momentum ?? 0.9;

    if (opt === "adam") this.adamT += 1;
    const beta1 = 0.9;
    const beta2 = 0.999;
    const adamEps = 1e-8;
    const bc1 = 1 - Math.pow(beta1, this.adamT);
    const bc2 = 1 - Math.pow(beta2, this.adamT);

    for (let l = 0; l < this.layers.length; l++) {
      const ly = this.layers[l];
      const gWl = gW[l];
      const gbl = gb[l];
      const rows = ly.W.length;
      const cols = ly.W[0].length;

      for (let i = 0; i < rows; i++) {
        // バイアス。
        this.step1D(ly, i, gbl[i], lr, opt, mom, beta1, beta2, adamEps, bc1, bc2, true, -1);
        // 重み。
        for (let j = 0; j < cols; j++) {
          this.step1D(ly, i, gWl[i][j], lr, opt, mom, beta1, beta2, adamEps, bc1, bc2, false, j);
        }
      }
    }
  }

  /** 1パラメータ分の更新。isBias=true ならバイアス、false なら W[i][j]。 */
  private step1D(
    ly: LayerState,
    i: number,
    grad: number,
    lr: number,
    opt: Optimizer,
    mom: number,
    beta1: number,
    beta2: number,
    adamEps: number,
    bc1: number,
    bc2: number,
    isBias: boolean,
    j: number,
  ): void {
    if (opt === "sgd") {
      if (isBias) ly.b[i] -= lr * grad;
      else ly.W[i][j] -= lr * grad;
      return;
    }
    if (opt === "momentum") {
      if (isBias) {
        ly.vb[i] = mom * ly.vb[i] - lr * grad;
        ly.b[i] += ly.vb[i];
      } else {
        ly.vW[i][j] = mom * ly.vW[i][j] - lr * grad;
        ly.W[i][j] += ly.vW[i][j];
      }
      return;
    }
    // adam
    if (isBias) {
      ly.mb[i] = beta1 * ly.mb[i] + (1 - beta1) * grad;
      ly.sb[i] = beta2 * ly.sb[i] + (1 - beta2) * grad * grad;
      const mHat = ly.mb[i] / bc1;
      const sHat = ly.sb[i] / bc2;
      ly.b[i] -= (lr * mHat) / (Math.sqrt(sHat) + adamEps);
    } else {
      ly.mW[i][j] = beta1 * ly.mW[i][j] + (1 - beta1) * grad;
      ly.sW[i][j] = beta2 * ly.sW[i][j] + (1 - beta2) * grad * grad;
      const mHat = ly.mW[i][j] / bc1;
      const sHat = ly.sW[i][j] / bc2;
      ly.W[i][j] -= (lr * mHat) / (Math.sqrt(sHat) + adamEps);
    }
  }
}

/** MLP を生成する（公開エントリポイント）。 */
export function createMLP(config: MLPConfig): MLP {
  return new MLPImpl(config);
}
