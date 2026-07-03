// 2D グレースケール畳み込み（3×3 カーネル対応）。
// 入力は number[][]（行 × 列）、値の範囲は任意（通常 0–255）。
// 外部ライブラリ依存なし。

/**
 * 2D グレースケール畳み込みを実行する。
 *
 * @param input   入力画像（H × W の number[][]）
 * @param kernel  3×3 カーネル（number[][]）
 * @param padding "same"  → 入力と同じサイズを出力（縁をゼロパディング）
 *                "valid" → パディングなし、出力は (H-2) × (W-2)
 * @returns 畳み込み後の number[][]
 */
export function conv2d(
  input: number[][],
  kernel: number[][],
  padding: "same" | "valid" = "same",
): number[][] {
  const H = input.length;
  const W = input[0]?.length ?? 0;

  if (padding === "same") {
    // ---- ゼロパディング版 ----
    // 1 ピクセルずつゼロパッドした (H+2) × (W+2) の配列を作る。
    const padded: number[][] = Array.from({ length: H + 2 }, () =>
      new Array(W + 2).fill(0),
    );
    for (let i = 0; i < H; i++) {
      for (let j = 0; j < W; j++) {
        padded[i + 1][j + 1] = input[i][j];
      }
    }

    const out: number[][] = Array.from({ length: H }, () =>
      new Array(W).fill(0),
    );
    for (let i = 0; i < H; i++) {
      for (let j = 0; j < W; j++) {
        let sum = 0;
        for (let ki = 0; ki < 3; ki++) {
          for (let kj = 0; kj < 3; kj++) {
            sum += padded[i + ki][j + kj] * kernel[ki][kj];
          }
        }
        out[i][j] = sum;
      }
    }
    return out;
  } else {
    // ---- valid パディング版 ----
    // 出力サイズは (H-2) × (W-2)。縁の 1 ピクセルは出力されない。
    const OH = Math.max(0, H - 2);
    const OW = Math.max(0, W - 2);
    const out: number[][] = Array.from({ length: OH }, () =>
      new Array(OW).fill(0),
    );
    for (let i = 0; i < OH; i++) {
      for (let j = 0; j < OW; j++) {
        let sum = 0;
        for (let ki = 0; ki < 3; ki++) {
          for (let kj = 0; kj < 3; kj++) {
            sum += input[i + ki][j + kj] * kernel[ki][kj];
          }
        }
        out[i][j] = sum;
      }
    }
    return out;
  }
}

/**
 * 値を [0, 255] の整数にクランプする。
 * 畳み込み後の値をピクセルとして表示する際に使用。
 */
export function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * 2D 配列の各値を [0, 255] にクランプする（画像表示用）。
 */
export function clamp2d(img: number[][]): number[][] {
  return img.map((row) => row.map(clamp255));
}

/**
 * 絶対値を [0, 255] にスケーリングする（エッジ検出後の可視化用）。
 * 最大絶対値で割って 255 倍し、負値も正値として扱う。
 * 最大値が 0 のとき（全ゼロ）はゼロ配列を返す。
 */
export function normalizeAbs(img: number[][]): number[][] {
  let maxAbs = 0;
  for (const row of img) {
    for (const v of row) {
      const a = Math.abs(v);
      if (a > maxAbs) maxAbs = a;
    }
  }
  if (maxAbs === 0) return img.map((row) => row.map(() => 0));
  const scale = 255 / maxAbs;
  return img.map((row) => row.map((v) => Math.round(Math.abs(v) * scale)));
}
