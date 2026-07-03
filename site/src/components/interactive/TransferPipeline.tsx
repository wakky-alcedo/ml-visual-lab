// TransferPipeline（M6・SVG）
// 転移学習のパイプライン（入力画像 → 凍結CNN → 特徴ベクトル → 自前分類器 → 予測）を
// ステップ実行で図解する。どこが事前学習済み（凍結）でどこだけを自分のデータで学ぶかを
// 色分けで明示する。
import { useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";

// パイプラインの各ステップの定義
const STEPS = [
  {
    id: "input",
    label: "入力画像",
    detail: "自前の画像データ",
    description:
      "各クラス数十枚程度の「自分の画像」を入力します。ImageNet（約1400万枚）に比べれば決定的に少ないデータです。この規模でCNNを一から訓練すると確実に過学習します。",
    highlight: "neutral" as const,
  },
  {
    id: "pretrained",
    label: "事前学習 CNN（凍結）",
    detail: "ResNet / VGG など・ImageNet 学習済み",
    description:
      "ImageNet（約1400万枚・1000クラス）で訓練済みのCNN（バックボーン）が特徴抽出を担います。重みは「凍結」されており、このステップは自分のデータで再学習しません。ImageNetで身につけたエッジ・質感・形状の「見る目」をそのまま借りてきます。",
    highlight: "frozen" as const,
  },
  {
    id: "feature",
    label: "特徴ベクトル",
    detail: "数百〜数千次元の凝縮表現",
    description:
      "CNNの最終全結合層を除いた出力が「特徴ベクトル」です。画像の意味情報が凝縮された数百〜数千次元のベクトルで、生画像（数万ピクセル）よりはるかに扱いやすい表現になっています。同クラスの画像はこの空間で近くに集まります。",
    highlight: "neutral" as const,
  },
  {
    id: "classifier",
    label: "自前分類器の学習",
    detail: "ロジスティック回帰 / SVM など",
    description:
      "特徴ベクトルを入力として、自分の課題（例: 正常・キズ・変色の3クラス）を判定する分類器を自前データで学習します。学習するパラメータは少なく（線形分類器の重みとバイアスのみ）、数十枚のデータでも安定して学習できます。",
    highlight: "learned" as const,
  },
  {
    id: "prediction",
    label: "クラス予測",
    detail: "確率（Softmax）で出力",
    description:
      "分類器が各クラスへの確率をsoftmaxで出力します。「難しい仕事（視覚特徴の抽出）は事前学習済みモデルに任せ、簡単な仕事（確率的な判定）だけを自前データで学ぶ」という転移学習の完成形です。",
    highlight: "learned" as const,
  },
] as const;

type StepHighlight = (typeof STEPS)[number]["highlight"];

const HIGHLIGHT_COLORS: Record<StepHighlight, { fill: string; stroke: string; text: string }> = {
  neutral: { fill: "#f3f4f6", stroke: "#9ca3af", text: "#374151" },
  frozen: { fill: "#dbeafe", stroke: "#2563eb", text: "#1e40af" },
  learned: { fill: "#dcfce7", stroke: "#16a34a", text: "#14532d" },
};

const ACTIVE_GLOW: Record<StepHighlight, string> = {
  neutral: "#6b7280",
  frozen: "#2563eb",
  learned: "#16a34a",
};

export default function TransferPipeline() {
  const [step, setStep] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const curStep = STEPS[step];
  const handlePrev = () => setStep((s) => Math.max(0, s - 1));
  const handleNext = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const handleReset = () => setStep(0);

  // SVG レイアウト定数
  const SVG_W = 600;
  const SVG_H = 200;
  const BOX_W = 90;
  const BOX_H = 56;
  const ARROW_W = 28;
  const N = STEPS.length; // 5
  const TOTAL_W = N * BOX_W + (N - 1) * ARROW_W;
  const startX = (SVG_W - TOTAL_W) / 2;
  const boxY = (SVG_H - BOX_H) / 2;

  // 各ボックスの中心X
  const boxCx = (i: number) => startX + i * (BOX_W + ARROW_W) + BOX_W / 2;
  const boxX = (i: number) => startX + i * (BOX_W + ARROW_W);
  const arrowStartX = (i: number) => boxX(i) + BOX_W;
  const arrowEndX = (i: number) => boxX(i + 1);

  return (
    <PlaygroundFrame
      title="転移学習パイプライン"
      guide={
        <>
          「次へ」を押すたびに各段階がハイライトされます。青が凍結（借り物）、緑が自前学習の色分けに注目しよう。／
          「特徴抽出器を通した瞬間に生画像が数百次元のベクトルに変わる」という変換の役割を、ステップ③で意識してみよう。
        </>
      }
      onReset={handleReset}
      controls={
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button type="button" className="btn" onClick={handlePrev} disabled={step === 0}>
              ← 前へ
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleNext}
              disabled={step === STEPS.length - 1}
            >
              次へ →
            </button>
          </div>

          {/* ステップ説明 */}
          <div
            style={{
              padding: "12px 14px",
              background: "var(--color-surface)",
              border: `2px solid ${ACTIVE_GLOW[curStep.highlight]}`,
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <p
              style={{
                fontWeight: 700,
                fontSize: "var(--text-sm)",
                margin: "0 0 4px 0",
                color: ACTIVE_GLOW[curStep.highlight],
              }}
            >
              ステップ {step + 1} / {STEPS.length}：{curStep.label}
            </p>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-muted)",
                margin: 0,
                lineHeight: 1.65,
              }}
            >
              {curStep.description}
            </p>
          </div>

          {/* 凡例 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--text-sm)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  background: "#dbeafe",
                  border: "2px solid #2563eb",
                  borderRadius: 3,
                }}
              />
              凍結（ImageNet 学習済み・再学習しない）
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  background: "#dcfce7",
                  border: "2px solid #16a34a",
                  borderRadius: 3,
                }}
              />
              自前学習（自分のデータで学ぶ）
            </span>
          </div>
        </>
      }
    >
      <div ref={wrapRef} style={{ width: "100%" }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          style={{
            display: "block",
            background: "var(--color-surface)",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            overflow: "visible",
          }}
          aria-label="転移学習パイプラインの図解"
        >
          {/* 矢印 */}
          {STEPS.slice(0, -1).map((_, i) => {
            const ax1 = arrowStartX(i);
            const ax2 = arrowEndX(i);
            const ay = boxY + BOX_H / 2;
            const active = step > i;
            return (
              <g key={`arrow-${i}`}>
                <line
                  x1={ax1}
                  y1={ay}
                  x2={ax2 - 8}
                  y2={ay}
                  stroke={active ? "#6b7280" : "var(--color-border)"}
                  strokeWidth={active ? 2 : 1.5}
                />
                <polygon
                  points={`${ax2 - 8},${ay - 5} ${ax2 - 8},${ay + 5} ${ax2},${ay}`}
                  fill={active ? "#6b7280" : "var(--color-border)"}
                />
              </g>
            );
          })}

          {/* ボックス */}
          {STEPS.map((s, i) => {
            const isActive = i === step;
            const isPast = i < step;
            const colors = HIGHLIGHT_COLORS[s.highlight];
            const cx = boxCx(i);
            const bx = boxX(i);

            return (
              <g key={s.id}>
                {/* ボックス本体 */}
                <rect
                  x={bx}
                  y={boxY}
                  width={BOX_W}
                  height={BOX_H}
                  rx={8}
                  fill={isPast || isActive ? colors.fill : "#f9fafb"}
                  stroke={isActive ? ACTIVE_GLOW[s.highlight] : isPast ? colors.stroke : "#d1d5db"}
                  strokeWidth={isActive ? 3 : 1.5}
                />
                {/* アクティブ時のグロー */}
                {isActive && (
                  <rect
                    x={bx - 3}
                    y={boxY - 3}
                    width={BOX_W + 6}
                    height={BOX_H + 6}
                    rx={11}
                    fill="none"
                    stroke={ACTIVE_GLOW[s.highlight]}
                    strokeWidth={1}
                    opacity={0.35}
                  />
                )}

                {/* ステップ番号 */}
                <text
                  x={cx}
                  y={boxY + 14}
                  textAnchor="middle"
                  fontSize={10}
                  fill={isPast || isActive ? colors.text : "#9ca3af"}
                  fontWeight={600}
                >
                  ステップ{i + 1}
                </text>

                {/* メインラベル（2行折り返し） */}
                {s.label.length > 10 ? (
                  <>
                    <text
                      x={cx}
                      y={boxY + 28}
                      textAnchor="middle"
                      fontSize={9.5}
                      fill={isPast || isActive ? colors.text : "#6b7280"}
                      fontWeight={700}
                    >
                      {s.label.slice(0, Math.ceil(s.label.length / 2))}
                    </text>
                    <text
                      x={cx}
                      y={boxY + 40}
                      textAnchor="middle"
                      fontSize={9.5}
                      fill={isPast || isActive ? colors.text : "#6b7280"}
                      fontWeight={700}
                    >
                      {s.label.slice(Math.ceil(s.label.length / 2))}
                    </text>
                  </>
                ) : (
                  <text
                    x={cx}
                    y={boxY + 33}
                    textAnchor="middle"
                    fontSize={9.5}
                    fill={isPast || isActive ? colors.text : "#6b7280"}
                    fontWeight={700}
                  >
                    {s.label}
                  </text>
                )}

                {/* サブ詳細 */}
                <text
                  x={cx}
                  y={boxY + BOX_H - 7}
                  textAnchor="middle"
                  fontSize={8}
                  fill={isPast || isActive ? colors.text : "#9ca3af"}
                >
                  {s.detail}
                </text>
              </g>
            );
          })}

          {/* ImageNet 枚数の注記 */}
          <text
            x={boxCx(1)}
            y={boxY + BOX_H + 22}
            textAnchor="middle"
            fontSize={8.5}
            fill="#2563eb"
          >
            ImageNet: 約1400万枚・1000クラス
          </text>
        </svg>

        {/* プログレスバー */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginTop: 8,
          }}
        >
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: i <= step ? ACTIVE_GLOW[STEPS[i].highlight] : "var(--color-border)",
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>
      </div>
    </PlaygroundFrame>
  );
}
