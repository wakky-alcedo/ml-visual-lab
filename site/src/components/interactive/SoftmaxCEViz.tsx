// softmax と交差エントロピー可視化（M3 用・SVG 描画）。
// ロジット 3 本のスライダーと正解クラス選択で
// softmax 確率の棒グラフと CE 損失値をリアルタイム表示する。
import { useEffect, useMemo, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import Slider from "../ui/Slider";

// ---- デフォルト値 ----
const DEF_Z: [number, number, number] = [2.0, 0.5, -1.0];
const DEF_CORRECT = 0;

// ---- クラス定義 ----
const CLASS_NAMES: [string, string, string] = ["クラス 1", "クラス 2", "クラス 3"];
const CLASS_COLORS: [string, string, string] = [
  "var(--color-class-0)",   // blue
  "var(--color-class-1)",   // orange
  "var(--color-correct)",   // green
];

function softmax(logits: [number, number, number]): [number, number, number] {
  const max = Math.max(...logits);
  const exps = logits.map((z) => Math.exp(z - max)) as [number, number, number];
  const sum = exps[0] + exps[1] + exps[2];
  return [exps[0] / sum, exps[1] / sum, exps[2] / sum];
}

// ---- SVG レイアウト定数 ----
const CHART_H = 200;
const PAD_T = 24;
const PAD_B = 56;
const PAD_L = 20;
const PAD_R = 20;
const LOSS_BOX_H = 64;
const TOTAL_H = CHART_H + LOSS_BOX_H + 12;

export default function SoftmaxCEViz() {
  const [z1, setZ1] = useState(DEF_Z[0]);
  const [z2, setZ2] = useState(DEF_Z[1]);
  const [z3, setZ3] = useState(DEF_Z[2]);
  const [correctClass, setCorrectClass] = useState(DEF_CORRECT);

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(440);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setWidth(entries[0]!.contentRect.width || 440);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const logits: [number, number, number] = [z1, z2, z3];
  const probs = useMemo(() => softmax(logits), [z1, z2, z3]);

  const ceLoss = useMemo(() => {
    const p = probs[correctClass as 0 | 1 | 2];
    return -Math.log(Math.max(p, 1e-10));
  }, [probs, correctClass]);

  const handleReset = () => {
    setZ1(DEF_Z[0]);
    setZ2(DEF_Z[1]);
    setZ3(DEF_Z[2]);
    setCorrectClass(DEF_CORRECT);
  };

  // ---- 棒グラフのレイアウト計算 ----
  const innerW = width - PAD_L - PAD_R;
  const maxBarH = CHART_H - PAD_T - PAD_B;
  const barGroupW = innerW / 3;
  const barW = Math.min(barGroupW * 0.55, 80);

  // ---- 損失の色分け ----
  const lossColor =
    ceLoss < 0.5
      ? "var(--color-correct)"
      : ceLoss < 2.0
        ? "#ca8a04"
        : "var(--color-incorrect)";
  const lossBg =
    ceLoss < 0.5
      ? "var(--color-correct-soft)"
      : ceLoss < 2.0
        ? "#fef9c3"
        : "var(--color-incorrect-soft)";

  return (
    <PlaygroundFrame
      title="softmax と交差エントロピー"
      guide="3 本のスライダーを同じ値にそろえると確率が均等（各 33%）になります。1 本だけ大きく上げるとその確率が 1 へ近づきます。正解クラスが高い確率を得ると損失がどう変わるか確認しましょう。"
      onReset={handleReset}
      controls={
        <>
          <Slider
            label="ロジット z₁"
            value={z1}
            min={-5}
            max={5}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={setZ1}
          />
          <Slider
            label="ロジット z₂"
            value={z2}
            min={-5}
            max={5}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={setZ2}
          />
          <Slider
            label="ロジット z₃"
            value={z3}
            min={-5}
            max={5}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={setZ3}
          />
          <div style={{ marginTop: "var(--space-3)" }}>
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-muted)",
                marginBottom: "6px",
              }}
            >
              正解クラス
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {CLASS_NAMES.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  className={`btn${correctClass === i ? " btn-accent" : ""}`}
                  style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                  onClick={() => setCorrectClass(i)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div
            style={{
              marginTop: "var(--space-3)",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
              lineHeight: 1.6,
            }}
          >
            <div>L = −log(p_正解)</div>
            <div>p_正解 = {(probs[correctClass as 0 | 1 | 2] * 100).toFixed(1)}%</div>
          </div>
        </>
      }
    >
      <div ref={containerRef} style={{ width: "100%" }}>
        <svg
          viewBox={`0 0 ${width} ${TOTAL_H}`}
          width="100%"
          role="img"
          aria-label="softmax確率と交差エントロピー損失"
        >
          {/* ---- 基準線（確率 0 の位置）---- */}
          <line
            x1={PAD_L}
            y1={PAD_T + maxBarH}
            x2={PAD_L + innerW}
            y2={PAD_T + maxBarH}
            stroke="var(--color-border)"
            strokeWidth={1.5}
          />

          {/* ---- 確率 50% の補助線 ---- */}
          <line
            x1={PAD_L}
            y1={PAD_T + maxBarH * 0.5}
            x2={PAD_L + innerW}
            y2={PAD_T + maxBarH * 0.5}
            stroke="var(--color-grid)"
            strokeDasharray="4 3"
          />
          <text
            x={PAD_L - 2}
            y={PAD_T + maxBarH * 0.5 + 4}
            textAnchor="end"
            fontSize={9}
            fill="var(--color-text-muted)"
          >
            50%
          </text>

          {/* ---- 確率 100% の補助線 ---- */}
          <line
            x1={PAD_L}
            y1={PAD_T}
            x2={PAD_L + innerW}
            y2={PAD_T}
            stroke="var(--color-grid)"
            strokeDasharray="4 3"
          />
          <text
            x={PAD_L - 2}
            y={PAD_T + 4}
            textAnchor="end"
            fontSize={9}
            fill="var(--color-text-muted)"
          >
            100%
          </text>

          {/* ---- 棒グラフ ---- */}
          {probs.map((p, i) => {
            const color = CLASS_COLORS[i as 0 | 1 | 2];
            const isCorrect = i === correctClass;
            const barH = maxBarH * p;
            const barX = PAD_L + i * barGroupW + (barGroupW - barW) / 2;
            const barY = PAD_T + maxBarH - barH;

            return (
              <g key={i}>
                {/* バー本体 */}
                <rect
                  x={barX}
                  y={barY}
                  width={barW}
                  height={Math.max(barH, 1)}
                  fill={color}
                  opacity={isCorrect ? 1.0 : 0.45}
                  rx={4}
                />

                {/* 正解クラスのハイライト枠 */}
                {isCorrect && (
                  <>
                    <rect
                      x={barX - 2}
                      y={PAD_T - 4}
                      width={barW + 4}
                      height={maxBarH + 8}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                      rx={4}
                    />
                    <text
                      x={barX + barW / 2}
                      y={PAD_T - 8}
                      textAnchor="middle"
                      fontSize={9}
                      fill={color}
                      fontWeight="bold"
                    >
                      ★正解
                    </text>
                  </>
                )}

                {/* 確率ラベル（バー上部）*/}
                <text
                  x={barX + barW / 2}
                  y={Math.max(barY - 5, PAD_T + 12)}
                  textAnchor="middle"
                  fontSize={13}
                  fill={color}
                  fontWeight="bold"
                >
                  {(p * 100).toFixed(1)}%
                </text>

                {/* クラス名（バー下部）*/}
                <text
                  x={barX + barW / 2}
                  y={PAD_T + maxBarH + 15}
                  textAnchor="middle"
                  fontSize={11}
                  fill={isCorrect ? color : "var(--color-text-muted)"}
                  fontWeight={isCorrect ? "bold" : "normal"}
                >
                  {CLASS_NAMES[i as 0 | 1 | 2]}
                </text>

                {/* ロジット値 */}
                <text
                  x={barX + barW / 2}
                  y={PAD_T + maxBarH + 30}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--color-text-muted)"
                  fontFamily="var(--font-mono)"
                >
                  z={logits[i as 0 | 1 | 2].toFixed(1)}
                </text>

                {/* e^z の値（softmax の分子）*/}
                <text
                  x={barX + barW / 2}
                  y={PAD_T + maxBarH + 44}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--color-text-muted)"
                  fontFamily="var(--font-mono)"
                >
                  e^z={Math.exp(logits[i as 0 | 1 | 2]).toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* ---- CE 損失ボックス ---- */}
          {(() => {
            const boxY = CHART_H + 8;
            return (
              <>
                <rect
                  x={PAD_L}
                  y={boxY}
                  width={innerW}
                  height={LOSS_BOX_H - 4}
                  rx={8}
                  fill={lossBg}
                  stroke={lossColor}
                  strokeWidth={1}
                />
                <text
                  x={width / 2}
                  y={boxY + 18}
                  textAnchor="middle"
                  fontSize={11}
                  fill={lossColor}
                >
                  交差エントロピー損失（CE Loss） = −log(p_正解)
                </text>
                <text
                  x={width / 2}
                  y={boxY + 46}
                  textAnchor="middle"
                  fontSize={22}
                  fill={lossColor}
                  fontWeight="bold"
                  fontFamily="var(--font-mono)"
                >
                  L = {ceLoss.toFixed(4)}
                  {ceLoss < 0.5
                    ? "  （損失小: 正解に自信あり）"
                    : ceLoss > 3
                      ? "  （損失大: 大きく外れ）"
                      : ""}
                </text>
              </>
            );
          })()}
        </svg>
      </div>
    </PlaygroundFrame>
  );
}
