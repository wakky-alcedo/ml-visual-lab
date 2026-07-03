import { describe, it, expect } from "vitest";
import {
  computeIoU,
  intersectionArea,
  intersectionRect,
  nms,
  nmsSteps,
  unionArea,
} from "./iou";
import type { BBox } from "./iou";

// 基本的な矩形:
// A = [0,0,4,4]（面積 16）
// B = [2,2,6,6]（面積 16）
// 交差 = [2,2,4,4]（面積 4）、和集合 = 16+16-4 = 28

describe("intersectionArea", () => {
  it("重ならない矩形の交差面積は 0", () => {
    expect(intersectionArea([0, 0, 1, 1], [2, 2, 4, 4])).toBe(0);
  });

  it("完全一致する矩形の交差面積は面積と等しい", () => {
    expect(intersectionArea([0, 0, 3, 3], [0, 0, 3, 3])).toBe(9);
  });

  it("一部重なる矩形の交差面積", () => {
    // A=[0,0,4,4] B=[2,2,6,6] → 交差=[2,2,4,4] → 面積4
    expect(intersectionArea([0, 0, 4, 4], [2, 2, 6, 6])).toBe(4);
  });

  it("端が接しているだけなら交差は 0", () => {
    expect(intersectionArea([0, 0, 2, 2], [2, 0, 4, 2])).toBe(0);
  });
});

describe("unionArea", () => {
  it("重ならない矩形の和集合は各面積の合計", () => {
    // 1×1 と 2×2 で合計 5
    expect(unionArea([0, 0, 1, 1], [2, 2, 4, 4])).toBe(1 + 4);
  });

  it("完全一致する矩形の和集合は面積と等しい", () => {
    expect(unionArea([0, 0, 2, 2], [0, 0, 2, 2])).toBe(4);
  });

  it("一部重なる場合: union = A + B - intersection", () => {
    // A=[0,0,4,4](16) B=[2,2,6,6](16) intersection=4 → union=28
    expect(unionArea([0, 0, 4, 4], [2, 2, 6, 6])).toBe(28);
  });
});

describe("computeIoU", () => {
  it("完全一致の IoU は 1", () => {
    expect(computeIoU([0, 0, 5, 5], [0, 0, 5, 5])).toBe(1);
  });

  it("全く重ならない矩形の IoU は 0", () => {
    expect(computeIoU([0, 0, 1, 1], [5, 5, 8, 8])).toBe(0);
  });

  it("半分重なる矩形: IoU = intersection / union", () => {
    // A=[0,0,4,4](16) B=[2,2,6,6](16) inter=4 union=28 → IoU = 4/28 ≈ 0.1429
    const iou = computeIoU([0, 0, 4, 4], [2, 2, 6, 6]);
    expect(iou).toBeCloseTo(4 / 28, 5);
  });

  it("IoU は常に [0, 1] の範囲", () => {
    const cases: [BBox, BBox][] = [
      [[0, 0, 10, 10], [5, 5, 15, 15]],
      [[0, 0, 3, 3], [1, 1, 2, 2]],
      [[0, 0, 2, 2], [1, 0, 3, 2]],
    ];
    for (const [a, b] of cases) {
      const iou = computeIoU(a, b);
      expect(iou).toBeGreaterThanOrEqual(0);
      expect(iou).toBeLessThanOrEqual(1);
    }
  });

  it("IoU は対称（a,b の順序によらない）", () => {
    const a: BBox = [10, 20, 40, 50];
    const b: BBox = [25, 30, 60, 70];
    expect(computeIoU(a, b)).toBeCloseTo(computeIoU(b, a), 10);
  });

  it("内包する場合（B が A に完全に含まれる）", () => {
    // A=[0,0,10,10](100) B=[2,2,8,8](36) inter=36 union=100 IoU=36/100=0.36
    expect(computeIoU([0, 0, 10, 10], [2, 2, 8, 8])).toBeCloseTo(36 / 100, 5);
  });
});

