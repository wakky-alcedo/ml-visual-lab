// 多項式フィッティング実験室（M1 用・SVG 描画）。
// 次数・データ数・ノイズのスライダーで過学習を体感するインタラクティブ部品。
import { useEffect, useMemo, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import Slider from "../ui/Slider";
import { mulberry32, DEFAULT_SEED } from "../../lib/rng";
import { polyfit, polyPredict, polyPredictAll, mse } from "../../lib/polyfit";

// ---- デフォルト値 ----
const DEF_DEGREE = 3;
const DEF_COUNT = 30;
const DEF_NOISE = 0.3;

// ---- 真の関数: sin(2πx) ----
const trueFunc = (x: number) => Math.sin(2 * Math.PI * x);

// ---- SVG レイアウト定数 ----
const CHART_H = 260;
const PAD_T = 16;
const PAD_B = 32;
const PAD_L = 40;
const PAD_R = 16;
const X_MIN = -1.2;
const X_MAX = 1.2;
const Y_MIN = -3.0;
const Y_MAX = 3.0;
const SAMPLE_N = 200; // 曲線を描くサンプル数
const LAMBDA = 1e-4;  // 特異行列回避のための微小リッジ項

export default function PolyFitLab() {
  const [degree, setDegree] = useState(DEF_DEGREE);
  const [count, setCount] = useState(DEF_COUNT);
  const [noise, setNoise] = useState(DEF_NOISE);
  const [seed, setSeed] = useState(DEFAULT_SEED);

  // コンテナ幅の追跡（ResizeObserver）
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

  // ---- データ生成（シード付き乱数で再現性保証）----
  const { trainPts, testPts, coeffs, trainMSE, testMSE, fitError } =
    useMemo(() => {
      const rng = mulberry32(seed);
      // n 点生成 → シャッフル済みの x を均等にしたいが乱数の方が自然
      const allX = Array.from({ length: count }, () =>
        rng.uniform(X_MIN + 0.1, X_MAX - 0.1),
      );
      const allY = allX.map(
        (x) => trueFunc(x) + noise * rng.normal(0, 1),
      );

      // 70/30 で train/test 分割
      const splitAt = Math.max(1, Math.ceil(count * 0.7));
      const trainX = allX.slice(0, splitAt);
      const trainY = allY.slice(0, splitAt);
      const testX = allX.slice(splitAt);
      const testY = allY.slice(splitAt);

      // 多項式フィット（LAMBDA で特異行列を回避）
      let coeffs: number[] | null = null;
      let fitError = "";
      try {
        coeffs = polyfit(trainX, trainY, degree, LAMBDA);
      } catch (e) {
        fitError = e instanceof Error ? e.message : "フィット失敗";
      }

      let trainMSE = NaN;
      let testMSE = NaN;
      if (coeffs) {
        trainMSE = mse(trainY, polyPredictAll(coeffs, trainX));
        testMSE =
          testX.length > 0
            ? mse(testY, polyPredictAll(coeffs, testX))
            : NaN;
      }

      return {
        trainPts: trainX.map((x, i) => ({ x, y: trainY[i]! })),
        testPts: testX.map((x, i) => ({ x, y: testY[i]! })),
        coeffs,
        trainMSE,
        testMSE,
        fitError,
      };
    }, [degree, count, noise, seed]);

  // ---- 座標変換ヘルパ ----
  const innerW = width - PAD_L - PAD_R;
  const innerH = CHART_H - PAD_T - PAD_B;
  const toSvgX = (x: number) =>
    PAD_L + ((x - X_MIN) / (X_MAX - X_MIN)) * innerW;
  const toSvgY = (y: number) =>
    PAD_T + ((Y_MAX - y) / (Y_MAX - Y_MIN)) * innerH;

  // ---- 真の関数の曲線 ----
  const truePoints = Array.from({ length: SAMPLE_N + 1 }, (_, i) => {
    const x = X_MIN + (i / SAMPLE_N) * (X_MAX - X_MIN);
    return { x: toSvgX(x), y: toSvgY(trueFunc(x)) };
  });
  const truePath =
    "M " + truePoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");

  // ---- フィット曲線の曲線 ----
  let fitPath = "";
  if (coeffs) {
    const fitPoints = Array.from({ length: SAMPLE_N + 1 }, (_, i) => {
      const xData = X_MIN + (i / SAMPLE_N) * (X_MAX - X_MIN);
      const yData = Math.max(Y_MIN, Math.min(Y_MAX, polyPredict(coeffs!, xData)));
      return { x: toSvgX(xData), y: toSvgY(yData) };
    });
    fitPath =
      "M " + fitPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");
  }

  // ---- 軸目盛り ----
  const yTicks = [-2, -1, 0, 1, 2];
  const xTicks = [-1, 0, 1];

  const totalH = CHART_H + 56; // グラフ + 誤差表示エリア

  const handleReset = () => {
    setDegree(DEF_DEGREE);
    setCount(DEF_COUNT);
    setNoise(DEF_NOISE);
    setSeed(DEFAULT_SEED);
  };

  return (
    <PlaygroundFrame
      title="多項式フィッティング実験室"
      guide="次数を15にしてデータ数を10以下に減らすと何が起きる？ ノイズを大きくしたとき、次数が高い・低いでどちらがテスト誤差が小さくなる？"
      onReset={handleReset}
      controls={
        <>
          <Slider
            label="次数"
            value={degree}
            min={0}
            max={15}
            step={1}
            onChange={setDegree}
          />
          <Slider
            label="データ数"
            value={count}
            min={5}
            max={100}
            step={1}
            unit="点"
            onChange={setCount}
          />
          <Slider
            label="ノイズ強度"
            value={noise}
            min={0}
            max={2}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={setNoise}
          />
        </>
      }
    >
      <div ref={containerRef} style={{ width: "100%" }}>
        <svg
          viewBox={`0 0 ${width} ${totalH}`}
          width="100%"
          role="img"
          aria-label="多項式フィッティング結果"
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

          {/* 軸ラベル（y 軸） */}
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
          {xTicks.map((t) => (
            <text
              key={`xl${t}`}
              x={toSvgX(t)}
              y={PAD_T + innerH + 16}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-text-muted)"
            >
              {t}
            </text>
          ))}

          {/* 真の関数（青い破線） */}
          <path
            d={truePath}
            fill="none"
            stroke="var(--color-class-0)"
            strokeWidth={2}
            strokeDasharray="6 3"
            opacity={0.7}
          />

          {/* テストデータ点（灰色の四角） */}
          {testPts.map((p, i) => (
            <rect
              key={`tp${i}`}
              x={toSvgX(p.x) - 3.5}
              y={toSvgY(Math.max(Y_MIN, Math.min(Y_MAX, p.y))) - 3.5}
              width={7}
              height={7}
              fill="#888"
              opacity={0.7}
            />
          ))}

          {/* 訓練データ点（青い丸） */}
          {trainPts.map((p, i) => (
            <circle
              key={`trp${i}`}
              cx={toSvgX(p.x)}
              cy={toSvgY(Math.max(Y_MIN, Math.min(Y_MAX, p.y)))}
              r={4}
              fill="var(--color-class-0)"
              opacity={0.8}
            />
          ))}

          {/* フィット曲線（赤い実線） */}
          {fitPath && !fitError && (
            <path
              d={fitPath}
              fill="none"
              stroke="var(--color-incorrect)"
              strokeWidth={2}
            />
          )}

          {/* 凡例 */}
          <g transform={`translate(${PAD_L + 8}, ${PAD_T + 8})`}>
            <line x1={0} y1={6} x2={20} y2={6} stroke="var(--color-class-0)" strokeWidth={2} strokeDasharray="6 3" />
            <text x={24} y={10} fontSize={11} fill="var(--color-text-muted)">真の関数</text>
            <circle cx={10} cy={22} r={4} fill="var(--color-class-0)" opacity={0.8} />
            <text x={24} y={26} fontSize={11} fill="var(--color-text-muted)">訓練データ</text>
            <rect x={4} y={33} width={12} height={12} fill="#888" opacity={0.7} />
            <text x={24} y={42} fontSize={11} fill="var(--color-text-muted)">テストデータ</text>
            <line x1={0} y1={56} x2={20} y2={56} stroke="var(--color-incorrect)" strokeWidth={2} />
            <text x={24} y={60} fontSize={11} fill="var(--color-text-muted)">フィット曲線</text>
          </g>

          {/* エラーメッセージ */}
          {fitError && (
            <text
              x={width / 2}
              y={CHART_H / 2}
              textAnchor="middle"
              fontSize={12}
              fill="var(--color-incorrect)"
            >
              {fitError}
            </text>
          )}

          {/* 誤差表示エリア */}
          <g transform={`translate(0, ${CHART_H + 8})`}>
            {/* 訓練誤差 */}
            <rect x={PAD_L} y={0} width={72} height={40} fill="var(--color-accent-soft)" rx={4} />
            <text x={PAD_L + 36} y={14} textAnchor="middle" fontSize={10} fill="var(--color-accent)" fontWeight="bold">
              訓練 MSE
            </text>
            <text x={PAD_L + 36} y={30} textAnchor="middle" fontSize={13} fontWeight="bold" fill="var(--color-class-0)">
              {isNaN(trainMSE) ? "—" : trainMSE < 10 ? trainMSE.toFixed(3) : "∞"}
            </text>

            {/* テスト誤差 */}
            <rect x={PAD_L + 80} y={0} width={72} height={40} fill="#fff0e8" rx={4} />
            <text x={PAD_L + 80 + 36} y={14} textAnchor="middle" fontSize={10} fill="var(--color-class-1)" fontWeight="bold">
              テスト MSE
            </text>
            <text x={PAD_L + 80 + 36} y={30} textAnchor="middle" fontSize={13} fontWeight="bold" fill="var(--color-class-1)">
              {isNaN(testMSE) ? "—" : testMSE < 10 ? testMSE.toFixed(3) : "∞"}
            </text>

            {/* 次数表示 */}
            <text x={PAD_L + 180} y={24} fontSize={12} fill="var(--color-text-muted)">
              次数 {degree} · 訓練 {trainPts.length} 点 · テスト {testPts.length} 点
            </text>
          </g>
        </svg>
      </div>
    </PlaygroundFrame>
  );
}
