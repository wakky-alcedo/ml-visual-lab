// 単一ニューロンの決定境界（M2 用・Canvas 描画）。
// w1, w2, b スライダーで 2D 平面の決定境界と分類領域をリアルタイムに可視化する。
import { useEffect, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import Slider from "../ui/Slider";

// ---- デフォルト値 ----
const DEF_W1 = 2.0;
const DEF_W2 = 2.0;
const DEF_B = -3.0;

// ---- 描画エリアのデータ座標範囲 ----
const X_MIN = -2.5;
const X_MAX = 2.5;
const Y_MIN = -2.5;
const Y_MAX = 2.5;

// ---- Canvas 高さ（幅は ResizeObserver で追跡）----
const CANVAS_H = 260;

// ---- カラーパレット（CSS 変数に合わせた RGBA 値）----
// class-0 (blue)  #2563eb → 37, 99, 235
// class-1 (orange) #ea580c → 234, 88, 12
// neutral #f6f7f9 → 246, 247, 249
const BLUE: [number, number, number] = [37, 99, 235];
const ORANGE: [number, number, number] = [234, 88, 12];
const NEUTRAL: [number, number, number] = [246, 247, 249];

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function drawBoundary(
  canvas: HTMLCanvasElement,
  w1: number,
  w2: number,
  b: number,
) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // --- 1. シグモイド出力による色分け（ImageData で高速描画）---
  const imageData = ctx.createImageData(W, H);
  const data = imageData.data;

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x1 = X_MIN + (px / (W - 1)) * (X_MAX - X_MIN);
      const x2 = Y_MAX - (py / (H - 1)) * (Y_MAX - Y_MIN); // y軸反転
      const z = w1 * x1 + w2 * x2 + b;
      const sig = sigmoid(z);

      let rgb: [number, number, number];
      if (sig >= 0.5) {
        rgb = lerp3(NEUTRAL, BLUE, (sig - 0.5) * 2 * 0.7);
      } else {
        rgb = lerp3(NEUTRAL, ORANGE, (0.5 - sig) * 2 * 0.7);
      }

      const idx = (py * W + px) * 4;
      data[idx] = rgb[0];
      data[idx + 1] = rgb[1];
      data[idx + 2] = rgb[2];
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // --- 2. グリッド線 ---
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 0.5;
  ctx.setLineDash([4, 4]);
  for (let v = Math.ceil(X_MIN); v <= Math.floor(X_MAX); v++) {
    const px = ((v - X_MIN) / (X_MAX - X_MIN)) * W;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, H);
    ctx.stroke();
    const py = ((Y_MAX - v) / (Y_MAX - Y_MIN)) * H;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(W, py);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  // --- 3. 軸（x₁=0, x₂=0 の実線）---
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1.5;
  const zeroX = ((0 - X_MIN) / (X_MAX - X_MIN)) * W;
  const zeroY = ((Y_MAX - 0) / (Y_MAX - Y_MIN)) * H;
  ctx.beginPath();
  ctx.moveTo(zeroX, 0);
  ctx.lineTo(zeroX, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, zeroY);
  ctx.lineTo(W, zeroY);
  ctx.stroke();
  ctx.restore();

  // --- 4. 決定境界線（w₁·x₁ + w₂·x₂ + b = 0）---
  if (Math.abs(w2) > 0.001 || Math.abs(w1) > 0.001) {
    ctx.save();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;

    // 線を複数区間でクリップしながら描く（端点を求める）
    // w₁·x₁ + w₂·x₂ + b = 0 の直線をピクセル空間で描画
    const points: Array<{ px: number; py: number }> = [];

    // 左端 (x₁ = X_MIN) での x₂
    if (Math.abs(w2) > 0.001) {
      const x2_left = -(w1 * X_MIN + b) / w2;
      if (x2_left >= Y_MIN && x2_left <= Y_MAX) {
        points.push({
          px: 0,
          py: ((Y_MAX - x2_left) / (Y_MAX - Y_MIN)) * H,
        });
      }
    }
    // 右端 (x₁ = X_MAX) での x₂
    if (Math.abs(w2) > 0.001) {
      const x2_right = -(w1 * X_MAX + b) / w2;
      if (x2_right >= Y_MIN && x2_right <= Y_MAX) {
        points.push({
          px: W,
          py: ((Y_MAX - x2_right) / (Y_MAX - Y_MIN)) * H,
        });
      }
    }
    // 下端 (x₂ = Y_MIN) での x₁
    if (Math.abs(w1) > 0.001) {
      const x1_bottom = -(w2 * Y_MIN + b) / w1;
      if (x1_bottom >= X_MIN && x1_bottom <= X_MAX) {
        points.push({
          px: ((x1_bottom - X_MIN) / (X_MAX - X_MIN)) * W,
          py: H,
        });
      }
    }
    // 上端 (x₂ = Y_MAX) での x₁
    if (Math.abs(w1) > 0.001) {
      const x1_top = -(w2 * Y_MAX + b) / w1;
      if (x1_top >= X_MIN && x1_top <= X_MAX) {
        points.push({
          px: ((x1_top - X_MIN) / (X_MAX - X_MIN)) * W,
          py: 0,
        });
      }
    }

    // 重複除去して 2 点取る
    const unique = points.filter(
      (p, i, arr) =>
        arr.findIndex((q) => Math.abs(q.px - p.px) < 1 && Math.abs(q.py - p.py) < 1) === i,
    );

    if (unique.length >= 2) {
      const p0 = unique[0]!;
      const p1 = unique[1]!;
      // 白いアウトライン
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(p0.px, p0.py);
      ctx.lineTo(p1.px, p1.py);
      ctx.stroke();
      // 黒い線
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p0.px, p0.py);
      ctx.lineTo(p1.px, p1.py);
      ctx.stroke();
    }

    ctx.restore();
  }

  // --- 5. 軸ラベルと目盛り値 ---
  ctx.save();
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.textAlign = "center";
  for (let v = Math.ceil(X_MIN); v <= Math.floor(X_MAX); v++) {
    if (v === 0) continue;
    const px = ((v - X_MIN) / (X_MAX - X_MIN)) * W;
    ctx.fillText(String(v), px, H - 4);
  }
  ctx.textAlign = "right";
  for (let v = Math.ceil(Y_MIN); v <= Math.floor(Y_MAX); v++) {
    if (v === 0) continue;
    const py = ((Y_MAX - v) / (Y_MAX - Y_MIN)) * H;
    ctx.fillText(String(v), 22, py + 4);
  }
  ctx.textAlign = "center";
  ctx.fillText("x₁", W - 16, zeroY - 6);
  ctx.textAlign = "left";
  ctx.fillText("x₂", zeroX + 6, 14);
  ctx.restore();

  // --- 6. 凡例 ---
  ctx.save();
  ctx.font = "11px system-ui, sans-serif";
  // 青: y=1 領域
  ctx.fillStyle = "rgba(37,99,235,0.85)";
  ctx.fillRect(W - 80, 8, 12, 12);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillText("y=1", W - 64, 19);
  // 橙: y=0 領域
  ctx.fillStyle = "rgba(234,88,12,0.85)";
  ctx.fillRect(W - 80, 26, 12, 12);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillText("y=0", W - 64, 37);
  ctx.restore();
}