describe("intersectionRect", () => {
  it("重ならない矩形は null を返す", () => {
    expect(intersectionRect([0, 0, 1, 1], [2, 2, 4, 4])).toBeNull();
  });

  it("端が接している場合も null", () => {
    expect(intersectionRect([0, 0, 2, 2], [2, 0, 4, 2])).toBeNull();
  });

  it("重なる場合は正しい交差矩形を返す", () => {
    // A=[0,0,4,4] B=[2,1,6,5] → 交差=[2,1,4,4]
    expect(intersectionRect([0, 0, 4, 4], [2, 1, 6, 5])).toEqual([2, 1, 4, 4]);
  });

  it("完全一致の場合はそのまま返す", () => {
    expect(intersectionRect([1, 2, 5, 6], [1, 2, 5, 6])).toEqual([1, 2, 5, 6]);
  });
});

describe("nms", () => {
  it("スコア最高のボックスは必ず残る", () => {
    const boxes: BBox[] = [
      [0, 0, 10, 10],
      [1, 1, 11, 11],
      [50, 50, 60, 60], // 離れている
    ];
    const scores = [0.9, 0.8, 0.7];
    const kept = nms(boxes, scores, 0.5);
    expect(kept[0]).toBe(0); // 最高スコアが先頭
    expect(kept).toContain(2); // 離れたボックスも残る
  });

  it("IoU 閾値を超えた低スコアのボックスは除去される", () => {
    const boxes: BBox[] = [
      [0, 0, 10, 10],
      [1, 1, 11, 11], // box0 と大きく重なる
    ];
    const scores = [0.9, 0.8];
    const kept = nms(boxes, scores, 0.3);
    expect(kept).toEqual([0]);
    expect(kept).not.toContain(1);
  });

  it("閾値が 1.0 なら完全一致以外は除去しない", () => {
    const boxes: BBox[] = [
      [0, 0, 5, 5],
      [3, 3, 8, 8],
    ];
    // IoU = 4/(25+25-4) = 4/46 ≈ 0.087 < 1.0
    const kept = nms(boxes, [0.9, 0.8], 1.0);
    expect(kept.length).toBe(2);
  });

  it("ボックスが 1 つのときは必ずそれを残す", () => {
    const kept = nms([[0, 0, 5, 5]], [0.9], 0.5);
    expect(kept).toEqual([0]);
  });

  it("ボックスが空のときは空配列", () => {
    const kept = nms([], [], 0.5);
    expect(kept).toEqual([]);
  });

  it("スコア降順で kept が返る", () => {
    const boxes: BBox[] = [
      [0, 0, 2, 2], // score 0.5
      [10, 10, 12, 12], // score 0.9
      [20, 20, 22, 22], // score 0.7
    ];
    const scores = [0.5, 0.9, 0.7];
    const kept = nms(boxes, scores, 0.5);
    // 互いに重ならないので全部残るが、スコード降順になるはず
    expect(kept[0]).toBe(1); // 0.9 が先頭
    expect(kept[1]).toBe(2); // 0.7 が次
    expect(kept[2]).toBe(0); // 0.5 が最後
  });
});

describe("nmsSteps", () => {
  it("各ステップに pivot と suppressed が含まれる", () => {
    const boxes: BBox[] = [
      [0, 0, 10, 10],
      [1, 1, 11, 11], // box0 と大きく重なる → box0 が採用されたら除去
      [50, 50, 60, 60], // 離れている → 別ステップのpivot
    ];
    const scores = [0.9, 0.8, 0.7];
    const steps = nmsSteps(boxes, scores, 0.5);

    expect(steps[0].pivot).toBe(0); // 最高スコア
    expect(steps[0].suppressed).toContain(1); // box1 は除去
    expect(steps[1].pivot).toBe(2); // 次は box2
    expect(steps[1].suppressed).toHaveLength(0); // 残りなし
  });

  it("全ステップのpivotを集めると nms と一致する", () => {
    const boxes: BBox[] = [
      [0, 0, 8, 8],
      [2, 2, 10, 10],
      [30, 30, 40, 40],
      [32, 30, 42, 40],
    ];
    const scores = [0.95, 0.82, 0.78, 0.65];
    const threshold = 0.4;

    const keptNms = nms(boxes, scores, threshold);
    const keptSteps = nmsSteps(boxes, scores, threshold).map(s => s.pivot);

    expect(keptSteps).toEqual(keptNms);
  });
});
