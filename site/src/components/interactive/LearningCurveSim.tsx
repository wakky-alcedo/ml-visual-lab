// LearningCurveSim（M5・SVG）
// 過学習の学習曲線を「合成」して見せるシミュレータ。本物の訓練ではなく、データ量・
// モデル容量・Dropout率・データ拡張ON/OFF から train/val 曲線の形を数式で合成する。
// 定性的挙動を正しく再現する: データ少＋容量大 → 乖離大、Dropout/拡張 → 乖離縮小・収束遅め。
import { useEffect, useMemo, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import Slider from "../ui/Slider";

const N = 80; // エポック方向のサンプル数

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

interface Curves {
  train: number[];
  val: number[];
  bestEpoch: number; // val 最小のインデックス
  gap: number; // 最終エポックでの train/val 乖離
}

/** パラメータから train/val 曲線を合成する。 */
function synthesize(data: number, capacity: number, dropout: number, augment: boolean): Curves {
  // 正則化の総量（Dropout ＋ データ拡張）。乖離を縮め、収束を遅らせる。
  const reg = dropout + (augment ? 0.25 : 0);
  // データ量の効き（多いほど過学習しにくい）。
  const df = Math.sqrt(data / 60);

  // train の到達床: 容量が大きいほど低く（暗記できる）、正則化が強いほど上がる。
  const trainFloor = 0.02 + 0.3 * reg + 0.5 / (capacity + 0.5);
  // 収束速度: 容量が大きいほど速く、正則化が強いほど遅い。
  const speed = (1.8 + capacity * 0.45) * (1 - 0.5 * Math.min(reg, 0.9));

  // 汎化ギャップ: 容量大・データ少で拡大、正則化で縮小。
  const gapMax = Math.max(
    0,
    (capacity * 0.3) / df * (1 - 0.85 * Math.min(reg, 1)) - 0.02,
  );
  const gapFloor = 0.03 + 0.14 / df;

  const start = 1.0;
  const train: number[] = [];
  const val: number[] = [];
  let bestEpoch = 0;
  let bestVal = Infinity;

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const tr = trainFloor + (start - trainFloor) * Math.exp(-t * speed);
    // val は train にギャップを足したもの。ギャップはエポックとともに拡大（過学習の蓄積）。
    const gap = gapFloor + gapMax * Math.pow(t, 1.25);
    const va = Math.min(1.25, tr + gap);
    train.push(tr);
    val.push(va);
    if (va < bestVal) {
      bestVal = va;
      bestEpoch = i;
    }
  }
  return { train, val, bestEpoch, gap: val[N - 1] - train[N - 1] };
}