export default function NeuronBoundary() {
  const [w1, setW1] = useState(DEF_W1);
  const [w2, setW2] = useState(DEF_W2);
  const [b, setB] = useState(DEF_B);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(400);

  // コンテナ幅追跡
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setWidth(entries[0]!.contentRect.width || 400);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // パラメータ変化時に Canvas を再描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = CANVAS_H;
    drawBoundary(canvas, w1, w2, b);
  }, [w1, w2, b, width]);

  const handleReset = () => {
    setW1(DEF_W1);
    setW2(DEF_W2);
    setB(DEF_B);
  };

  // 現在の決定境界の傾きと切片
  const slope =
    Math.abs(w2) > 0.001 ? -(w1 / w2).toFixed(2) : "∞（垂直）";
  const intercept =
    Math.abs(w2) > 0.001 ? -(b / w2).toFixed(2) : "—";

  return (
    <PlaygroundFrame
      title="単一ニューロンの決定境界"
      guide="w₁、w₂ を変えて境界線の傾きが回転するのを観察してください。b を動かすと線が平行移動します。重みを大きくすると、境界付近の色のグラデーションがどう変わりますか？"
      onReset={handleReset}
      controls={
        <>
          <Slider
            label="w₁"
            value={w1}
            min={-4}
            max={4}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={setW1}
          />
          <Slider
            label="w₂"
            value={w2}
            min={-4}
            max={4}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={setW2}
          />
          <Slider
            label="b（バイアス）"
            value={b}
            min={-5}
            max={5}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={setB}
          />
          <div
            style={{
              marginTop: "var(--space-3)",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
              lineHeight: 1.6,
            }}
          >
            <div>
              境界線: x₂ = {slope} · x₁ + {intercept}
            </div>
            <div>シグモイド σ(z) の濃淡で確率を表示</div>
          </div>
        </>
      }
    >
      <div ref={containerRef} style={{ width: "100%" }}>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: CANVAS_H,
            display: "block",
            borderRadius: "var(--radius-md)",
          }}
          aria-label="決定境界の可視化"
        />
      </div>
    </PlaygroundFrame>
  );
}
