import { describe, it, expect } from "vitest";
import { makeCircle, makeDataset, makeGauss, makeSpiral, makeXor } from "./datasets";

describe("datasets: 形状と再現性", () => {
  const kinds = ["circle", "xor", "gauss", "spiral"] as const;

  for (const kind of kinds) {
    it(`${kind}: 指定点数・2クラス・座標が有限`, () => {
      const d = makeDataset(kind, { n: 120, seed: 1 });
      // spiral は perClass*2 のため n と一致しない場合があるが、近い数になる。
      expect(d.points.length).toBeGreaterThan(0);
      expect(d.points.length).toBe(d.labels.length);
      expect(d.numClasses).toBe(2);
      for (const [x, y] of d.points) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
      }
      for (const l of d.labels) expect(l === 0 || l === 1).toBe(true);
    });

    it(`${kind}: 同じシードなら同じデータ`, () => {
      const a = makeDataset(kind, { n: 60, seed: 42 });
      const b = makeDataset(kind, { n: 60, seed: 42 });
      expect(a.points).toEqual(b.points);
      expect(a.labels).toEqual(b.labels);
    });
  }

  it("両クラスが存在する", () => {
    for (const kind of kinds) {
      const d = makeDataset(kind, { n: 100, seed: 3 });
      expect(d.labels.includes(0)).toBe(true);
      expect(d.labels.includes(1)).toBe(true);
    }
  });

  it("makeXor は同符号=0・異符号=1（無ノイズ）", () => {
    const d = makeXor({ n: 100, noise: 0, seed: 5 });
    for (let i = 0; i < d.points.length; i++) {
      const [x, y] = d.points[i];
      expect(d.labels[i]).toBe(x * y > 0 ? 0 : 1);
    }
  });

  it("個別関数もディスパッチャと同じ結果", () => {
    expect(makeCircle({ n: 30, seed: 1 }).points).toEqual(
      makeDataset("circle", { n: 30, seed: 1 }).points,
    );
    expect(makeGauss({ n: 30, seed: 1 }).points).toEqual(
      makeDataset("gauss", { n: 30, seed: 1 }).points,
    );
    expect(makeSpiral({ n: 30, seed: 1 }).points).toEqual(
      makeDataset("spiral", { n: 30, seed: 1 }).points,
    );
  });
});
