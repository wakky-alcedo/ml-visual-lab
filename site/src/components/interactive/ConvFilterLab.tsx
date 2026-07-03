// 畳み込みフィルタ実験室（M3 用・Canvas 描画）。
// 3×3 カーネルをリアルタイム編集してサンプル画像に即時適用する。
// imageSrc 未指定時はプロシージャル画像（勾配＋図形の合成）を使用。
import { useEffect, useMemo, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import { conv2d, clamp2d, normalizeAbs } from "../../lib/conv";
import type { ConvFilterLabProps } from "../../lib/types";

// ---- 画像サイズ ----
const IMG_SIZE = 128;
const CANVAS_H = 240;

// ---- プリセットカーネル ----
const PRESETS: Record<string, number[][]> = {
  恒等: [
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0],
  ],
  縦エッジ: [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ],
  横エッジ: [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ],
  ラプラシアン: [
    [0, -1, 0],
    [-1, 4, -1],
    [0, -1, 0],
  ],
  ぼかし: [
    [1 / 9, 1 / 9, 1 / 9],
    [1 / 9, 1 / 9, 1 / 9],
    [1 / 9, 1 / 9, 1 / 9],
  ],
  シャープ: [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
  ],
};

const DEF_PRESET = "恒等";

// ---- プロシージャル画像生成 ----
// 勾配背景＋円＋四角形＋縦横ストライプで多様な空間周波数を表現
function generateProceduralImage(size: number): number[][] {
  const img: number[][] = Array.from({ length: size }, () =>
    new Array<number>(size).fill(0),
  );

  // 1. 斜め勾配背景（40〜190）
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      img[y]![x] = Math.round(40 + ((x + y) / (2 * (size - 1))) * 150);
    }
  }

  // 2. 明るい円（右上、半径 size*0.18）
  const cx1 = size * 0.72;
  const cy1 = size * 0.25;
  const r1 = size * 0.18;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x - cx1) ** 2 + (y - cy1) ** 2 < r1 ** 2) {
        img[y]![x] = 210;
      }
    }
  }

  // 3. 暗い四角（左下）
  const rx = Math.round(size * 0.1);
  const ry = Math.round(size * 0.62);
  const rw = Math.round(size * 0.32);
  const rh = Math.round(size * 0.25);
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      if (y < size && x < size) img[y]![x] = 28;
    }
  }

  // 4. 水平ストライプ（上半分の帯状）
  for (let y = Math.round(size * 0.43); y < Math.round(size * 0.5); y++) {
    for (let x = 0; x < size; x++) {
      img[y]![x] = 200;
    }
  }
  for (let y = Math.round(size * 0.5); y < Math.round(size * 0.57); y++) {
    for (let x = 0; x < size; x++) {
      img[y]![x] = 50;
    }
  }

  // 5. 垂直ストライプ（右半分の帯状）
  for (let y = 0; y < size; y++) {
    for (let x = Math.round(size * 0.44); x < Math.round(size * 0.5); x++) {
      img[y]![x] = 210;
    }
    for (let x = Math.round(size * 0.5); x < Math.round(size * 0.56); x++) {
      img[y]![x] = 40;
    }
  }

  return img;
}

// ---- Canvas へグレースケール画像を描画（スケール付き）----
function drawGrayscaleToCanvas(
  ctx: CanvasRenderingContext2D,
  img: number[][],
  destX: number,
  destY: number,
  destW: number,
  destH: number,
): void {
  const H = img.length;
  const W = img[0]?.length ?? 0;
  if (H === 0 || W === 0 || destW <= 0 || destH <= 0) return;

  // 一時 canvas に ImageData を書き込み、拡大描画する
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = W;
  tempCanvas.height = H;
  const tmpCtx = tempCanvas.getContext("2d");
  if (!tmpCtx) return;

  const imageData = tmpCtx.createImageData(W, H);
  const data = imageData.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = Math.max(0, Math.min(255, Math.round(img[y]![x] ?? 0)));
      const idx = (y * W + x) * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  tmpCtx.putImageData(imageData, 0, 0);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tempCanvas, destX, destY, destW, destH);
  ctx.restore();
}

