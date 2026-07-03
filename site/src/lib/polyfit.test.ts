import { describe, it, expect } from "vitest";
import { polyfit, polyPredict, polyPredictAll, mse } from "./polyfit";

describe("polyfit: 多項式フィッティング", () => {
  it("次数 0（定数）: すべての点が同じ値なら w[0] がその値", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [3, 3, 3, 3, 3];
    const w = polyfit(xs, ys, 0);
    expect(w).toHaveLength(1);
    expect(w[0]).toBeCloseTo(3, 8);
  });

  it("次数 1（線形）: y = 2x + 1 に完全フィット", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = xs.map((x) => 2 * x + 1);
    const w = polyfit(xs, ys, 1);
    expect(w).toHaveLength(2);
    expect(w[0]).toBeCloseTo(1, 6); // 切片
    expect(w[1]).toBeCloseTo(2, 6); // 傾き
  });

  it("次数 2（二次）: y = x² − 2x + 1 に完全フィット", () => {
    const xs = [-2, -1, 0, 1, 2, 3];
    const ys = xs.map((x) => x * x - 2 * x + 1);
    const w = polyfit(xs, ys, 2);
    expect(w).toHaveLength(3);
    expect(w[0]).toBeCloseTo(1, 5);   // 定数項
    expect(w[1]).toBeCloseTo(-2, 5);  // x の係数
    expect(w[2]).toBeCloseTo(1, 5);   // x² の係数
  });

  it("係数が返す長さは degree + 1", () => {
    const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const ys = xs.map((x) => Math.sin(x));
    for (const deg of [0, 1, 3, 5]) {
      const w = polyfit(xs, ys, deg);
      expect(w).toHaveLength(deg + 1);
    }
  });
});

describe("polyPredict: 1点予測", () => {
  it("w = [1, 2, 3] → y = 1 + 2x + 3x²", () => {
    const w = [1, 2, 3];
    expect(polyPredict(w, 0)).toBeCloseTo(1, 10);
    expect(polyPredict(w, 1)).toBeCloseTo(6, 10);  // 1+2+3
    expect(polyPredict(w, 2)).toBeCloseTo(17, 10); // 1+4+12
    expect(polyPredict(w, -1)).toBeCloseTo(2, 10); // 1-2+3
  });

  it("次数 0（定数）: x に関わらず w[0]", () => {
    expect(polyPredict([5], 3)).toBeCloseTo(5, 10);
    expect(polyPredict([5], -99)).toBeCloseTo(5, 10);
  });
});

describe("polyPredictAll: 複数点予測", () => {
  it("y = x のとき入力をそのまま返す", () => {
    const w = [0, 1]; // y = x
    const xs = [1, 2, 3];
    const result = polyPredictAll(w, xs);
    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(1, 10);
    expect(result[1]).toBeCloseTo(2, 10);
    expect(result[2]).toBeCloseTo(3, 10);
  });
});

describe("mse: 平均二乗誤差", () => {
  it("完全一致のとき 0", () => {
    expect(mse([1, 2, 3], [1, 2, 3])).toBeCloseTo(0, 10);
  });

  it("各誤差が 1 のとき MSE = 1", () => {
    expect(mse([0, 0], [1, 1])).toBeCloseTo(1, 10);
  });

  it("誤差が ±1 交互のとき MSE = 1", () => {
    expect(mse([0, 2], [1, 1])).toBeCloseTo(1, 10);
  });

  it("2 乗の平均であることを確認", () => {
    // 誤差: [3, 4] → 二乗: [9, 16] → 平均 12.5
    expect(mse([0, 0], [3, 4])).toBeCloseTo(12.5, 8);
  });
});

describe("polyfit: リッジ正則化", () => {
  it("lambda > 0 でも線形フィットはほぼ同じ（正則化の影響は小さい）", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = xs.map((x) => 2 * x + 1);
    const wRidge = polyfit(xs, ys, 1, 0.01);
    // 予測の MSE が小さいはず
    const pred = polyPredictAll(wRidge, xs);
    expect(mse(ys, pred)).toBeLessThan(0.01);
  });

  it("n < degree+1 のとき lambda > 0 で解ける（ランク不足の回避）", () => {
    // データ点 3 つ、次数 5（d=6）→ lambda なしは特異行列
    const xs = [0, 1, 2];
    const ys = [0, 1, 4];
    const w = polyfit(xs, ys, 5, 1.0);
    expect(w).toHaveLength(6);
    for (const c of w) {
      expect(Number.isFinite(c)).toBe(true);
    }
  });

  it("lambda=0 かつ n >= degree+1 なら解ける", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = xs.map((x) => x * x);
    const w = polyfit(xs, ys, 2, 0);
    expect(w[0]).toBeCloseTo(0, 5);
    expect(w[1]).toBeCloseTo(0, 5);
    expect(w[2]).toBeCloseTo(1, 5);
  });
});
