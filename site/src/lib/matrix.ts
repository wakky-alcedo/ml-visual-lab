// 最小限の行列・ベクトル演算。
// 行列は number[][]（行優先: mat[i][j] は i 行 j 列）、ベクトルは number[]。
// nn.ts の順伝播・逆伝播と polyfit 系の正規方程式で使う土台。

export type Vector = number[];
export type Matrix = number[][];

/** rows × cols のゼロ行列を作る。 */
export function zeros(rows: number, cols: number): Matrix {
  const m: Matrix = new Array(rows);
  for (let i = 0; i < rows; i++) m[i] = new Array(cols).fill(0);
  return m;
}

/** 長さ n のゼロベクトルを作る。 */
export function zerosVec(n: number): Vector {
  return new Array(n).fill(0);
}

/** 行列とベクトルの積 A·x。A は (rows × cols)、x は長さ cols、結果は長さ rows。 */
export function matVec(A: Matrix, x: Vector): Vector {
  const rows = A.length;
  const out = new Array(rows);
  for (let i = 0; i < rows; i++) {
    const row = A[i];
    let sum = 0;
    for (let j = 0; j < row.length; j++) sum += row[j] * x[j];
    out[i] = sum;
  }
  return out;
}

/** 転置行列 Aᵀ·x。A は (rows × cols)、x は長さ rows、結果は長さ cols。 */
export function matTVec(A: Matrix, x: Vector): Vector {
  const rows = A.length;
  const cols = rows > 0 ? A[0].length : 0;
  const out = new Array(cols).fill(0);
  for (let i = 0; i < rows; i++) {
    const row = A[i];
    const xi = x[i];
    for (let j = 0; j < cols; j++) out[j] += row[j] * xi;
  }
  return out;
}

/** 要素ごとの和 a + b。 */
export function addVec(a: Vector, b: Vector): Vector {
  const out = new Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
  return out;
}

/** 要素ごとの差 a - b。 */
export function subVec(a: Vector, b: Vector): Vector {
  const out = new Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
  return out;
}

/** 要素ごとの積（アダマール積） a ⊙ b。 */
export function mulVec(a: Vector, b: Vector): Vector {
  const out = new Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * b[i];
  return out;
}

/** スカラー倍 s·a。 */
export function scaleVec(a: Vector, s: number): Vector {
  const out = new Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * s;
  return out;
}

/** 内積 a·b。 */
export function dot(a: Vector, b: Vector): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/** 外積 a ⊗ b。結果は (a.length × b.length) 行列。 */
export function outer(a: Vector, b: Vector): Matrix {
  const out: Matrix = new Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const row = new Array(b.length);
    const ai = a[i];
    for (let j = 0; j < b.length; j++) row[j] = ai * b[j];
    out[i] = row;
  }
  return out;
}

/** 転置。 */
export function transpose(A: Matrix): Matrix {
  const rows = A.length;
  const cols = rows > 0 ? A[0].length : 0;
  const out = zeros(cols, rows);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) out[j][i] = A[i][j];
  }
  return out;
}

/** 行列積 A·B。A は (m × n)、B は (n × p)、結果は (m × p)。 */
export function matMul(A: Matrix, B: Matrix): Matrix {
  const m = A.length;
  const n = A.length > 0 ? A[0].length : 0;
  const p = B.length > 0 ? B[0].length : 0;
  const out = zeros(m, p);
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < n; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      const brow = B[k];
      const orow = out[i];
      for (let j = 0; j < p; j++) orow[j] += aik * brow[j];
    }
  }
  return out;
}

/**
 * 連立一次方程式 A·x = b を解く（部分ピボット付きガウス消去）。
 * A は正方 (n × n)。polyfit の正規方程式で使う。破壊的に扱わないようコピーする。
 */
export function solve(A: Matrix, b: Vector): Vector {
  const n = A.length;
  // 拡大係数行列を作る（コピー）。
  const M: Matrix = new Array(n);
  for (let i = 0; i < n; i++) M[i] = [...A[i], b[i]];

  for (let col = 0; col < n; col++) {
    // 部分ピボット選択。
    let pivot = col;
    let maxAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > maxAbs) {
        maxAbs = v;
        pivot = r;
      }
    }
    if (maxAbs === 0) throw new Error("solve: 特異行列（一意解なし）");
    if (pivot !== col) {
      const tmp = M[col];
      M[col] = M[pivot];
      M[pivot] = tmp;
    }
    // 前進消去。
    const pivotRow = M[col];
    const pivotVal = pivotRow[col];
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / pivotVal;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= factor * pivotRow[c];
    }
  }

  // 後退代入。
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    x[i] = sum / M[i][i];
  }
  return x;
}