export default function ConvFilterLab({ imageSrc }: ConvFilterLabProps) {
  const [kernel, setKernel] = useState<number[][]>(PRESETS[DEF_PRESET]!);
  const [preset, setPreset] = useState(DEF_PRESET);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(480);

  // コンテナ幅追跡
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setWidth(entries[0]!.contentRect.width || 480);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // プロシージャル画像（一度だけ生成）
  const proceduralImage = useMemo(
    () => generateProceduralImage(IMG_SIZE),
    [],
  );

  // imageSrc が指定された場合のロード
  const [loadedImage, setLoadedImage] = useState<number[][] | null>(null);
  useEffect(() => {
    if (!imageSrc) {
      setLoadedImage(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = IMG_SIZE;
      tempCanvas.height = IMG_SIZE;
      const tmpCtx = tempCanvas.getContext("2d");
      if (!tmpCtx) return;
      tmpCtx.drawImage(img, 0, 0, IMG_SIZE, IMG_SIZE);
      const imageData = tmpCtx.getImageData(0, 0, IMG_SIZE, IMG_SIZE);
      const grayImg: number[][] = Array.from({ length: IMG_SIZE }, (_, y) =>
        Array.from({ length: IMG_SIZE }, (_, x) => {
          const i = (y * IMG_SIZE + x) * 4;
          const r = imageData.data[i] ?? 0;
          const g = imageData.data[i + 1] ?? 0;
          const b = imageData.data[i + 2] ?? 0;
          return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }),
      );
      setLoadedImage(grayImg);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const sourceImage = loadedImage ?? proceduralImage;

  // カーネル変更のたびに畳み込みを実行
  const filteredImage = useMemo(() => {
    const raw = conv2d(sourceImage, kernel, "same");
    const kernelSum = kernel.flat().reduce((s, v) => s + v, 0);
    // カーネル和が 0 に近いエッジ検出系は絶対値正規化、それ以外はクランプ
    return Math.abs(kernelSum) < 0.05 ? normalizeAbs(raw) : clamp2d(raw);
  }, [sourceImage, kernel]);

  // Canvas 描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, CANVAS_H);
    ctx.fillStyle = "#f6f7f9";
    ctx.fillRect(0, 0, width, CANVAS_H);

    const labelH = 22;
    const pad = 12;
    const halfW = Math.floor(width / 2);
    const imgSize = Math.min(halfW - pad * 2, CANVAS_H - labelH - pad);

    // --- 元画像（左半分）---
    const origX = pad;
    const origY = labelH + Math.round((CANVAS_H - labelH - imgSize) / 2);
    drawGrayscaleToCanvas(ctx, sourceImage, origX, origY, imgSize, imgSize);
    ctx.strokeStyle = "#d9dde2";
    ctx.lineWidth = 1;
    ctx.strokeRect(origX, origY, imgSize, imgSize);

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#5b636d";
    ctx.textAlign = "center";
    ctx.fillText("元画像", origX + imgSize / 2, 15);

    // --- フィルタ後（右半分）---
    const filtX = halfW + pad;
    const filtY = origY;
    drawGrayscaleToCanvas(ctx, filteredImage, filtX, filtY, imgSize, imgSize);
    ctx.strokeStyle = "#d9dde2";
    ctx.lineWidth = 1;
    ctx.strokeRect(filtX, filtY, imgSize, imgSize);

    ctx.fillStyle = "#5b636d";
    ctx.textAlign = "center";
    ctx.fillText("フィルタ後", filtX + imgSize / 2, 15);

    // --- 中央区切り線 ---
    ctx.strokeStyle = "#d9dde2";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(halfW, 0);
    ctx.lineTo(halfW, CANVAS_H);
    ctx.stroke();

    // --- 正規化方法の表示 ---
    const kernelSum = kernel.flat().reduce((s, v) => s + v, 0);
    const normLabel =
      Math.abs(kernelSum) < 0.05 ? "絶対値正規化" : "値をクランプ [0,255]";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#5b636d";
    ctx.textAlign = "center";
    ctx.fillText(normLabel, filtX + imgSize / 2, CANVAS_H - 4);
  }, [sourceImage, filteredImage, kernel, width]);

  const handleReset = () => {
    setKernel(PRESETS[DEF_PRESET]!);
    setPreset(DEF_PRESET);
  };

  const handlePreset = (name: string) => {
    const k = PRESETS[name];
    if (!k) return;
    setKernel(k);
    setPreset(name);
  };

  const handleKernelChange = (ki: number, kj: number, val: number) => {
    if (isNaN(val)) return;
    const newK = kernel.map((row, ri) =>
      row.map((v, ci) => (ri === ki && ci === kj ? val : v)),
    );
    setKernel(newK);
    setPreset("カスタム");
  };

  return (
    <PlaygroundFrame
      title="畳み込みフィルタ実験室"
      guide="まずエッジ検出（縦エッジ・横エッジ・ラプラシアン）プリセットを試して輪郭が白く浮き上がる様子を見てください。次にカーネル中心を 5 に、周囲を −1 にすると「シャープ」の効果が自分で作れます。"
      onReset={handleReset}
      controls={
        <>
          {/* プリセット選択 */}
          <div
            style={{
              marginBottom: "var(--space-3)",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
            }}
          >
            プリセット
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
              marginBottom: "var(--space-3)",
            }}
          >
            {Object.keys(PRESETS).map((name) => (
              <button
                key={name}
                type="button"
                className={`btn${preset === name ? " btn-accent" : ""}`}
                style={{ padding: "3px 8px", fontSize: "0.78rem" }}
                onClick={() => handlePreset(name)}
              >
                {name}
              </button>
            ))}
          </div>

          {/* 3×3 カーネルエディタ */}
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
              marginBottom: "6px",
            }}
          >
            カーネル値を直接編集
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 64px)",
              gap: "4px",
            }}
          >
            {kernel.map((row, ki) =>
              row.map((val, kj) => (
                <input
                  key={`${ki}-${kj}`}
                  type="number"
                  step="0.01"
                  value={
                    Number.isInteger(val) ? val : parseFloat(val.toFixed(3))
                  }
                  onChange={(e) =>
                    handleKernelChange(ki, kj, e.target.valueAsNumber)
                  }
                  style={{
                    width: "64px",
                    padding: "4px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    textAlign: "center",
                    fontSize: "0.82rem",
                    fontFamily: "var(--font-mono)",
                    background: "var(--color-bg)",
                    color: "var(--color-text)",
                  }}
                />
              )),
            )}
          </div>

          {/* カーネル和の表示 */}
          <div
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
            }}
          >
            カーネル和:{" "}
            {kernel
              .flat()
              .reduce((s, v) => s + v, 0)
              .toFixed(3)}
            {!imageSrc && (
              <div style={{ marginTop: 4 }}>
                ※ プロシージャル生成画像を使用
              </div>
            )}
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
          aria-label="畳み込みフィルタ適用結果"
        />
      </div>
    </PlaygroundFrame>
  );
}
