// 重み・バイアス操作盤（M2 用・SVG 描画）。
// w1, w2, b スライダーと課題モード（AND/OR/NOT/NAND）切替で
// 真理値表の各行が PASS/FAIL に変わるインタラクティブ部品。
import { useEffect, useMemo, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import Slider from "../ui/Slider";

type LogicMode = "AND" | "OR" | "NOT" | "NAND";

interface TruthRow {
  x1: number;
  x2: number; // NOT モードでは参照しない
  expected: number;
}

const TRUTH_TABLES: Record<LogicMode, TruthRow[]> = {
  AND: [
    { x1: 0, x2: 0, expected: 0 },
    { x1: 0, x2: 1, expected: 0 },
    { x1: 1, x2: 0, expected: 0 },
    { x1: 1, x2: 1, expected: 1 },
  ],
  OR: [
    { x1: 0, x2: 0, expected: 0 },
    { x1: 0, x2: 1, expected: 1 },
    { x1: 1, x2: 0, expected: 1 },
    { x1: 1, x2: 1, expected: 1 },
  ],
  NOT: [
    { x1: 0, x2: 0, expected: 1 },
    { x1: 1, x2: 0, expected: 0 },
  ],
  NAND: [
    { x1: 0, x2: 0, expected: 1 },
    { x1: 0, x2: 1, expected: 1 },
    { x1: 1, x2: 0, expected: 1 },
    { x1: 1, x2: 1, expected: 0 },
  ],
};

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

// ---- デフォルト値（AND が全行 PASS になる初期パラメータ）----
const DEF_MODE: LogicMode = "AND";
const DEF_W1 = 2.0;
const DEF_W2 = 2.0;
const DEF_B = -3.0;

// ---- SVG レイアウト定数 ----
const FORMULA_H = 44;
const HEADER_H = 28;
const ROW_H = 46;
const MAX_ROWS = 4;
const CELEB_H = 44;
const TOTAL_H = FORMULA_H + HEADER_H + MAX_ROWS * ROW_H + CELEB_H; // 300

// 列構成（NOT と 2入力で異なる）
function getColumns(isNOT: boolean, width: number) {
  if (isNOT) {
    // x₁ | 期待 | 実際 σ(z) | 判定
    const w = width;
    return [
      { label: "x₁",       cx: w * 0.09 },
      { label: "期待",      cx: w * 0.27 },
      { label: "実際 σ(z)", cx: w * 0.52 },
      { label: "判定",      cx: w * 0.81 },
    ];
  } else {
    // x₁ | x₂ | 期待 | 実際 σ(z) | 判定
    const w = width;
    return [
      { label: "x₁",       cx: w * 0.07 },
      { label: "x₂",       cx: w * 0.18 },
      { label: "期待",      cx: w * 0.30 },
      { label: "実際 σ(z)", cx: w * 0.52 },
      { label: "判定",      cx: w * 0.80 },
    ];
  }
}

export default function LogicNeuronBoard() {
  const [mode, setMode] = useState<LogicMode>(DEF_MODE);
  const [w1, setW1] = useState(DEF_W1);
  const [w2, setW2] = useState(DEF_W2);
  const [b, setB] = useState(DEF_B);

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

  const isNOT = mode === "NOT";
  const table = TRUTH_TABLES[mode];

  const rows = useMemo(() => {
    return table.map((row) => {
      const z = w1 * row.x1 + (isNOT ? 0 : w2 * row.x2) + b;
      const sigZ = sigmoid(z);
      const output = sigZ > 0.5 ? 1 : 0;
      const pass = output === row.expected;
      return { ...row, z, sigZ, output, pass };
    });
  }, [mode, w1, w2, b, isNOT, table]);

  const allPass = rows.every((r) => r.pass);

  const handleReset = () => {
    setMode(DEF_MODE);
    setW1(DEF_W1);
    setW2(DEF_W2);
    setB(DEF_B);
  };

  const cols = getColumns(isNOT, width);

  // 各行のデータ表示に使う列インデックス
  const colIdxX1 = 0;
  const colIdxX2 = isNOT ? -1 : 1;
  const colIdxExpected = isNOT ? 1 : 2;
  const colIdxActual = isNOT ? 2 : 3;
  const colIdxBadge = isNOT ? 3 : 4;

  return (
    <PlaygroundFrame
      title="重み・バイアス操作盤"
      guide="AND モードで w₁=w₂=2、b=−3 を試してください。全行 PASS になる組み合わせを自分で探しましょう。b を少しずつ上げると OR に変わる瞬間がわかります。NOT モードにすると入力が 1 本になります。"
      onReset={handleReset}
      controls={
        <>
          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
              marginBottom: "var(--space-3)",
            }}
          >
            {(["AND", "OR", "NOT", "NAND"] as LogicMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`btn${mode === m ? " btn-accent" : ""}`}
                style={{ padding: "4px 10px", fontSize: "0.85rem" }}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <Slider
            label="w₁"
            value={w1}
            min={-3}
            max={3}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={setW1}
          />
          {!isNOT && (
            <Slider
              label="w₂"
              value={w2}
              min={-3}
              max={3}
              step={0.1}
              format={(v) => v.toFixed(1)}
              onChange={setW2}
            />
          )}
          <Slider
            label="b（バイアス）"
            value={b}
            min={-3}
            max={3}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={setB}
          />
          <div
            style={{
              marginTop: "var(--space-3)",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
              lineHeight: 1.5,
            }}
          >
            <div>
              モード: <strong>{mode}</strong>
            </div>
            <div>σ(z) &gt; 0.5 → 出力 1</div>
            <div>σ(z) ≤ 0.5 → 出力 0</div>
          </div>
        </>
      }
    >
      <div ref={containerRef} style={{ width: "100%" }}>
        <svg
          viewBox={`0 0 ${width} ${TOTAL_H}`}
          width="100%"
          role="img"
          aria-label={`${mode} 論理ニューロン真理値表`}
        >
          {/* ---- 数式表示エリア ---- */}
          <rect x={0} y={0} width={width} height={FORMULA_H} fill="var(--color-surface)" />
          <text
            x={width / 2}
            y={14}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-text-muted)"
          >
            {isNOT
              ? `z = w₁·x₁ + b = ${w1.toFixed(1)}·x₁ + (${b.toFixed(1)})`
              : `z = w₁·x₁ + w₂·x₂ + b = ${w1.toFixed(1)}·x₁ + ${w2.toFixed(1)}·x₂ + (${b.toFixed(1)})`}
          </text>
          <text
            x={width / 2}
            y={32}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-text-muted)"
          >
            出力 y = (σ(z) &gt; 0.5) ? 1 : 0
          </text>
          <line
            x1={0}
            y1={FORMULA_H}
            x2={width}
            y2={FORMULA_H}
            stroke="var(--color-border)"
          />

          {/* ---- 列ヘッダー ---- */}
          <rect
            x={0}
            y={FORMULA_H}
            width={width}
            height={HEADER_H}
            fill="var(--color-surface-2)"
          />
          {cols.map((col, ci) => (
            <text
              key={ci}
              x={col.cx}
              y={FORMULA_H + HEADER_H / 2 + 4}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-text-muted)"
              fontWeight="bold"
            >
              {col.label}
            </text>
          ))}
          <line
            x1={0}
            y1={FORMULA_H + HEADER_H}
            x2={width}
            y2={FORMULA_H + HEADER_H}
            stroke="var(--color-border)"
          />

          {/* ---- データ行 ---- */}
          {rows.map((row, ri) => {
            const rowY = FORMULA_H + HEADER_H + ri * ROW_H;
            const badgeColor = row.pass
              ? "var(--color-correct)"
              : "var(--color-incorrect)";
            const badgeBg = row.pass
              ? "var(--color-correct-soft)"
              : "var(--color-incorrect-soft)";
            const badgeCx = cols[colIdxBadge]!.cx;

            return (
              <g key={ri}>
                {/* 行背景 */}
                <rect
                  x={0}
                  y={rowY}
                  width={width}
                  height={ROW_H}
                  fill={ri % 2 === 0 ? "#ffffff" : "var(--color-surface)"}
                />

                {/* x₁ */}
                <text
                  x={cols[colIdxX1]!.cx}
                  y={rowY + ROW_H / 2 + 5}
                  textAnchor="middle"
                  fontSize={18}
                  fontWeight="bold"
                  fill="var(--color-text)"
                  fontFamily="var(--font-mono)"
                >
                  {row.x1}
                </text>

                {/* x₂（NOT 以外） */}
                {colIdxX2 >= 0 && (
                  <text
                    x={cols[colIdxX2]!.cx}
                    y={rowY + ROW_H / 2 + 5}
                    textAnchor="middle"
                    fontSize={18}
                    fontWeight="bold"
                    fill="var(--color-text)"
                    fontFamily="var(--font-mono)"
                  >
                    {row.x2}
                  </text>
                )}

                {/* 期待出力 */}
                <text
                  x={cols[colIdxExpected]!.cx}
                  y={rowY + ROW_H / 2 + 5}
                  textAnchor="middle"
                  fontSize={18}
                  fill="var(--color-text-muted)"
                  fontFamily="var(--font-mono)"
                >
                  {row.expected}
                </text>

                {/* 実際の出力（y と σ(z) 値） */}
                <text
                  x={cols[colIdxActual]!.cx}
                  y={rowY + ROW_H / 2}
                  textAnchor="middle"
                  fontSize={15}
                  fill={row.pass ? "var(--color-correct)" : "var(--color-incorrect)"}
                  fontFamily="var(--font-mono)"
                  fontWeight="bold"
                >
                  {row.output}
                </text>
                <text
                  x={cols[colIdxActual]!.cx}
                  y={rowY + ROW_H / 2 + 13}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--color-text-muted)"
                  fontFamily="var(--font-mono)"
                >
                  σ={row.sigZ.toFixed(2)} z={row.z.toFixed(2)}
                </text>

                {/* PASS / FAIL バッジ */}
                <rect
                  x={badgeCx - 32}
                  y={rowY + ROW_H / 2 - 13}
                  width={64}
                  height={26}
                  rx={6}
                  fill={badgeBg}
                />
                <text
                  x={badgeCx}
                  y={rowY + ROW_H / 2 + 4}
                  textAnchor="middle"
                  fontSize={13}
                  fill={badgeColor}
                  fontWeight="bold"
                >
                  {row.pass ? "PASS ✓" : "FAIL ✗"}
                </text>

                {/* 行区切り */}
                <line
                  x1={0}
                  y1={rowY + ROW_H}
                  x2={width}
                  y2={rowY + ROW_H}
                  stroke="var(--color-border)"
                  strokeDasharray="2 3"
                />
              </g>
            );
          })}

          {/* NOT モードでは空行を灰色に */}
          {isNOT &&
            [2, 3].map((ri) => {
              const rowY = FORMULA_H + HEADER_H + ri * ROW_H;
              return (
                <rect
                  key={ri}
                  x={0}
                  y={rowY}
                  width={width}
                  height={ROW_H}
                  fill="var(--color-surface-2)"
                  opacity={0.4}
                />
              );
            })}

          {/* ---- 全行 PASS 祝福バナー ---- */}
          {allPass ? (
            <g>
              <rect
                x={8}
                y={FORMULA_H + HEADER_H + MAX_ROWS * ROW_H + 6}
                width={width - 16}
                height={CELEB_H - 10}
                rx={8}
                fill="var(--color-correct-soft)"
                stroke="var(--color-correct)"
                strokeWidth={1.5}
              />
              <text
                x={width / 2}
                y={FORMULA_H + HEADER_H + MAX_ROWS * ROW_H + 26}
                textAnchor="middle"
                fontSize={14}
                fill="var(--color-correct)"
                fontWeight="bold"
              >
                全行 PASS！ {mode} が実現できています！
              </text>
              <text
                x={width / 2}
                y={FORMULA_H + HEADER_H + MAX_ROWS * ROW_H + 44}
                textAnchor="middle"
                fontSize={11}
                fill="var(--color-correct)"
              >
                w₁={w1.toFixed(1)}, {isNOT ? "" : `w₂=${w2.toFixed(1)}, `}b={b.toFixed(1)}
              </text>
            </g>
          ) : (
            <text
              x={width / 2}
              y={FORMULA_H + HEADER_H + MAX_ROWS * ROW_H + 28}
              textAnchor="middle"
              fontSize={12}
              fill="var(--color-text-muted)"
            >
              スライダーを動かして全行 PASS を目指してください
            </text>
          )}
        </svg>
      </div>
    </PlaygroundFrame>
  );
}
