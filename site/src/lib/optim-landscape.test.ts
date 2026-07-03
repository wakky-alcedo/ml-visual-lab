import { describe, it, expect } from "vitest";
import {
  LANDSCAPES,
  getLandscape,
  computeTrajectory,
  type LandscapeKind,
} from "./optim-landscape";

const KINDS: LandscapeKind[] = ["convex", "valley", "saddle", "multimodal"];

/** 中心差分による数値勾配。解析勾配の検算に使う。 */
function numericalGrad(
  f: (x: number, y: number) => number,
  x: number,
  y: number,
  h = 1e-5,
): [number, number] {
  const dx = (f(x + h, y) - f(x - h, y)) / (2 * h);
  const dy = (f(x, y + h) - f(x, y - h)) / (2 * h);
  return [dx, dy];
}

describe("optim-landscape: 地形定義", () => {
  it("4種類すべてが揃っている", () => {
    expect(LANDSCAPES).toHaveLength(4);
    for (const kind of KINDS) {
      expect(getLandscape(kind).kind).toBe(kind);
    }
  });

  it("損失は開始点で有限", () => {
    for (const l of LANDSCAPES) {
      const [sx, sy] = l.start;
      expect(Number.isFinite(l.loss(sx, sy))).toBe(true);
    }
  });

  it("解析勾配が数値勾配と一致する", () => {
    const samples: Array<[number, number]> = [
      [0.3, -0.4],
      [1.1, 0.7],
      [-0.8, 1.2],
      [-1.4, -0.9],
    ];
    for (const l of LANDSCAPES) {
      for (const [x, y] of samples) {
        const [ax, ay] = l.grad(x, y);
        const [nx, ny] = numericalGrad(l.loss, x, y);
        expect(ax).toBeCloseTo(nx, 3);
        expect(ay).toBeCloseTo(ny, 3);
      }
    }
  });

  it("凸・多峰は最小点で勾配がほぼ0", () => {
    for (const kind of ["convex", "multimodal"] as const) {
      const l = getLandscape(kind);
      const [mx, my] = l.minimum!;
      const [gx, gy] = l.grad(mx, my);
      expect(Math.abs(gx)).toBeLessThan(1e-6);
      expect(Math.abs(gy)).toBeLessThan(1e-6);
    }
  });
});

describe("optim-landscape: 軌跡計算", () => {
  it("凸地形はSGDで最小点へ近づく（損失が減る）", () => {
    const l = getLandscape("convex");
    const res = computeTrajectory(l, {
      optimizer: "sgd",
      learningRate: l.defaultLearningRate,
      steps: 200,
    });
    expect(res.diverged).toBe(false);
    const first = res.points[0].loss;
    const last = res.points[res.points.length - 1].loss;
    expect(last).toBeLessThan(first);
    expect(last).toBeLessThan(0.01);
  });

  it("同じ入力なら同じ軌跡（決定論的・再現性）", () => {
    const l = getLandscape("valley");
    const opts = { optimizer: "adam" as const, learningRate: 0.02, steps: 150 };
    const a = computeTrajectory(l, opts);
    const b = computeTrajectory(l, opts);
    expect(a.points).toEqual(b.points);
  });

  it("学習率が大きすぎると発散する", () => {
    const l = getLandscape("convex");
    const res = computeTrajectory(l, {
      optimizer: "sgd",
      learningRate: 2.0, // 2xで 2*x が発散
      steps: 200,
    });
    expect(res.diverged).toBe(true);
  });

  it("各オプティマイザで有限の軌跡が得られる", () => {
    for (const kind of KINDS) {
      const l = getLandscape(kind);
      for (const optimizer of ["sgd", "momentum", "adam"] as const) {
        const res = computeTrajectory(l, {
          optimizer,
          learningRate: l.defaultLearningRate,
          steps: 120,
        });
        for (const p of res.points) {
          expect(Number.isFinite(p.x)).toBe(true);
          expect(Number.isFinite(p.y)).toBe(true);
          expect(Number.isFinite(p.loss)).toBe(true);
        }
        // 開始点は必ず含まれる。
        expect(res.points[0].x).toBeCloseTo(l.start[0]);
        expect(res.points[0].y).toBeCloseTo(l.start[1]);
      }
    }
  });

  it("Adamは細長い谷でSGDより速く谷底へ近づく", () => {
    const l = getLandscape("valley");
    const steps = 300;
    const sgd = computeTrajectory(l, { optimizer: "sgd", learningRate: 0.004, steps });
    const adam = computeTrajectory(l, { optimizer: "adam", learningRate: 0.02, steps });
    const sgdLast = sgd.points[sgd.points.length - 1].loss;
    const adamLast = adam.points[adam.points.length - 1].loss;
    expect(adamLast).toBeLessThan(sgdLast);
  });

  it("開始点を指定すると軌跡の始点が変わる", () => {
    const l = getLandscape("convex");
    const res = computeTrajectory(l, {
      optimizer: "sgd",
      learningRate: 0.1,
      steps: 10,
      start: [1.0, -1.0],
    });
    expect(res.points[0].x).toBeCloseTo(1.0);
    expect(res.points[0].y).toBeCloseTo(-1.0);
  });
});
