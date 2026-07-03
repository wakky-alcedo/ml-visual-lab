import { describe, it, expect } from "vitest";
import { createMLP } from "./nn";
import type { Dataset2D, MLPConfig } from "./types";
import { makeXor, makeGauss } from "./datasets";

function accuracy(mlp: ReturnType<typeof createMLP>, data: Dataset2D): number {
  let correct = 0;
  for (let i = 0; i < data.points.length; i++) {
    const out = mlp.predict(data.points[i]);
    let pred: number;
    if (out.length === 1) pred = out[0] >= 0.5 ? 1 : 0;
    else pred = out.indexOf(Math.max(...out));
    if (pred === data.labels[i]) correct++;
  }
  return correct / data.points.length;
}

describe("nn: 出力の妥当性", () => {
  it("2値分類の出力はシグモイドで (0,1)", () => {
    const mlp = createMLP({
      inputDim: 2,
      hiddenLayers: [4],
      outputDim: 1,
      activation: "tanh",
      optimizer: "sgd",
      learningRate: 0.1,
      seed: 1,
    });
    const p = mlp.predict([0.3, -0.7])[0];
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });

  it("多クラス出力はソフトマックスで和が1", () => {
    const mlp = createMLP({
      inputDim: 2,
      hiddenLayers: [4],
      outputDim: 3,
      activation: "relu",
      optimizer: "sgd",
      learningRate: 0.1,
      seed: 2,
    });
    const out = mlp.predict([0.1, 0.2]);
    expect(out.length).toBe(3);
    const sum = out.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
    for (const v of out) expect(v).toBeGreaterThan(0);
  });
});

describe("nn: 再現性", () => {
  it("同じシード・同じ操作なら同じ予測になる", () => {
    const cfg: MLPConfig = {
      inputDim: 2,
      hiddenLayers: [5, 5],
      outputDim: 1,
      activation: "tanh",
      optimizer: "adam",
      learningRate: 0.03,
      seed: 7,
    };
    const data = makeXor({ n: 100, seed: 3 });
    const a = createMLP(cfg);
    const b = createMLP(cfg);
    for (let i = 0; i < 20; i++) {
      a.trainStep(data);
      b.trainStep(data);
    }
    for (const x of [[0.5, 0.5], [-0.4, 0.9]] as [number, number][]) {
      expect(a.predict(x)[0]).toBe(b.predict(x)[0]);
    }
  });

  it("reset で初期状態に戻る", () => {
    const mlp = createMLP({
      inputDim: 2,
      hiddenLayers: [4],
      outputDim: 1,
      activation: "tanh",
      optimizer: "sgd",
      learningRate: 0.1,
      seed: 9,
    });
    const before = mlp.predict([0.2, 0.4])[0];
    const data = makeGauss({ n: 100, seed: 1 });
    for (let i = 0; i < 50; i++) mlp.trainStep(data);
    const after = mlp.predict([0.2, 0.4])[0];
    expect(after).not.toBe(before);
    mlp.reset();
    expect(mlp.predict([0.2, 0.4])[0]).toBe(before);
  });
});

describe("nn: 勾配降下の正しさ", () => {
  it("固定バッチで損失が単調に近く減少する（勾配の向きが正しい）", () => {
    const mlp = createMLP({
      inputDim: 2,
      hiddenLayers: [6],
      outputDim: 1,
      activation: "tanh",
      optimizer: "sgd",
      learningRate: 0.05,
      seed: 4,
    });
    const data = makeGauss({ n: 80, seed: 5 });
    const first = mlp.trainStep(data);
    let prev = first;
    let increases = 0;
    for (let i = 0; i < 200; i++) {
      const loss = mlp.trainStep(data);
      if (loss > prev + 1e-9) increases++;
      prev = loss;
    }
    // 小さい学習率のSGDなら基本的に単調減少。まれな増加のみ許容。
    expect(increases).toBeLessThan(5);
    expect(prev).toBeLessThan(first);
  });
});

describe("nn: 学習能力", () => {
  it("線形分離可能なガウスをほぼ完全に分類できる", () => {
    const mlp = createMLP({
      inputDim: 2,
      hiddenLayers: [4],
      outputDim: 1,
      activation: "tanh",
      optimizer: "adam",
      learningRate: 0.05,
      seed: 11,
    });
    const data = makeGauss({ n: 200, seed: 6 });
    for (let i = 0; i < 300; i++) mlp.trainStep(data);
    expect(accuracy(mlp, data)).toBeGreaterThan(0.95);
  });

  it("XOR をミニMLPで学習できる（非線形分離）", () => {
    const mlp = createMLP({
      inputDim: 2,
      hiddenLayers: [8, 8],
      outputDim: 1,
      activation: "tanh",
      optimizer: "adam",
      learningRate: 0.05,
      seed: 12,
    });
    const data = makeXor({ n: 200, noise: 0, seed: 7 });
    for (let i = 0; i < 800; i++) mlp.trainStep(data);
    expect(accuracy(mlp, data)).toBeGreaterThan(0.9);
  });
});