export default function LearningCurveSim() {
  const [data, setData] = useState(80);
  const [capacity, setCapacity] = useState(7);
  const [dropout, setDropout] = useState(0);
  const [augment, setAugment] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const W = useContainerWidth(wrapRef, 640);
  const H = Math.round(Math.min(380, Math.max(260, W * 0.56)));

  const curves = useMemo(
    () => synthesize(data, capacity, dropout, augment),
    [data, capacity, dropout, augment],
  );

  // 描画レイアウト。
  const padL = 48;
  const padR = 16;
  const padT = 20;
  const padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const yMax = 1.25;
  const xOf = (i: number) => padL + (i / (N - 1)) * plotW;
  const yOf = (v: number) => padT + (1 - v / yMax) * plotH;

  const toPath = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");

  const gapArea =
    toPath(curves.val) +
    " L" +
    xOf(N - 1).toFixed(1) +
    "," +
    yOf(curves.train[N - 1]).toFixed(1) +
    " " +
    curves.train
      .map((v, i) => `L${xOf(N - 1 - i).toFixed(1)},${yOf(curves.train[N - 1 - i]).toFixed(1)}`)
      .join(" ") +
    " Z";

  const gapLevel =
    curves.gap < 0.08 ? "小さい（良い汎化）" : curves.gap < 0.25 ? "中くらい" : "大きい（過学習）";
  const gapColor =
    curves.gap < 0.08
      ? "var(--color-correct)"
      : curves.gap < 0.25
        ? "#b45309"
        : "var(--color-incorrect)";

  const handleReset = () => {
    setData(80);
    setCapacity(7);
    setDropout(0);
    setAugment(false);
  };

  return (
    <PlaygroundFrame
      title="学習曲線シミュレータ"
      guide={
        <>
          データ量を最小・容量を最大にして、train と val が大きく乖離（＝過学習）する様子を見よう。／
          そこから Dropout を上げ、データ拡張をONにして乖離が縮む代わりに収束が遅くなるのを確かめよう。
        </>
      }
      onReset={handleReset}
      controls={
        <>
          <Slider
            label="データ量"
            value={data}
            min={20}
            max={1000}
            step={20}
            unit="件"
            onChange={setData}
          />
          <Slider
            label="モデル容量"
            value={capacity}
            min={1}
            max={10}
            step={1}
            onChange={setCapacity}
          />
          <Slider
            label="Dropout率"
            value={dropout}
            min={0}
            max={0.7}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={setDropout}
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              margin: "12px 0",
              fontSize: "var(--text-sm)",
            }}
          >
            <input
              type="checkbox"
              checked={augment}
              onChange={(e) => setAugment(e.target.checked)}
            />
            データ拡張（Data Augmentation）
          </label>

          <div style={{ fontSize: "var(--text-sm)", lineHeight: 1.7 }}>
            汎化ギャップ:{" "}
            <strong style={{ color: gapColor }}>
              {curves.gap.toFixed(3)}（{gapLevel}）
            </strong>
            <br />
            <span style={{ color: "var(--color-text-muted)" }}>
              縦の破線は val 損失が最小になるエポック（早期終了の目安）。
            </span>
          </div>
        </>
      }
    >
      <div ref={wrapRef} style={{ width: "100%" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          role="img"
          aria-label="train/val 学習曲線"
          style={{ display: "block", background: "var(--color-surface)", borderRadius: 8 }}
        >
          {/* 目盛グリッド */}
          {[0, 0.25, 0.5, 0.75, 1.0, 1.25].map((v) => (
            <g key={v}>
              <line
                x1={padL}
                x2={W - padR}
                y1={yOf(v)}
                y2={yOf(v)}
                stroke="var(--color-grid)"
                strokeWidth={1}
              />
              <text x={padL - 6} y={yOf(v) + 4} textAnchor="end" fontSize={11} fill="var(--color-text-muted)">
                {v.toFixed(2)}
              </text>
            </g>
          ))}
          {/* 乖離の塗り */}
          <path d={gapArea} fill="rgba(234,88,12,0.12)" stroke="none" />
          {/* 早期終了マーカー */}
          <line
            x1={xOf(curves.bestEpoch)}
            x2={xOf(curves.bestEpoch)}
            y1={padT}
            y2={padT + plotH}
            stroke="var(--color-text-muted)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          {/* 曲線 */}
          <path d={toPath(curves.train)} fill="none" stroke="#2563eb" strokeWidth={2.5} />
          <path d={toPath(curves.val)} fill="none" stroke="#ea580c" strokeWidth={2.5} />
          {/* 軸ラベル */}
          <text x={padL + plotW / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--color-text-muted)">
            エポック →
          </text>
          <text
            x={14}
            y={padT + plotH / 2}
            textAnchor="middle"
            fontSize={12}
            fill="var(--color-text-muted)"
            transform={`rotate(-90 14 ${padT + plotH / 2})`}
          >
            損失
          </text>
          {/* 凡例 */}
          <g transform={`translate(${W - padR - 150}, ${padT + 6})`}>
            <rect x={0} y={0} width={148} height={44} rx={6} fill="var(--color-bg)" stroke="var(--color-border)" />
            <line x1={10} x2={30} y1={15} y2={15} stroke="#2563eb" strokeWidth={2.5} />
            <text x={36} y={19} fontSize={12} fill="var(--color-text)">
              train（訓練）
            </text>
            <line x1={10} x2={30} y1={33} y2={33} stroke="#ea580c" strokeWidth={2.5} />
            <text x={36} y={37} fontSize={12} fill="var(--color-text)">
              val（検証）
            </text>
          </g>
        </svg>
      </div>
    </PlaygroundFrame>
  );
}
