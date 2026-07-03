// FeatureSpaceExplorer（M6・Canvas）
// 事前学習済みモデルの特徴を2D化した散布図を表示する。
// バックボーンを切り替えてクラスのまとまり具合を比較し、
// 線形分離線をONにすることで「良い特徴なら線形分類器だけで十分」を体感できる。
// データは合成データ（embeddings-demo.json）で、その旨をUI上に明記している。
import { useEffect, useMemo, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import type { EmbeddingDataset, FeatureSpaceExplorerProps } from "../../lib/types";
import rawEmbeddingsData from "../../data/embeddings-demo.json";

const ALL_DATASETS = rawEmbeddingsData as unknown as EmbeddingDataset[];

const CLASS_COLORS = ["#e53e3e", "#16a34a", "#2563eb", "#ea580c", "#7c3aed", "#db2777"];
const CLASS_COLORS_DARK = ["#c53030", "#15803d", "#1d4ed8", "#c2410c", "#6d28d9", "#be185d"];

const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

function useContainerWidth(ref: React.RefObject<HTMLElement | null>, initial = 640) {
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.max(280, Math.floor(e.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

// シンプルな多クラス線形分類器（ソフトマックス + 勾配降下）。
// 2D特徴空間上でオンライン学習し、決定境界を描画するために使う。
function trainLinearClassifier(
  points: [number, number][],
  labels: number[],
  numClasses: number,
  epochs = 400,
): { W: number[][]; b: number[] } {
  const n = points.length;
  // 重み初期化（ゼロ）
  const W = Array.from({ length: numClasses }, () => [0, 0]);
  const b = Array.from({ length: numClasses }, () => 0);
  const lr = 0.08;
  const l2 = 0.01;

  for (let ep = 0; ep < epochs; ep++) {
    for (let i = 0; i < n; i++) {
      const [x0, x1] = points[i];
      const y = labels[i];
      // スコア計算
      const scores = W.map((w, k) => w[0] * x0 + w[1] * x1 + b[k]);
      // ソフトマックス
      const maxS = Math.max(...scores);
      const exps = scores.map((s) => Math.exp(s - maxS));
      const sumE = exps.reduce((a, v) => a + v, 0);
      const probs = exps.map((e) => e / sumE);
      // 勾配
      for (let k = 0; k < numClasses; k++) {
        const d = probs[k] - (k === y ? 1 : 0);
        W[k][0] -= lr * (d * x0 / n + l2 * W[k][0]);
        W[k][1] -= lr * (d * x1 / n + l2 * W[k][1]);
        b[k] -= lr * (d / n);
      }
    }
  }
  return { W, b };
}

function argmax(arr: number[]): number {
  let m = -Infinity;
  let idx = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > m) {
      m = arr[i];
      idx = i;
    }
  }
  return idx;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const bl = parseInt(hex.slice(5, 7), 16);
  return [r, g, bl];
}

export default function FeatureSpaceExplorer({ dataUrl }: FeatureSpaceExplorerProps) {
  // dataUrl 指定時は fetch、省略時は静的 import を使う
  const [fetchedDatasets, setFetchedDatasets] = useState<EmbeddingDataset[] | null>(null);
  useEffect(() => {
    if (!dataUrl) {
      setFetchedDatasets(null);
      return;
    }
    let alive = true;
    fetch(dataUrl)
      .then((r) => r.json())
      .then((data) => {
        if (alive) setFetchedDatasets(Array.isArray(data) ? (data as EmbeddingDataset[]) : [data as EmbeddingDataset]);
      })
      .catch(() => { if (alive) setFetchedDatasets([]); });
    return () => { alive = false; };
  }, [dataUrl]);

  const datasets = fetchedDatasets ?? ALL_DATASETS;
  const [backboneIdx, setBackboneIdx] = useState(0);
  const [showSeparator, setShowSeparator] = useState(false);

  const dataset = datasets[Math.min(backboneIdx, datasets.length - 1)];

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cssW = useContainerWidth(wrapRef, 640);
  const cssH = Math.round(Math.min(460, Math.max(300, cssW * 0.62)));

  // データ範囲を計算
  const bounds = useMemo(() => {
    if (!dataset || dataset.points.length === 0) return { xLo: -5, xHi: 5, yLo: -5, yHi: 5 };
    const xs = dataset.points.map((p) => p.xy[0]);
    const ys = dataset.points.map((p) => p.xy[1]);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const mx = (xMax - xMin) * 0.15;
    const my = (yMax - yMin) * 0.15;
    return {
      xLo: xMin - mx,
      xHi: xMax + mx,
      yLo: yMin - my,
      yHi: yMax + my,
    };
  }, [dataset]);

  // 線形分類器を学習（バックボーンまたはデータが変わったとき）
  const classifier = useMemo(() => {
    if (!dataset || dataset.points.length === 0) return null;
    const points = dataset.points.map((p) => p.xy as [number, number]);
    const labels = dataset.points.map((p) => p.label);
    const numClasses = dataset.classNames.length;
    return trainLinearClassifier(points, labels, numClasses, 400);
  }, [dataset]);

  // Canvas 描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dataset) return;

    const wDev = Math.round(cssW * DPR);
    const hDev = Math.round(cssH * DPR);
    canvas.width = wDev;
    canvas.height = hDev;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { xLo, xHi, yLo, yHi } = bounds;
    const toCanvasX = (x: number) => ((x - xLo) / (xHi - xLo)) * cssW;
    const toCanvasY = (y: number) => cssH - ((y - yLo) / (yHi - yLo)) * cssH;

    // 背景
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#f9fafb";
    ctx.fillRect(0, 0, wDev, hDev);

    // 決定領域（線形分離線 ON 時のみ）
    if (showSeparator && classifier) {
      const { W, b } = classifier;
      const numClasses = dataset.classNames.length;
      const imgData = ctx.getImageData(0, 0, wDev, hDev);
      const data = imgData.data;
      const step = Math.max(2, Math.round(DPR));
      for (let py = 0; py < hDev; py += step) {
        const worldY = yHi - (py / hDev) * (yHi - yLo);
        for (let px = 0; px < wDev; px += step) {
          const worldX = xLo + (px / wDev) * (xHi - xLo);
          const scores = W.map((w, k) => w[0] * worldX + w[1] * worldY + b[k]);
          const cls = argmax(scores);
          const clsColor = hexToRgb(CLASS_COLORS[cls % CLASS_COLORS.length]);
          for (let dy = 0; dy < step && py + dy < hDev; dy++) {
            for (let dx = 0; dx < step && px + dx < wDev; dx++) {
              const o = ((py + dy) * wDev + (px + dx)) * 4;
              data[o] = clsColor[0];
              data[o + 1] = clsColor[1];
              data[o + 2] = clsColor[2];
              data[o + 3] = 38;
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // CSS px 座標系に切り替えて点を描く
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const numClasses = dataset.classNames.length;
    for (let cls = 0; cls < numClasses; cls++) {
      const color = CLASS_COLORS[cls % CLASS_COLORS.length];
      const dark = CLASS_COLORS_DARK[cls % CLASS_COLORS_DARK.length];
      for (const pt of dataset.points) {
        if (pt.label !== cls) continue;
        const cx = toCanvasX(pt.xy[0]);
        const cy = toCanvasY(pt.xy[1]);
        ctx.beginPath();
        ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }, [dataset, showSeparator, classifier, bounds, cssW, cssH]);

  const handleReset = () => {
    setBackboneIdx(0);
    setShowSeparator(false);
  };

  const selectStyle: React.CSSProperties = {
    font: "inherit",
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    background: "var(--color-bg)",
    width: "100%",
    marginTop: 4,
  };

  const isSynthetic = !dataset || dataset.synthetic !== false;

  return (
    <PlaygroundFrame
      title="特徴空間エクスプローラ"
      guide={
        <>
          バックボーンを切り替えて、クラスの点群（同色の島）の分離がどう変わるか比べよう。／
          「線形分離線を表示」をONにして、まっすぐな境界線だけで島をおおまかに仕切れることを確認しよう。
        </>
      }
      onReset={handleReset}
      controls={
        <>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>バックボーン（特徴抽出器）</span>
            <select
              style={selectStyle}
              value={backboneIdx}
              onChange={(e) => setBackboneIdx(Number(e.target.value))}
            >
              {datasets.map((d, i) => (
                <option key={i} value={i}>
                  {d.backbone}
                </option>
              ))}
            </select>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              marginBottom: 12,
              fontSize: "var(--text-sm)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showSeparator}
              onChange={(e) => setShowSeparator(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            線形分離線を表示（線形分類器の決定境界）
          </label>

          {/* 合成データ通知 */}
          {isSynthetic && (
            <div
              style={{
                padding: "8px 10px",
                background: "rgba(234,179,8,0.1)",
                border: "1px solid rgba(234,179,8,0.5)",
                borderRadius: 6,
                fontSize: "var(--text-sm)",
                color: "#92400e",
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              このデータは学習用の合成データです。実際の課題では、あなた自身の画像から生成された特徴埋め込みが表示されます。
            </div>
          )}

          {/* 凡例 */}
          {dataset && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {dataset.classNames.map((name, i) => (
                <span
                  key={i}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--text-sm)" }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: CLASS_COLORS[i % CLASS_COLORS.length],
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  {name}
                </span>
              ))}
            </div>
          )}

          {dataset && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginTop: 10 }}>
              次元削減手法: {dataset.method.toUpperCase()} | 点数: {dataset.points.length}
            </p>
          )}
        </>
      }
    >
      <div ref={wrapRef} style={{ width: "100%" }}>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: cssH,
            display: "block",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
          }}
          aria-label="事前学習済み特徴の2D散布図"
        />
      </div>
    </PlaygroundFrame>
  );
}
