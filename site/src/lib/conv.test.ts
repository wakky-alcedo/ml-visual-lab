import { describe, it, expect } from "vitest";
import { conv2d, clamp255, clamp2d, normalizeAbs } from "./conv";

// =====================================================================
// テスト用カーネル
// =====================================================================

/** 恒等カーネル: 中心だけ 1。入力をそのまま返す。 */
const IDENTITY: number[][] = [
  [0, 0, 0],
  [0, 1, 0],
  [0, 0, 0],
];

/** 均一ぼかし（3×3 平均プーリング）: 各要素 1/9。 */
const BLUR: number[][] = [
  [1 / 9, 1 / 9, 1 / 9],
  [1 / 9, 1 / 9, 1 / 9],
  [1 / 9, 1 / 9, 1 / 9],
];

/** 横エッジ検出（Sobel 縦方向）。 */
const EDGE_H: number[][] = [
  [-1, -2, -1],
  [0, 0, 0],
  [1, 2, 1],
];

/** 縦エッジ検出（Sobel 横方向）。 */
const EDGE_V: number[][] = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1],
];

// =====================================================================
// conv2d: padding="same"
// =====================================================================

describe("conv2d: padding=same", () => {
  it("恒等カーネル: 内部値は入力と同じ（縁はゼロパッドで変わる）", () => {
    const input = [
      [10, 20, 30],
      [40, 50, 60],
      [70, 80, 90],
    ];
    const out = conv2d(input, IDENTITY, "same");
    // 3×3 の中心 [1][1] は恒等でそのまま
    expect(out[1][1]).toBeCloseTo(50, 8);
  });

  it("恒等カーネル: 出力サイズは入力と同じ", () => {
    const input = Array.from({ length: 5 }, (_, i) =>
      Array.from({ length: 7 }, (_, j) => i * 7 + j),
    );
    const out = conv2d(input, IDENTITY, "same");
    expect(out).toHaveLength(5);
    expect(out[0]).toHaveLength(7);
  });

  it("ぼかしカーネル: 一様な画像の中央部は同じ値", () => {
    // 全ピクセル 90 の 5×5 画像。中央は隣接もすべて 90 なので平均も 90。
    const input = Array.from({ length: 5 }, () => new Array(5).fill(90));
    const out = conv2d(input, BLUR, "same");
    expect(out[2][2]).toBeCloseTo(90, 8);
  });

  it("恒等カーネル: すべての値が保存される（5×5 画像の各中央ピクセル）", () => {
    const input = [
      [1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
      [11, 12, 13, 14, 15],
      [16, 17, 18, 19, 20],
      [21, 22, 23, 24, 25],
    ];
    const out = conv2d(input, IDENTITY, "same");
    // 中央部（縁から離れた点）は恒等なので同じ
    expect(out[2][2]).toBeCloseTo(13, 8);
    expect(out[1][3]).toBeCloseTo(9, 8);
  });

  it("縦エッジカーネル: 垂直方向の境界でエッジが出る", () => {
    // 左3列=0, 右3列=255 の 6×6 画像（水平境界なし、垂直境界あり）
    const input = Array.from({ length: 6 }, () =>
      Array.from({ length: 6 }, (_, j) => (j < 3 ? 0 : 255)),
    );
    const out = conv2d(input, EDGE_V, "same");
    // 縦エッジが列方向の境界で強く出るはず
    const maxVal = Math.max(...out.map((row) => Math.max(...row.map(Math.abs))));
    expect(maxVal).toBeGreaterThan(100);
  });

  it("横エッジカーネル: 水平方向の境界でエッジが出る", () => {
    // 上3行=0, 下3行=255 の 6×6 画像
    const input = Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, () => (i < 3 ? 0 : 255)),
    );
    const out = conv2d(input, EDGE_H, "same");
    const maxVal = Math.max(...out.map((row) => Math.max(...row.map(Math.abs))));
    expect(maxVal).toBeGreaterThan(100);
  });
});

