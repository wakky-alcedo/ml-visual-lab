/**
 * 矩形 IoU（Intersection over Union）計算と NMS（Non-Maximum Suppression）。
 * M7「物体検出と、その先へ」の可視化（IoUNMSPlayground）で使用する。
 *
 * バウンディングボックスは [x1, y1, x2, y2] 形式（x1 < x2、y1 < y2 を前提）。
 */

/** バウンディングボックス: [x1, y1, x2, y2]（左上・右下の座標）。 */
export type BBox = [number, number, number, number];

/**
 * 2矩形の交差領域（Intersection）の面積を返す。
 * 重ならない場合は 0。
 */
export function intersectionArea(a: BBox, b: BBox): number {
  const ix1 = Math.max(a[0], b[0]);
  const iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(a[2], b[2]);
  const iy2 = Math.min(a[3], b[3]);
  return Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
}

/**
 * 2矩形の和集合（Union）の面積を返す。
 * Union = 面積A + 面積B − 交差面積。
 */
export function unionArea(a: BBox, b: BBox): number {
  const aArea = (a[2] - a[0]) * (a[3] - a[1]);
  const bArea = (b[2] - b[0]) * (b[3] - b[1]);
  return aArea + bArea - intersectionArea(a, b);
}

/**
 * 2矩形の IoU（Intersection over Union）を計算する。
 * 0（まったく重なっていない）〜 1（完全に一致）の値。
 *
 * 物体検出では「予測ボックスと正解ボックスがどれだけ一致しているか」の指標として使う。
 * 一般的な評価閾値は 0.5（"it's detected if IoU ≥ 0.5"）。
 */
export function computeIoU(a: BBox, b: BBox): number {
  const inter = intersectionArea(a, b);
  if (inter === 0) return 0;
  const uni = unionArea(a, b);
  return uni <= 0 ? 0 : inter / uni;
}

/**
 * 2矩形の交差領域を BBox として返す。重ならない場合は null。
 * 可視化で交差領域を描画するために使う。
 */
export function intersectionRect(a: BBox, b: BBox): BBox | null {
  const ix1 = Math.max(a[0], b[0]);
  const iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(a[2], b[2]);
  const iy2 = Math.min(a[3], b[3]);
  if (ix2 <= ix1 || iy2 <= iy1) return null;
  return [ix1, iy1, ix2, iy2];
}

/**
 * NMS（Non-Maximum Suppression）を実行し、残すボックスのインデックス配列を返す。
 *
 * アルゴリズム:
 *   1. スコアの降順でソート。
 *   2. 最高スコアのボックスを「採用」する。
 *   3. それと IoU > iouThreshold なボックスを「除去」する（同じ物体の重複予測とみなす）。
 *   4. 残りで 2 を繰り返す。
 *
 * @param boxes  ボックス群（BBox[]）
 * @param scores 各ボックスの信頼度スコア
 * @param iouThreshold  この閾値を超えるIoUのボックスを除去する（典型値 0.5）
 * @returns 残すボックスのインデックス（スコア降順）
 */
export function nms(boxes: BBox[], scores: number[], iouThreshold: number): number[] {
  // スコア降順でインデックスをソート。
  const order = Array.from({ length: boxes.length }, (_, i) => i).sort(
    (a, b) => scores[b] - scores[a],
  );
  const suppressed = new Set<number>();
  const kept: number[] = [];

  for (const i of order) {
    if (suppressed.has(i)) continue;
    kept.push(i);
    // i よりスコアが低い残りのボックスと IoU を比較。
    for (const j of order) {
      if (suppressed.has(j) || j === i) continue;
      if (computeIoU(boxes[i], boxes[j]) > iouThreshold) {
        suppressed.add(j);
      }
    }
  }

  return kept;
}

/**
 * NMS のステップ実行情報を返す。
 * 各ステップは「注目ボックス（pivot）」と「そのステップで除去されたボックス」で構成される。
 * IoUNMSPlayground のステップ実行可視化に使う。
 *
 * @returns 各ステップの { pivot: インデックス; suppressed: 除去されたインデックス[] }
 */
export function nmsSteps(
  boxes: BBox[],
  scores: number[],
  iouThreshold: number,
): { pivot: number; suppressed: number[] }[] {
  const order = Array.from({ length: boxes.length }, (_, i) => i).sort(
    (a, b) => scores[b] - scores[a],
  );
  const alreadySuppressed = new Set<number>();
  const steps: { pivot: number; suppressed: number[] }[] = [];

  for (const i of order) {
    if (alreadySuppressed.has(i)) continue;
    const thisSuppressed: number[] = [];
    for (const j of order) {
      if (alreadySuppressed.has(j) || j === i) continue;
      if (computeIoU(boxes[i], boxes[j]) > iouThreshold) {
        thisSuppressed.push(j);
        alreadySuppressed.add(j);
      }
    }
    steps.push({ pivot: i, suppressed: thisSuppressed });
  }

  return steps;
}
