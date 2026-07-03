import { describe, it, expect } from "vitest";
import {
  addVec,
  dot,
  matMul,
  matTVec,
  matVec,
  outer,
  scaleVec,
  solve,
  subVec,
  transpose,
} from "./matrix";

describe("matrix: 基本演算", () => {
  it("matVec は A·x を計算する", () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    expect(matVec(A, [1, 1])).toEqual([3, 7]);
    expect(matVec(A, [2, 0])).toEqual([2, 6]);
  });

  it("matTVec は Aᵀ·x を計算する", () => {
    const A = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    // Aᵀ は 3×2。Aᵀ·[1,1] = 各列の和。
    expect(matTVec(A, [1, 1])).toEqual([5, 7, 9]);
  });

  it("add/sub/scale/dot", () => {
    expect(addVec([1, 2], [3, 4])).toEqual([4, 6]);
    expect(subVec([3, 4], [1, 1])).toEqual([2, 3]);
    expect(scaleVec([1, 2, 3], 2)).toEqual([2, 4, 6]);
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it("outer は外積行列を作る", () => {
    expect(outer([1, 2], [3, 4])).toEqual([
      [3, 4],
      [6, 8],
    ]);
  });

  it("transpose", () => {
    expect(
      transpose([
        [1, 2, 3],
        [4, 5, 6],
      ]),
    ).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it("matMul は行列積を計算する", () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const B = [
      [5, 6],
      [7, 8],
    ];
    expect(matMul(A, B)).toEqual([
      [19, 22],
      [43, 50],
    ]);
  });
});

describe("matrix: solve（正規方程式の土台）", () => {
  it("2元連立を解く", () => {
    // 2x + y = 5, x + 3y = 10 → x=1, y=3
    const A = [
      [2, 1],
      [1, 3],
    ];
    const x = solve(A, [5, 10]);
    expect(x[0]).toBeCloseTo(1, 10);
    expect(x[1]).toBeCloseTo(3, 10);
  });

  it("ピボットが必要な系（先頭が0）でも解ける", () => {
    const A = [
      [0, 2],
      [1, 1],
    ];
    // 2y = 4 → y=2; x + y = 3 → x=1
    const x = solve(A, [4, 3]);
    expect(x[0]).toBeCloseTo(1, 10);
    expect(x[1]).toBeCloseTo(2, 10);
  });

  it("最小二乗（正規方程式 AᵀA x = Aᵀb）で直線当てはめ", () => {
    // 点 (0,1),(1,3),(2,5) は y = 2x + 1 に完全一致。
    const design = [
      [1, 0],
      [1, 1],
      [1, 2],
    ];
    const y = [1, 3, 5];
    const At = transpose(design);
    const AtA = matMul(At, design);
    const Atb = matVec(At, y);
    const coeff = solve(AtA, Atb); // [切片, 傾き]
    expect(coeff[0]).toBeCloseTo(1, 8);
    expect(coeff[1]).toBeCloseTo(2, 8);
  });

  it("特異行列では例外を投げる", () => {
    const A = [
      [1, 2],
      [2, 4],
    ];
    expect(() => solve(A, [1, 2])).toThrow();
  });
});
