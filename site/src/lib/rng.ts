// シード付き擬似乱数（mulberry32）。
// すべての可視化はこの乱数を使い、「リセット→同じシード→同じ結果」の再現性を保証する。
// React 等のフレームワークには依存しない純粋な TypeScript ユーティリティ。

export interface Rng {
  /** [0, 1) の一様乱数を返す。 */
  next(): number;
  /** [min, max) の一様乱数を返す。 */
  uniform(min: number, max: number): number;
  /** 平均 mean・標準偏差 std の正規乱数を返す（Box–Muller 法）。 */
  normal(mean?: number, std?: number): number;
  /** [min, max] の整数乱数を返す。 */
  int(min: number, max: number): number;
  /** 配列をその場でシャッフルして返す（Fisher–Yates）。 */
  shuffle<T>(array: T[]): T[];
}

/**
 * mulberry32: 32bit のシードから決定論的に乱数列を生成する軽量アルゴリズム。
 * 同じシードを与えれば必ず同じ数列になる。
 */
export function mulberry32(seed: number): Rng {
  // 32bit 符号なし整数に丸める。
  let state = seed >>> 0;

  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // normal() の Box–Muller はペアで生成されるため、片方をキャッシュする。
  let spare: number | null = null;

  const normal = (mean = 0, std = 1): number => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return mean + std * value;
    }
    let u = 0;
    let v = 0;
    // u が 0 だと log が -Infinity になるため引き直す。
    while (u === 0) u = next();
    while (v === 0) v = next();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    spare = mag * Math.sin(2.0 * Math.PI * v);
    return mean + std * (mag * Math.cos(2.0 * Math.PI * v));
  };

  const uniform = (min: number, max: number): number => min + (max - min) * next();

  const int = (min: number, max: number): number =>
    Math.floor(min + (max - min + 1) * next());

  const shuffle = <T>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  };

  return { next, uniform, normal, int, shuffle };
}

/** 既定シード。可視化の初期状態はこの値を使うと全部品で揃う。 */
export const DEFAULT_SEED = 42;
