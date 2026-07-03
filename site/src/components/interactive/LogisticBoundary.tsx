// LogisticBoundary（M7・Canvas）
// 2Dトイデータ上でL2正則化λ・判定しきい値のスライダー → ロジスティック回帰の
// 決定境界と確率の色勾配をCanvas上に描画する。
// スライダーを動かすたびに勾配降下で再学習し、即座に境界が変化する。
import { useEffect, useMemo, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import Slider from "../ui/Slider";
import { makeDataset, makeGauss } from "../../lib/datasets";
import type { Dataset2DKind } from "../../lib/types";

const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

function useContainerWidth(ref: React.RefObject<HTMLElement | null>, initial = 620) {
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

// ──────────────────────────────────────────────
// ロジスティック回帰（L2正則化つき、手書き勾配降下）
// ──────────────────────────────────────────────
function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

interface LogRegResult {
  w: [number, number];
  b: number;
}

function trainLogReg(
  points: [number, number][],
  labels: number[], // 0 or 1
  lambda: number,
  epochs = 600,
  lr = 0.5,
): LogRegResult {
  let w: [number, number] = [0, 0];
  let b = 0;
  const n = points.length;

  for (let ep = 0; ep < epochs; ep++) {
    let dw0 = 0, dw1 = 0, db = 0;
    for (let i = 0; i < n; i++) {
      const [x0, x1] = points[i];
      const z = w[0] * x0 + w[1] * x1 + b;
      const p = sigmoid(z);
      const err = p - labels[i];
      dw0 += err * x0 / n;
      dw1 += err * x1 / n;
      db += err / n;
    }
    // L2 正則化勾配を加える
    w[0] -= lr * (dw0 + lambda * w[0]);
    w[1] -= lr * (dw1 + lambda * w[1]);
    b -= lr * db;
  }
  return { w, b };
}

function predict(model: LogRegResult, x0: number, x1: number): number {
  return sigmoid(model.w[0] * x0 + model.w[1] * x1 + model.b);
}

// ──────────────────────────────────────────────
// 色マッピング（0→暖色系, 1→寒色系）
// ──────────────────────────────────────────────
function probToRGB(p: number): [number, number, number] {
  // p=0 → オレンジ, p=0.5 → 白, p=1 → 青
  if (p < 0.5) {
    const t = p / 0.5; // 0→1
    return [
      Math.round(255 - t * (255 - 219)),
      Math.round(80 + t * (234 - 80)),
      Math.round(30 + t * (238 - 30)),
    ];
  } else {
    const t = (p - 0.5) / 0.5; // 0→1
    return [
      Math.round(219 - t * (219 - 37)),
      Math.round(234 - t * (234 - 99)),
      Math.round(238 - t * (238 - 235)),
    ];
  }
}

// ──────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────
const DATASET_LABELS: Record<Dataset2DKind, string> = {
  gauss: "ガウス（線形分離可）",
  circle: "同心円（非線形）",
  xor: "XOR（非線形）",
  spiral: "渦巻き（非線形）",
};

export default function LogisticBoundary() {
  const [kind, setKind] = useState<Dataset2DKind>("gauss");
  const [lambda, setLambda] = useState(0.01);
  const [threshold, setThreshold] = useState(0.5);
  const [showPoints, setShowPoints] = useState(true);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cssW = useContainerWidth(wrapRef, 620);
  const cssH = Math.round(Math.min(460, Math.max(300, cssW * 0.72)));

  // データセット（種類が変わるときだけ再生成）
  const dataset = useMemo(() => makeDataset(kind, { n: 200, seed: 42 }), [kind]);

  // ロジスティック回帰学習（パラメータが変わるたびに再学習）
  const model = useMemo(() => {
    return trainLogReg(dataset.points, dataset.labels, lambda, 600, 0.5);
  }, [dataset, lambda]);

  // Canvas描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const wDev = Math.round(cssW * DPR);
    const hDev = Math.round(cssH * DPR);
    canvas.width = wDev;
    canvas.height = hDev;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // データ座標 → Canvas CSS px
    const MARGIN = 0.18;
    const xLo = -1 - MARGIN, xHi = 1 + MARGIN;
    const yLo = -1 - MARGIN, yHi = 1 + MARGIN;
    const toCanvasX = (x: number) => ((x - xLo) / (xHi - xLo)) * cssW;
    const toCanvasY = (y: number) => cssH - ((y - yLo) / (yHi - yLo)) * cssH;

    // ── 背景: 確率の色勾配 ──
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const imgData = ctx.createImageData(wDev, hDev);
    const data = imgData.data;
    const step = Math.max(2, Math.round(DPR));
    for (let py = 0; py < hDev; py += step) {
      const worldY = yHi - (py / hDev) * (yHi - yLo);
      for (let px = 0; px < wDev; px += step) {
        const worldX = xLo + (px / wDev) * (xHi - xLo);
        const p = predict(model, worldX, worldY);
        const [r, g, b] = probToRGB(p);
        for (let dy = 0; dy < step && py + dy < hDev; dy++) {
          for (let dx = 0; dx < step && px + dx < wDev; dx++) {
            const o = ((py + dy) * wDev + (px + dx)) * 4;
            data[o] = r;
            data[o + 1] = g;
            data[o + 2] = b;
            data[o + 3] = 200;
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // ── CSS px 座標系に切り替え ──
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // ── 決定境界（threshold のライン）──
    // p(x, y) = threshold のラインを描く
    // w[0]*x + w[1]*y + b = log(t/(1-t))
    const logitThreshold = Math.log(threshold / (1 - threshold));
    const { w, b } = model;

    if (Math.abs(w[1]) > 1e-6) {
      // y = (logitThreshold - w[0]*x - b) / w[1]
      const xA = xLo;
      const yA = (logitThreshold - w[0] * xA - b) / w[1];
      const xB = xHi;
      const yB = (logitThreshold - w[0] * xB - b) / w[1];
      const pxA = toCanvasX(xA);
      const pyA = toCanvasY(yA);
      const pxB = toCanvasX(xB);
      const pyB = toCanvasY(yB);

      ctx.beginPath();
      ctx.moveTo(pxA, pyA);
      ctx.lineTo(pxB, pyB);
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.stroke();

      // しきい値が0.5でない場合は0.5の線も破線で
      if (Math.abs(threshold - 0.5) > 0.01) {
        const yA2 = (-w[0] * xA - b) / w[1];
        const yB2 = (-w[0] * xB - b) / w[1];
        ctx.beginPath();
        ctx.moveTo(toCanvasX(xA), toCanvasY(yA2));
        ctx.lineTo(toCanvasX(xB), toCanvasY(yB2));
        ctx.strokeStyle = "#6b7280";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (Math.abs(w[0]) > 1e-6) {
      // 垂直線: w[0]*x + b = logitThreshold → x = (logitThreshold - b)/w[0]
      const xLine = (logitThreshold - b) / w[0];
      if (xLine >= xLo && xLine <= xHi) {
        const px = toCanvasX(xLine);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, cssH);
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }

    // ── グリッド ──
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([]);
    for (const v of [-0.5, 0, 0.5]) {
      const gx = toCanvasX(v);
      const gy = toCanvasY(v);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, cssH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(cssW, gy);
      ctx.stroke();
    }

    // ── データ点 ──
    if (showPoints) {
      for (let i = 0; i < dataset.points.length; i++) {
        const [px, py] = dataset.points[i];
        const label = dataset.labels[i];
        const cx = toCanvasX(px);
        const cy = toCanvasY(py);
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = label === 0 ? "#ea580c" : "#2563eb";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // ── ラベル注記 ──
    ctx.setLineDash([]);
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = "#111827";
    ctx.fillText("しきい値線", 8, 16);
    if (Math.abs(threshold - 0.5) > 0.01) {
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText("破線: 確率0.5の境界", 8, 32);
    }
  }, [dataset, model, threshold, showPoints, cssW, cssH]);

  const handleReset = () => {
    setKind("gauss");
    setLambda(0.01);
    setThreshold(0.5);
    setShowPoints(true);
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

  return (
    <PlaygroundFrame
      title="ロジスティック回帰の決定境界"
      guide={
        <>
          λを最小にして境界がデータに食いつく様子を見たあと、λを少しずつ大きくして境界がなめらか（直線に近く）になることを確認しよう。／
          しきい値スライダーを動かして、確率の色勾配の中を境界線が移動する様子を観察しよう。
        </>
      }
      onReset={handleReset}
      controls={
        <>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>データセット</span>
            <select
              style={selectStyle}
              value={kind}
              onChange={(e) => setKind(e.target.value as Dataset2DKind)}
            >
              {(["gauss", "circle", "xor", "spiral"] as Dataset2DKind[]).map((k) => (
                <option key={k} value={k}>
                  {DATASET_LABELS[k]}
                </option>
              ))}
            </select>
          </label>

          <Slider
            label="λ（L2正則化強度）"
            value={lambda}
            min={0.0}
            max={10}
            step={0.01}
            format={(v) => (v === 0 ? "0（正則化なし）" : v.toFixed(2))}
            onChange={setLambda}
          />

          <Slider
            label="判定しきい値"
            value={threshold}
            min={0.1}
            max={0.9}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={setThreshold}
          />

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              margin: "12px 0 0",
              fontSize: "var(--text-sm)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showPoints}
              onChange={(e) => setShowPoints(e.target.checked)}
            />
            データ点を表示
          </label>

          <div style={{ marginTop: 12, fontSize: "var(--text-sm)", lineHeight: 1.8 }}>
            <span
              style={{ display: "inline-block", width: 12, height: 12, background: "#ea580c", borderRadius: "50%", marginRight: 4 }}
            />
            クラス0
            <span
              style={{ display: "inline-block", width: 12, height: 12, background: "#2563eb", borderRadius: "50%", marginRight: 4, marginLeft: 12 }}
            />
            クラス1
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginTop: 6, lineHeight: 1.5 }}>
            実線: しきい値の決定境界
            <br />
            破線: 確率0.5の境界（しきい値が0.5以外のとき）
            <br />
            色勾配: 暖色(オレンジ)=クラス0寄り、寒色(青)=クラス1寄り
          </p>
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
          aria-label="ロジスティック回帰の決定境界と確率の色勾配"
        />
      </div>
    </PlaygroundFrame>
  );
}
