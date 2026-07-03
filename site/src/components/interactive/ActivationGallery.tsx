// 活性化関数ギャラリー（M3 用・SVG 描画）。
// Sigmoid/tanh/ReLU/Leaky ReLU の切替と入力 x スライダーで
// 関数曲線・接線・勾配値をリアルタイム表示し、勾配消失を観察できる。
import { useEffect, useMemo, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import Slider from "../ui/Slider";

type ActFn = "sigmoid" | "tanh" | "relu" | "lrelu";

interface ActDef {
  label: string;
  color: string;
  fn: (x: number) => number;
  grad: (x: number) => number;
  description: string;
}

const ACT_FUNCTIONS: Record<ActFn, ActDef> = {
  sigmoid: {
    label: "Sigmoid",
    color: "var(--color-class-0)",
    fn: (x) => 1 / (1 + Math.exp(-x)),
    grad: (x) => {
      const s = 1 / (1 + Math.exp(-x));
      return s * (1 - s);
    },
    description: "σ(x) = 1/(1+e⁻ˣ)、出力範囲 (0,1)",
  },
  tanh: {
    label: "tanh",
    color: "#7c3aed",
    fn: (x) => Math.tanh(x),
    grad: (x) => 1 - Math.tanh(x) ** 2,
    description: "tanh(x)、出力範囲 (−1,1)",
  },
  relu: {
    label: "ReLU",
    color: "var(--color-class-1)",
    fn: (x) => Math.max(0, x),
    grad: (x) => (x > 0 ? 1 : 0),
    description: "max(0,x)、正の領域で勾配 = 1",
  },
  lrelu: {
    label: "Leaky ReLU",
    color: "var(--color-correct)",
    fn: (x) => (x > 0 ? x : 0.01 * x),
    grad: (x) => (x > 0 ? 1 : 0.01),
    description: "x>0 なら x、x≤0 なら 0.01x",
  },
};

// ---- デフォルト ----
const DEF_FN: ActFn = "sigmoid";
const DEF_X = 0.0;

// ---- SVG レイアウト ----
const CHART_H = 260;
const PAD_T = 20;
const PAD_B = 36;
const PAD_L = 52;
const PAD_R = 20;
const SAMPLE_N = 200;

// ---- データ座標範囲 ----
const X_MIN = -5;
const X_MAX = 5;
const Y_MIN = -2;
const Y_MAX = 5.5;

// 接線の描画幅（x 軸方向の延長）
const TANGENT_HALF = 1.5;

export default function ActivationGallery() {
  const [fn, setFn] = useState<ActFn>(DEF_FN);
  const [xVal, setXVal] = useState(DEF_X);

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setWidth(entries[0]!.contentRect.width || 480);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleReset = () => {
    setFn(DEF_FN);
    setXVal(DEF_X);
  };

  const actDef = ACT_FUNCTIONS[fn];
  const innerW = width - PAD_L - PAD_R;
  const innerH = CHART_H - PAD_T - PAD_B;

  const toSvgX = (x: number) =>
    PAD_L + ((x - X_MIN) / (X_MAX - X_MIN)) * innerW;
  const toSvgY = (y: number) =>
    PAD_T + ((Y_MAX - y) / (Y_MAX - Y_MIN)) * innerH;

  // ---- 関数曲線のパス ----
  const curvePath = useMemo(() => {
    const pts = Array.from({ length: SAMPLE_N + 1 }, (_, i) => {
      const x = X_MIN + (i / SAMPLE_N) * (X_MAX - X_MIN);
      const y = Math.max(Y_MIN - 0.5, Math.min(Y_MAX + 0.5, actDef.fn(x)));
      return `${toSvgX(x).toFixed(1)},${toSvgY(y).toFixed(1)}`;
    });
    return "M " + pts.join(" L ");
  }, [fn, width]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 選択点での値と勾配 ----
  const y0 = actDef.fn(xVal);
  const g0 = actDef.grad(xVal);

  // ---- 接線のパス ----
  const tangentPath = useMemo(() => {
    const x1 = Math.max(X_MIN, xVal - TANGENT_HALF);
    const x2 = Math.min(X_MAX, xVal + TANGENT_HALF);
    const y1 = y0 + g0 * (x1 - xVal);
    const y2 = y0 + g0 * (x2 - xVal);
    const clampY = (y: number) =>
      Math.max(Y_MIN - 0.5, Math.min(Y_MAX + 0.5, y));
    return `M ${toSvgX(x1).toFixed(1)},${toSvgY(clampY(y1)).toFixed(1)} L ${toSvgX(x2).toFixed(1)},${toSvgY(clampY(y2)).toFixed(1)}`;
  }, [fn, xVal, y0, g0, width]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 勾配消失の判定 ----
  const gradVanishing = Math.abs(g0) < 0.05;
  const gradNearZero = Math.abs(g0) < 0.01;

  // ---- 軸目盛り ----
  const yTicks = [-1, 0, 1, 2, 3, 4, 5];
  const xTicks = [-4, -2, 0, 2, 4];

  return (
    <PlaygroundFrame
      title="活性化関数ギャラリー"
      guide="Sigmoid または tanh を選んで x スライダーを±4 以上に動かしてみましょう。曲線の傾き（接線）がほぼ水平になり、勾配の値が 0 に近づきます。ReLU に切り替えると、正の領域では勾配が常に 1 に保たれます。"
      onReset={handleReset}
      controls={
        <>
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
              marginBottom: "6px",
            }}
          >
            活性化関数
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              marginBottom: "var(--space-3)",
            }}
          >
            {(Object.entries(ACT_FUNCTIONS) as [ActFn, ActDef][]).map(
              ([key, def]) => (
                <button
                  key={key}
                  type="button"
                  className={`btn${fn === key ? " btn-accent" : ""}`}
                  style={{ padding: "5px 10px", fontSize: "0.85rem", textAlign: "left" }}
                  onClick={() => setFn(key)}
                >
                  <span style={{ fontWeight: "bold" }}>{def.label}</span>
                </button>
              ),
            )}
          </div>
          <Slider
            label="入力 x"
            value={xVal}
            min={-5}
            max={5}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={setXVal}
          />
          <div
            style={{
              marginTop: "var(--space-3)",
              padding: "var(--space-2)",
              borderRadius: "var(--radius-md)",
              background: gradVanishing
                ? "var(--color-incorrect-soft)"
                : "var(--color-correct-soft)",
              fontSize: "var(--text-sm)",
              lineHeight: 1.6,
            }}
          >
            <div>
              <strong>f(x₀) =</strong>{" "}
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {y0.toFixed(4)}
              </span>
            </div>
            <div>
              <strong>f ′(x₀) =</strong>{" "}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  color: gradVanishing
                    ? "var(--color-incorrect)"
                    : "var(--color-correct)",
                  fontWeight: "bold",
                }}
              >
                {g0.toFixed(4)}
              </span>
            </div>
            {gradNearZero && (
              <div
                style={{
                  color: "var(--color-incorrect)",
                  fontWeight: "bold",
                  marginTop: 4,
                }}
              >
                ⚠ 勾配消失！
              </div>
            )}
            {gradVanishing && !gradNearZero && (
              <div style={{ color: "var(--color-incorrect)", marginTop: 4 }}>
                勾配が小さい（消失傾向）
              </div>
            )}
          </div>
          <div
            style={{
              marginTop: "var(--space-2)",
              fontSize: "0.78rem",
              color: "var(--color-text-muted)",
            }}
          >
            {actDef.description}
          </div>
        </>
      }
    >
      <div ref={containerRef} style={{ width: "100%" }}>
        <svg
          viewBox={`0 0 ${width} ${CHART_H}`}
          width="100%"
          role="img"
          aria-label={`活性化関数 ${actDef.label} のグラフ`}
        >
          {/* 背景 */}
          <rect
            x={PAD_L}
            y={PAD_T}
            width={innerW}
            height={innerH}
            fill="var(--color-surface)"
            stroke="var(--color-border)"
          />

          {/* グリッド線 */}
          {yTicks.map((t) => (
            <line
              key={`yg${t}`}
              x1={PAD_L}
              x2={PAD_L + innerW}
              y1={toSvgY(t)}
              y2={toSvgY(t)}
              stroke="var(--color-grid)"
              strokeDasharray="3 3"
            />
          ))}
          {xTicks.map((t) => (
            <line
              key={`xg${t}`}
              x1={toSvgX(t)}
              x2={toSvgX(t)}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke="var(--color-grid)"
              strokeDasharray="3 3"
            />
          ))}

          {/* 軸（x=0, y=0 の線）*/}
          <line
            x1={toSvgX(0)}
            x2={toSvgX(0)}
            y1={PAD_T}
            y2={PAD_T + innerH}
            stroke="var(--color-border)"
            strokeWidth={1.5}
          />
          <line
            x1={PAD_L}
            x2={PAD_L + innerW}
            y1={toSvgY(0)}
            y2={toSvgY(0)}
            stroke="var(--color-border)"
            strokeWidth={1.5}
          />

          {/* Y 軸ラベル */}
          {yTicks.map((t) => (
            <text
              key={`yl${t}`}
              x={PAD_L - 6}
              y={toSvgY(t) + 4}
              textAnchor="end"
              fontSize={10}
              fill="var(--color-text-muted)"
            >
              {t}
            </text>
          ))}

          {/* X 軸ラベル */}
          {xTicks.map((t) => (
            <text
              key={`xl${t}`}
              x={toSvgX(t)}
              y={PAD_T + innerH + 14}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-text-muted)"
            >
              {t}
            </text>
          ))}
          <text
            x={PAD_L + innerW + 4}
            y={toSvgY(0) + 4}
            fontSize={11}
            fill="var(--color-text-muted)"
          >
            x
          </text>
          <text
            x={toSvgX(0) + 4}
            y={PAD_T - 5}
            fontSize={11}
            fill="var(--color-text-muted)"
          >
            y
          </text>

          {/* 関数曲線 */}
          <clipPath id="chart-clip">
            <rect x={PAD_L} y={PAD_T} width={innerW} height={innerH} />
          </clipPath>
          <path
            d={curvePath}
            fill="none"
            stroke={actDef.color}
            strokeWidth={2.5}
            clipPath="url(#chart-clip)"
          />

          {/* 接線 */}
          <line
            x1={parseFloat(tangentPath.split(" ")[1]?.split(",")[0] ?? "0")}
            y1={parseFloat(tangentPath.split(" ")[1]?.split(",")[1] ?? "0")}
            x2={parseFloat(tangentPath.split(" ")[3]?.split(",")[0] ?? "0")}
            y2={parseFloat(tangentPath.split(" ")[3]?.split(",")[1] ?? "0")}
            stroke={gradVanishing ? "var(--color-incorrect)" : "var(--color-text-muted)"}
            strokeWidth={gradVanishing ? 2.5 : 1.5}
            strokeDasharray={gradVanishing ? "none" : "5 3"}
            clipPath="url(#chart-clip)"
          />

          {/* 選択点（現在の x₀）*/}
          {toSvgY(y0) >= PAD_T && toSvgY(y0) <= PAD_T + innerH && (
            <>
              {/* 垂直点線 */}
              <line
                x1={toSvgX(xVal)}
                y1={toSvgY(y0)}
                x2={toSvgX(xVal)}
                y2={PAD_T + innerH}
                stroke={actDef.color}
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.6}
              />
              {/* 水平点線 */}
              <line
                x1={PAD_L}
                y1={toSvgY(y0)}
                x2={toSvgX(xVal)}
                y2={toSvgY(y0)}
                stroke={actDef.color}
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.6}
              />
              {/* 点 */}
              <circle
                cx={toSvgX(xVal)}
                cy={toSvgY(y0)}
                r={6}
                fill={gradVanishing ? "var(--color-incorrect)" : actDef.color}
                stroke="white"
                strokeWidth={2}
              />
            </>
          )}

          {/* 勾配の注釈ボックス */}
          {(() => {
            const bx = PAD_L + 8;
            const by = PAD_T + 8;
            const bw = 160;
            const bh = 40;
            const bgColor = gradVanishing
              ? "var(--color-incorrect-soft)"
              : "var(--color-accent-soft)";
            const textColor = gradVanishing
              ? "var(--color-incorrect)"
              : "var(--color-accent)";
            return (
              <>
                <rect x={bx} y={by} width={bw} height={bh} rx={6} fill={bgColor} opacity={0.92} />
                <text
                  x={bx + 8}
                  y={by + 14}
                  fontSize={11}
                  fill={textColor}
                  fontWeight="bold"
                >
                  {actDef.label}
                </text>
                <text
                  x={bx + 8}
                  y={by + 30}
                  fontSize={11}
                  fill={textColor}
                  fontFamily="var(--font-mono)"
                >
                  f ′({xVal.toFixed(1)}) = {g0.toFixed(4)}
                  {gradNearZero ? " ← 消失!" : ""}
                </text>
              </>
            );
          })()}

          {/* X 軸ラベル（タイトル）*/}
          <text
            x={PAD_L + innerW / 2}
            y={CHART_H - 4}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-text-muted)"
          >
            入力 x
          </text>
        </svg>
      </div>
    </PlaygroundFrame>
  );
}
