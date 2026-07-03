// LossLandscape（M4・Canvas）
// 2変数の損失地形を等高線ヒートマップで描き、その上をボール（最適化アルゴリズム）が
// 降下する軌跡をアニメーションする。地形・学習率η・momentum係数・オプティマイザを
// 切り替えられ、開始点はクリックで指定できる。学習率を大きくすると発散する様子も見える。
import { useEffect, useMemo, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import Slider from "../ui/Slider";
import {
  LANDSCAPES,
  getLandscape,
  computeTrajectory,
  type LandscapeKind,
  type Optimizer,
  type TrajectoryResult,
} from "../../lib/optim-landscape";

const STEPS = 220;
const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

const OPT_COLORS: Record<Optimizer, string> = {
  sgd: "#dc2626",
  momentum: "#16a34a",
  adam: "#ea580c",
};
const OPT_LABELS: Record<Optimizer, string> = {
  sgd: "SGD",
  momentum: "Momentum",
  adam: "Adam",
};

/** コンテナ幅を ResizeObserver で追う小フック。 */
function useContainerWidth(ref: React.RefObject<HTMLElement | null>, initial = 600) {
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

/** 地形のヒートマップ（等高線バンド）を device 解像度の ImageData として作る。 */
function buildHeatmap(kind: LandscapeKind, wDev: number, hDev: number): ImageData {
  const l = getLandscape(kind);
  const { xMin, xMax, yMin, yMax } = l.domain;
  const img = new ImageData(wDev, hDev);
  const data = img.data;

  // 損失の分布を掴むため粗くサンプリングして min/max を求める。
  let lo = Infinity;
  let hi = -Infinity;
  const S = 40;
  for (let j = 0; j <= S; j++) {
    const y = yMin + (j / S) * (yMax - yMin);
    for (let i = 0; i <= S; i++) {
      const x = xMin + (i / S) * (xMax - xMin);
      const v = l.loss(x, y);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const range = hi - lo || 1;
  const bands = 14;

  const step = Math.max(1, Math.floor(DPR)); // 計算コスト軽減のため数px単位で塗る
  for (let py = 0; py < hDev; py += step) {
    const y = yMax - (py / hDev) * (yMax - yMin); // 上が yMax
    for (let px = 0; px < wDev; px += step) {
      const x = xMin + (px / wDev) * (xMax - xMin);
      let t = (l.loss(x, y) - lo) / range;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      // 圧縮して谷付近の変化を見やすく。
      const tc = Math.sqrt(t);
      // 低損失=淡色、高損失=濃い青。
      let r = Math.round(240 - tc * 203);
      let g = Math.round(248 - tc * 149);
      let b = Math.round(255 - tc * 20);
      // 等高線バンドの境目を少し暗くして輪郭を出す。
      const frac = tc * bands - Math.floor(tc * bands);
      if (frac < 0.07) {
        r = Math.round(r * 0.72);
        g = Math.round(g * 0.72);
        b = Math.round(b * 0.78);
      }
      for (let dy = 0; dy < step && py + dy < hDev; dy++) {
        for (let dx = 0; dx < step && px + dx < wDev; dx++) {
          const o = ((py + dy) * wDev + (px + dx)) * 4;
          data[o] = r;
          data[o + 1] = g;
          data[o + 2] = b;
          data[o + 3] = 255;
        }
      }
    }
  }
  return img;
}

export default function LossLandscape() {
  const [kind, setKind] = useState<LandscapeKind>("valley");
  const [optimizer, setOptimizer] = useState<Optimizer>("sgd");
  const [overlay, setOverlay] = useState(false);
  const [lr, setLr] = useState(getLandscape("valley").defaultLearningRate);
  const [momentum, setMomentum] = useState(0.9);
  const [start, setStart] = useState<[number, number]>(getLandscape("valley").start);
  const [running, setRunning] = useState(true);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cssW = useContainerWidth(wrapRef, 620);
  const cssH = Math.round(Math.min(440, Math.max(300, cssW * 0.68)));

  const landscape = getLandscape(kind);

  // 地形を変えたら学習率と開始点を意味のある既定に戻す。
  useEffect(() => {
    setLr(getLandscape(kind).defaultLearningRate);
    setStart(getLandscape(kind).start);
    setRunning(true);
  }, [kind]);

  // 軌跡（オーバーレイ時は3本、単体時は1本）を計算。
  const trajectories = useMemo(() => {
    const opts = overlay
      ? (["sgd", "momentum", "adam"] as Optimizer[])
      : [optimizer];
    return opts.map((opt) => ({
      opt,
      result: computeTrajectory(landscape, {
        optimizer: opt,
        learningRate: lr,
        momentum,
        steps: STEPS,
        start,
      }) as TrajectoryResult,
    }));
  }, [landscape, overlay, optimizer, lr, momentum, start]);

  const maxLen = useMemo(
    () => trajectories.reduce((m, t) => Math.max(m, t.result.points.length), 1),
    [trajectories],
  );
  const anyDiverged = trajectories.some((t) => t.result.diverged);

  // ヒートマップキャッシュ（地形とサイズが変わったら作り直す）。
  const heatmapRef = useRef<ImageData | null>(null);
  const heatKeyRef = useRef("");

  // 描画ループで参照する可変状態。
  const trajRef = useRef(trajectories);
  const runningRef = useRef(running);
  const headRef = useRef(0);
  trajRef.current = trajectories;
  runningRef.current = running;

  // パラメータが変わったらアニメを頭から。
  useEffect(() => {
    headRef.current = 0;
  }, [trajectories]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wDev = Math.round(cssW * DPR);
    const hDev = Math.round(cssH * DPR);
    canvas.width = wDev;
    canvas.height = hDev;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { xMin, xMax, yMin, yMax } = landscape.domain;
    const toPx = (x: number) => ((x - xMin) / (xMax - xMin)) * cssW;
    const toPy = (y: number) => cssH - ((y - yMin) / (yMax - yMin)) * cssH;

    let raf = 0;
    const draw = () => {
      // ヒートマップ（device px, 変形なしで putImageData）。
      const key = `${kind}:${wDev}x${hDev}`;
      if (heatKeyRef.current !== key || !heatmapRef.current) {
        heatmapRef.current = buildHeatmap(kind, wDev, hDev);
        heatKeyRef.current = key;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(heatmapRef.current, 0, 0);

      // 以降は CSS px 座標で描く。
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      // 最小点マーカー。
      if (landscape.minimum) {
        const mx = toPx(landscape.minimum[0]);
        const my = toPy(landscape.minimum[1]);
        ctx.strokeStyle = "rgba(20,30,50,0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mx - 6, my - 6);
        ctx.lineTo(mx + 6, my + 6);
        ctx.moveTo(mx + 6, my - 6);
        ctx.lineTo(mx - 6, my + 6);
        ctx.stroke();
      }

      const head = headRef.current;
      const headIdx = Math.min(Math.floor(head), maxLen - 1);

      for (const { opt, result } of trajRef.current) {
        const pts = result.points;
        const color = OPT_COLORS[opt];
        const upto = Math.min(headIdx, pts.length - 1);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= upto; i++) {
          const px = toPx(pts[i].x);
          const py = toPy(pts[i].y);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // ボール（現在位置）。範囲外でもクランプして端に表示。
        const cur = pts[upto];
        const bx = Math.max(-8, Math.min(cssW + 8, toPx(cur.x)));
        const by = Math.max(-8, Math.min(cssH + 8, toPy(cur.y)));
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
      }

      // アニメを進める。
      if (runningRef.current && headRef.current < maxLen - 1) {
        headRef.current = Math.min(maxLen - 1, headRef.current + 1.4);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [kind, landscape, cssW, cssH, maxLen]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * cssW;
    const py = ((e.clientY - rect.top) / rect.height) * cssH;
    const { xMin, xMax, yMin, yMax } = landscape.domain;
    const x = xMin + (px / cssW) * (xMax - xMin);
    const y = yMin + ((cssH - py) / cssH) * (yMax - yMin);
    setStart([x, y]);
    setRunning(true);
  };

  const handleReset = () => {
    setKind("valley");
    setOptimizer("sgd");
    setOverlay(false);
    setLr(getLandscape("valley").defaultLearningRate);
    setMomentum(0.9);
    setStart(getLandscape("valley").start);
    setRunning(true);
  };

  const selectStyle: React.CSSProperties = {
    font: "inherit",
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    background: "var(--color-bg)",
    width: "100%",
  };

  return (
    <PlaygroundFrame
      title="損失地形ビジュアライザ"
      guide={
        <>
          学習率ηを10倍にして、ボールが谷を飛び越えて発散する様子を見てみよう。／
          「細長い谷」でSGDとAdamを重ね表示し、どちらが速く谷底へ届くか比べてみよう。
        </>
      }
      onReset={handleReset}
      controls={
        <>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>地形</span>
            <select
              style={selectStyle}
              value={kind}
              onChange={(e) => setKind(e.target.value as LandscapeKind)}
            >
              {LANDSCAPES.map((l) => (
                <option key={l.kind} value={l.kind}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              fontSize: "var(--text-sm)",
            }}
          >
            <input
              type="checkbox"
              checked={overlay}
              onChange={(e) => setOverlay(e.target.checked)}
            />
            3手法を重ねて表示
          </label>

          {!overlay && (
            <label style={{ display: "block", marginBottom: 12 }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                オプティマイザ
              </span>
              <select
                style={selectStyle}
                value={optimizer}
                onChange={(e) => setOptimizer(e.target.value as Optimizer)}
              >
                <option value="sgd">SGD（素朴な勾配降下）</option>
                <option value="momentum">Momentum</option>
                <option value="adam">Adam</option>
              </select>
            </label>
          )}

          <Slider
            label="学習率 η（一歩の幅）"
            value={lr}
            min={0.001}
            max={1}
            step={0.001}
            format={(v) => v.toFixed(3)}
            onChange={setLr}
          />
          <Slider
            label="Momentum係数"
            value={momentum}
            min={0.5}
            max={0.99}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={setMomentum}
            disabled={!overlay && optimizer === "sgd"}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (headRef.current >= maxLen - 1) headRef.current = 0;
                setRunning((r) => !r);
              }}
            >
              {running ? "⏸ 一時停止" : "▶ 再生"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                headRef.current = 0;
                setRunning(true);
              }}
            >
              ↻ 最初から
            </button>
          </div>

          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginTop: 12 }}>
            {landscape.description}
            <br />
            図をクリックすると開始点を変えられます。
          </p>
        </>
      }
    >
      <div ref={wrapRef} style={{ width: "100%" }}>
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          style={{
            width: "100%",
            height: cssH,
            display: "block",
            borderRadius: 8,
            cursor: "crosshair",
            border: "1px solid var(--color-border)",
          }}
          aria-label={`${landscape.name}の損失地形と降下軌跡`}
        />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 8,
            fontSize: "var(--text-sm)",
          }}
        >
          {(overlay ? (["sgd", "momentum", "adam"] as Optimizer[]) : [optimizer]).map(
            (opt) => (
              <span key={opt} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 14,
                    height: 4,
                    background: OPT_COLORS[opt],
                    borderRadius: 2,
                    display: "inline-block",
                  }}
                />
                {OPT_LABELS[opt]}
              </span>
            ),
          )}
          {anyDiverged && (
            <span style={{ color: "var(--color-incorrect)", fontWeight: 700 }}>
              ⚠ 発散しました（ηが大きすぎます）
            </span>
          )}
          <span style={{ color: "var(--color-text-muted)" }}>✕ = 最小点</span>
        </div>
      </div>
    </PlaygroundFrame>
  );
}
