// BatchNormViz（M5・SVG）
// バッチ正規化の3段階を視覚的に示す: ①入力分布 → ②正規化後（平均0・分散1）→ ③γ・β適用後
// 入力の平均シフト・標準偏差スライダーと、γ・βスライダーで分布の変化を体感できる。
import { useEffect, useMemo, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import Slider from "../ui/Slider";
import { mulberry32, DEFAULT_SEED } from "../../lib/rng";

const NUM_SAMPLES = 300;
const NUM_BINS = 22;

function useContainerWidth(ref: React.RefObject<HTMLElement | null>, initial = 640) {
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.max(300, Math.floor(e.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function makeHistogram(values: number[], lo: number, hi: number, bins: number): number[] {
  const counts = new Array(bins).fill(0) as number[];
  const bw = (hi - lo) / bins;
  for (const v of values) {
    const i = Math.floor((v - lo) / bw);
    if (i >= 0 && i < bins) counts[i]++;
  }
  return counts;
}

interface HistPanelProps {
  values: number[];
  lo: number;
  hi: number;
  bins: number;
  color: string;
  title: string;
  subtitle: string;
  w: number;
  h: number;
}

function HistPanel({ values, lo, hi, bins, color, title, subtitle, w, h }: HistPanelProps) {
  const counts = makeHistogram(values, lo, hi, bins);
  const maxCount = Math.max(...counts, 1);
  const PAD_L = 10, PAD_R = 10, PAD_T = 42, PAD_B = 38;
  const innerW = w - PAD_L - PAD_R;
  const innerH = h - PAD_T - PAD_B;
  const bw = innerW / bins;

  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length || 1);
  const std = Math.sqrt(variance);

  // 0 の位置
  const zeroX = PAD_L + ((0 - lo) / (hi - lo)) * innerW;
  const zeroInRange = zeroX >= PAD_L && zeroX <= w - PAD_R;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ overflow: "visible", display: "block" }}
    >
      {/* タイトル */}
      <text x={w / 2} y={16} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--color-text)">
        {title}
      </text>
      <text x={w / 2} y={30} textAnchor="middle" fontSize={10} fill="var(--color-text-muted)">
        {subtitle}
      </text>

      {/* グリッド */}
      {[0.25, 0.5, 0.75, 1.0].map((frac) => {
        const gx = PAD_L + frac * innerW;
        return (
          <line
            key={frac}
            x1={gx}
            y1={PAD_T}
            x2={gx}
            y2={PAD_T + innerH}
            stroke="var(--color-grid, #e5e7eb)"
            strokeWidth={0.5}
            strokeDasharray="3 3"
          />
        );
      })}

      {/* 0 の縦線 */}
      {zeroInRange && (
        <line
          x1={zeroX}
          y1={PAD_T}
          x2={zeroX}
          y2={PAD_T + innerH}
          stroke="var(--color-text-muted)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}

      {/* バー */}
      {counts.map((c, i) => {
        const barH = (c / maxCount) * innerH;
        return (
          <rect
            key={i}
            x={PAD_L + i * bw + 0.5}
            y={PAD_T + innerH - barH}
            width={Math.max(bw - 1.5, 1)}
            height={barH}
            fill={color}
            opacity={0.75}
            rx={1}
          />
        );
      })}

      {/* 軸 */}
      <line
        x1={PAD_L}
        y1={PAD_T + innerH}
        x2={w - PAD_R}
        y2={PAD_T + innerH}
        stroke="var(--color-border, #d1d5db)"
        strokeWidth={1}
      />

      {/* 軸ラベル（3点） */}
      <text x={PAD_L} y={h - 22} fontSize={9} fill="var(--color-text-muted)">
        {lo.toFixed(0)}
      </text>
      {zeroInRange && (
        <text x={zeroX} y={h - 22} textAnchor="middle" fontSize={9} fill="var(--color-text-muted)">
          0
        </text>
      )}
      <text x={w - PAD_R} y={h - 22} textAnchor="end" fontSize={9} fill="var(--color-text-muted)">
        {hi.toFixed(0)}
      </text>

      {/* 統計値 */}
      <text x={w / 2} y={h - 8} textAnchor="middle" fontSize={10} fill={color} fontWeight={600}>
        μ={mean.toFixed(2)},  σ={std.toFixed(2)}
      </text>
    </svg>
  );
}

export default function BatchNormViz() {
  const [inputMean, setInputMean] = useState(2.5);
  const [inputStd, setInputStd] = useState(2.0);
  const [gamma, setGamma] = useState(1.5);
  const [beta, setBeta] = useState(0.5);

  const wrapRef = useRef<HTMLDivElement>(null);
  const containerW = useContainerWidth(wrapRef, 640);

  // 入力サンプルを乱数で生成（シード固定＋パラメータ変化時に再生成）
  const rawSamples = useMemo(() => {
    const rng = mulberry32(DEFAULT_SEED);
    return Array.from({ length: NUM_SAMPLES }, () => rng.normal(inputMean, inputStd));
  }, [inputMean, inputStd]);

  // バッチ正規化: 平均・分散を実際に計算して正規化
  const normalizedSamples = useMemo(() => {
    const n = rawSamples.length;
    const mean = rawSamples.reduce((a, b) => a + b, 0) / n;
    const variance = rawSamples.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance + 1e-8);
    return rawSamples.map((v) => (v - mean) / std);
  }, [rawSamples]);

  // γ・β適用
  const scaledSamples = useMemo(() => {
    return normalizedSamples.map((v) => gamma * v + beta);
  }, [normalizedSamples, gamma, beta]);

  const handleReset = () => {
    setInputMean(2.5);
    setInputStd(2.0);
    setGamma(1.5);
    setBeta(0.5);
  };

  // パネル幅計算（矢印2本分と余白を引く）
  const ARROW_W = Math.max(22, Math.floor(containerW * 0.045));
  const panelW = Math.max(90, Math.floor((containerW - 2 * ARROW_W - 32) / 3));
  const panelH = 200;

  // 表示範囲: raw・scaledサンプルの分布に応じて広げる
  const displayLo = -8;
  const displayHi = 8;

  return (
    <PlaygroundFrame
      title="BatchNorm 分布正規化アニメーション"
      guide={
        <>
          「平均シフト」を動かして入力分布が偏るのを確認し、正規化後のヒストグラムが平均0に揃う様子を観察しよう。／
          γとβを動かして、いったん揃えた分布が「必要な形に戻っていく」動きを確認しよう。
        </>
      }
      onReset={handleReset}
      controls={
        <>
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, margin: "0 0 8px 0" }}>
            入力分布（センサ信号のイメージ）
          </p>
          <Slider
            label="平均シフト（μ）"
            value={inputMean}
            min={-3}
            max={3}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={setInputMean}
          />
          <Slider
            label="標準偏差（σ）"
            value={inputStd}
            min={0.5}
            max={4}
            step={0.1}
            format={(v) => v.toFixed(2)}
            onChange={setInputStd}
          />
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, margin: "12px 0 8px 0" }}>
            学習可能パラメータ
          </p>
          <Slider
            label="γ（スケール再調整）"
            value={gamma}
            min={0.1}
            max={3}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={setGamma}
          />
          <Slider
            label="β（位置再調整）"
            value={beta}
            min={-3}
            max={3}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={setBeta}
          />
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
              lineHeight: 1.6,
              marginTop: 12,
            }}
          >
            μ=平均, σ=標準偏差
            <br />
            サンプル数: {NUM_SAMPLES}
          </p>
        </>
      }
    >
      <div ref={wrapRef} style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "var(--color-surface)",
            borderRadius: 8,
            padding: "12px 8px",
            overflowX: "auto",
          }}
        >
          {/* ①入力分布 */}
          <HistPanel
            values={rawSamples}
            lo={displayLo}
            hi={displayHi}
            bins={NUM_BINS}
            color="#2563eb"
            title="① 入力 x"
            subtitle="ずれた・ばらついた分布"
            w={panelW}
            h={panelH}
          />

          {/* 矢印: 正規化 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: ARROW_W,
              gap: 2,
            }}
          >
            <svg width={ARROW_W} height={36} viewBox={`0 0 ${ARROW_W} 36`}>
              <line
                x1={2}
                y1={18}
                x2={ARROW_W - 8}
                y2={18}
                stroke="var(--color-text-muted)"
                strokeWidth={2}
              />
              <polygon
                points={`${ARROW_W - 8},13 ${ARROW_W - 8},23 ${ARROW_W - 1},18`}
                fill="var(--color-text-muted)"
              />
            </svg>
            <span
              style={{
                fontSize: 9,
                color: "var(--color-text-muted)",
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              正規化
            </span>
          </div>

          {/* ②正規化後 */}
          <HistPanel
            values={normalizedSamples}
            lo={displayLo}
            hi={displayHi}
            bins={NUM_BINS}
            color="#16a34a"
            title="② 正規化後 x̂"
            subtitle="平均0・分散1に揃う"
            w={panelW}
            h={panelH}
          />

          {/* 矢印: γx̂+β */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: ARROW_W,
              gap: 2,
            }}
          >
            <svg width={ARROW_W} height={36} viewBox={`0 0 ${ARROW_W} 36`}>
              <line
                x1={2}
                y1={18}
                x2={ARROW_W - 8}
                y2={18}
                stroke="var(--color-text-muted)"
                strokeWidth={2}
              />
              <polygon
                points={`${ARROW_W - 8},13 ${ARROW_W - 8},23 ${ARROW_W - 1},18`}
                fill="var(--color-text-muted)"
              />
            </svg>
            <span
              style={{
                fontSize: 9,
                color: "var(--color-text-muted)",
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              γx̂+β
            </span>
          </div>

          {/* ③γ・β適用後 */}
          <HistPanel
            values={scaledSamples}
            lo={displayLo}
            hi={displayHi}
            bins={NUM_BINS}
            color="#ea580c"
            title="③ γ・β適用後 y"
            subtitle="学習で必要な分布に戻す"
            w={panelW}
            h={panelH}
          />
        </div>

        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginTop: 8 }}>
          <span style={{ color: "#2563eb", fontWeight: 600 }}>①</span> 入力が偏っていても、
          <span style={{ color: "#16a34a", fontWeight: 600 }}> ②</span> 正規化で平均0・分散1に揃え、
          <span style={{ color: "#ea580c", fontWeight: 600 }}> ③</span>{" "}
          γ・βで必要な分布形に戻す——BatchNorm の二段構えです。
        </p>
      </div>
    </PlaygroundFrame>
  );
}
