import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";

describe("rng: mulberry32", () => {
  it("同じシードは同じ数列を生成する", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("異なるシードは異なる数列（先頭値が違う）", () => {
    expect(mulberry32(1).next()).not.toBe(mulberry32(2).next());
  });

  it("next は [0,1) を返す", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("uniform / int が範囲内", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const u = r.uniform(-2, 5);
      expect(u).toBeGreaterThanOrEqual(-2);
      expect(u).toBeLessThan(5);
      const n = r.int(1, 6);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
    }
  });

  it("normal の平均・標準偏差が概ね一致する", () => {
    const r = mulberry32(99);
    const N = 20000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < N; i++) {
      const v = r.normal(1, 2);
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / N;
    const variance = sumSq / N - mean * mean;
    expect(mean).toBeCloseTo(1, 1);
    expect(Math.sqrt(variance)).toBeCloseTo(2, 1);
  });

  it("shuffle は要素を保持する（順列）", () => {
    const r = mulberry32(3);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = r.shuffle([...arr]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(arr);
  });
});