// =====================================================================
// conv2d: padding="valid"
// =====================================================================

describe("conv2d: padding=valid", () => {
  it("出力サイズは (H-2) × (W-2)", () => {
    const input = Array.from({ length: 5 }, (_, i) =>
      Array.from({ length: 7 }, (_, j) => i + j),
    );
    const out = conv2d(input, IDENTITY, "valid");
    expect(out).toHaveLength(3); // 5-2
    expect(out[0]).toHaveLength(5); // 7-2
  });

  it("恒等カーネル（valid）: 出力は入力の内部領域 [1..H-2][1..W-2] と一致", () => {
    const input = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [13, 14, 15, 16],
    ];
    // valid では (4-2)×(4-2) = 2×2 の出力
    const out = conv2d(input, IDENTITY, "valid");
    expect(out[0][0]).toBeCloseTo(6, 8);   // input[1][1]
    expect(out[0][1]).toBeCloseTo(7, 8);   // input[1][2]
    expect(out[1][0]).toBeCloseTo(10, 8);  // input[2][1]
    expect(out[1][1]).toBeCloseTo(11, 8);  // input[2][2]
  });

  it("3×3 入力の valid 出力は 1×1 のスカラー", () => {
    const input = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ];
    const out = conv2d(input, IDENTITY, "valid");
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveLength(1);
    expect(out[0][0]).toBeCloseTo(1, 8);
  });
});

// =====================================================================
// clamp255 / clamp2d / normalizeAbs
// =====================================================================

describe("clamp255", () => {
  it("[0, 255] にクランプ（正常値はそのまま）", () => {
    expect(clamp255(0)).toBe(0);
    expect(clamp255(128)).toBe(128);
    expect(clamp255(255)).toBe(255);
  });

  it("範囲外の値をクランプ", () => {
    expect(clamp255(-10)).toBe(0);
    expect(clamp255(-0.001)).toBe(0);
    expect(clamp255(256)).toBe(255);
    expect(clamp255(1000)).toBe(255);
  });

  it("小数を四捨五入してクランプ", () => {
    expect(clamp255(127.4)).toBe(127);
    expect(clamp255(127.5)).toBe(128);
    expect(clamp255(127.6)).toBe(128);
  });
});

describe("clamp2d", () => {
  it("2D 配列の全要素を [0, 255] にクランプ", () => {
    const img = [
      [-5, 128, 300],
      [0, 127.5, 255],
    ];
    const out = clamp2d(img);
    expect(out[0][0]).toBe(0);
    expect(out[0][1]).toBe(128);
    expect(out[0][2]).toBe(255);
    expect(out[1][0]).toBe(0);
    expect(out[1][1]).toBe(128); // 四捨五入
    expect(out[1][2]).toBe(255);
  });
});

describe("normalizeAbs", () => {
  it("最大絶対値を 255 にスケール", () => {
    const img = [[0, 100, -200]];
    const out = normalizeAbs(img);
    expect(out[0][0]).toBe(0);
    // 100/200*255 = 127.5 → Math.round は 127 または 128（実装依存）
    expect(out[0][1]).toBeGreaterThanOrEqual(127);
    expect(out[0][1]).toBeLessThanOrEqual(128);
    expect(out[0][2]).toBe(255);  // |-200|/200*255 = 255
  });

  it("全ゼロの場合はゼロを返す", () => {
    const img = [[0, 0], [0, 0]];
    const out = normalizeAbs(img);
    expect(out[0][0]).toBe(0);
    expect(out[1][1]).toBe(0);
  });

  it("負値の絶対値も正しく処理する", () => {
    const img = [[-50, -100], [50, 100]];
    const out = normalizeAbs(img);
    // 最大絶対値 100 → 50/100*255 = 127.5 → 127 または 128（実装依存）
    expect(out[0][0]).toBeGreaterThanOrEqual(127);
    expect(out[0][0]).toBeLessThanOrEqual(128);
    expect(out[1][1]).toBe(255); // |100|*255/100 = 255
  });
});
