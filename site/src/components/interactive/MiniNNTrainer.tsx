// MiniNNTrainer（M4・Canvas）
// TensorFlow Playground 風のブラウザ内2D分類訓練場。データセット・隠れ層数・ノード数・
// 学習率η・活性化関数を選び、Run/Pause/Reset で訓練する。決定境界をリアルタイムに塗り、
// 損失曲線を並べて表示する。訓練は「1フレームあたりNステップ、描画は requestAnimationFrame」で
// 分離する（仕様 §3）。基盤の createMLP / trainStep / predict を使用。
import { useEffect, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import Slider from "../ui/Slider";
import { createMLP } from "../../lib/nn";
import { makeDataset } from "../../lib/datasets";
import type { Activation, Dataset2D, Dataset2DKind, MLP, MLPConfig } from "../../lib/types";

const SEED = 42;
const STEPS_PER_FRAME = 2; // 1描画あたりの訓練ステップ数
const DOMAIN = 1.15; // 座標範囲 [-1.15, 1.15]
const MAX_HIST = 240;

const DATASET_LABELS: Record<Dataset2DKind, string> = {
  circle: "同心円（circle）",
  xor: "XOR",
  gauss: "2つのガウス塊（gauss）",
  spiral: "渦巻き（spiral）",
};

function useContainerWidth(ref: React.RefObject<HTMLElement | null>, initial = 460) {
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.max(260, Math.floor(e.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export default function MiniNNTrainer() {
  const [datasetKind, setDatasetKind] = useState<Dataset2DKind>("circle");
  const [numLayers, setNumLayers] = useState(2);
  const [nodes, setNodes] = useState(6);
  const [lr, setLr] = useState(0.05);
  const [activation, setActivation] = useState<Activation>("tanh");
  const [running, setRunning] = useState(false);
  // 表示用（訓練ループから setState で更新）。
  const [epoch, setEpoch] = useState(0);
  const [loss, setLoss] = useState<number | null>(null);
  const [acc, setAcc] = useState<number | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const boundaryRef = useRef<HTMLCanvasElement>(null);
  const lossRef = useRef<HTMLCanvasElement>(null);
  const size = useContainerWidth(wrapRef, 460);
  const board = Math.min(460, size); // 決定境界は正方形

  // 訓練の可変状態は ref で持ち、描画ループから参照する。
  const dataRef = useRef<Dataset2D>(makeDataset("circle", { seed: SEED }));
  const configRef = useRef<MLPConfig | null>(null);
  const mlpRef = useRef<MLP | null>(null);
  const histRef = useRef<number[]>([]);
  const epochRef = useRef(0);
  const runningRef = useRef(running);
  runningRef.current = running;

  // アーキテクチャ／データセット／活性化が変わったら作り直す。
  useEffect(() => {
    dataRef.current = makeDataset(datasetKind, { n: 220, seed: SEED });
    const config: MLPConfig = {
      inputDim: 2,
      hiddenLayers: Array(numLayers).fill(nodes),
      outputDim: 1,
      activation,
      optimizer: "adam",
      learningRate: lr,
      seed: SEED,
    };
    configRef.current = config;
    mlpRef.current = createMLP(config);
    histRef.current = [];
    epochRef.current = 0;
    setEpoch(0);
    setLoss(null);
    setAcc(null);
    // 構成変更時はいったん止める。
    setRunning(false);
    // lr はここでは config に含めているので次の lr 用 effect は上書きしない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetKind, numLayers, nodes, activation]);

  // 学習率は作り直さずに反映（訓練を継続できる）。
  useEffect(() => {
    if (configRef.current) configRef.current.learningRate = lr;
  }, [lr]);

  function computeAccuracy(mlp: MLP, data: Dataset2D): number {
    let correct = 0;
    for (let i = 0; i < data.points.length; i++) {
      const p = mlp.predict(data.points[i])[0];
      const pred = p >= 0.5 ? 1 : 0;
      if (pred === data.labels[i]) correct++;
    }
    return correct / data.points.length;
  }

  // 描画＋訓練ループ。
  useEffect(() => {
    const canvas = boundaryRef.current;
    const lossCanvas = lossRef.current;
    if (!canvas || !lossCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(board * dpr);
    canvas.height = Math.round(board * dpr);
    const ctx = canvas.getContext("2d");
    const lossW = board;
    const lossH = 110;
    lossCanvas.width = Math.round(lossW * dpr);
    lossCanvas.height = Math.round(lossH * dpr);
    const lctx = lossCanvas.getContext("2d");
    if (!ctx || !lctx) return;

    const GRID = 46;
    const toPx = (v: number) => ((v + DOMAIN) / (2 * DOMAIN)) * board;
    const toPy = (v: number) => board - ((v + DOMAIN) / (2 * DOMAIN)) * board;

    let raf = 0;
    let frame = 0;
    const draw = () => {
      const mlp = mlpRef.current;
      const data = dataRef.current;

      // --- 訓練（Nステップ）。描画とは独立。 ---
      if (mlp && runningRef.current) {
        let last = 0;
        for (let s = 0; s < STEPS_PER_FRAME; s++) last = mlp.trainStep(data);
        epochRef.current += STEPS_PER_FRAME;
        histRef.current.push(last);
        if (histRef.current.length > MAX_HIST) histRef.current.shift();
        // 表示更新は数フレームに1回（再レンダを抑える）。
        if (frame % 6 === 0) {
          setEpoch(epochRef.current);
          setLoss(last);
          setAcc(computeAccuracy(mlp, data));
        }
      }

      // --- 決定境界の塗り ---
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, board, board);
      if (mlp) {
        const cell = board / GRID;
        for (let gy = 0; gy < GRID; gy++) {
          for (let gx = 0; gx < GRID; gx++) {
            const x = -DOMAIN + ((gx + 0.5) / GRID) * (2 * DOMAIN);
            const y = DOMAIN - ((gy + 0.5) / GRID) * (2 * DOMAIN);
            const p = mlp.predict([x, y])[0]; // クラス1の確率
            // クラス0=青, クラス1=橙。境界付近は淡く。
            const strength = Math.min(1, Math.abs(p - 0.5) * 2) * 0.5;
            let cr: number;
            let cg: number;
            let cb: number;
            if (p >= 0.5) {
              cr = 234;
              cg = 88;
              cb = 12;
            } else {
              cr = 37;
              cg = 99;
              cb = 235;
            }
            const r = Math.round(255 + (cr - 255) * strength);
            const g = Math.round(255 + (cg - 255) * strength);
            const b = Math.round(255 + (cb - 255) * strength);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(gx * cell, gy * cell, cell + 1, cell + 1);
          }
        }
      }

      // --- データ点 ---
      for (let i = 0; i < data.points.length; i++) {
        const [x, y] = data.points[i];
        ctx.beginPath();
        ctx.arc(toPx(x), toPy(y), 3.2, 0, Math.PI * 2);
        ctx.fillStyle = data.labels[i] === 1 ? "#c2410c" : "#1e40af";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.stroke();
      }

      // --- 損失曲線 ---
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.clearRect(0, 0, lossW, lossH);
      lctx.fillStyle = "var(--color-surface)";
      const hist = histRef.current;
      if (hist.length > 1) {
        let hi = 0;
        for (const v of hist) if (v > hi) hi = v;
        hi = hi || 1;
        lctx.strokeStyle = "#2563eb";
        lctx.lineWidth = 2;
        lctx.beginPath();
        for (let i = 0; i < hist.length; i++) {
          const px = (i / (MAX_HIST - 1)) * lossW;
          const py = lossH - 6 - (hist[i] / hi) * (lossH - 14);
          if (i === 0) lctx.moveTo(px, py);
          else lctx.lineTo(px, py);
        }
        lctx.stroke();
      }
      // 枠線
      lctx.strokeStyle = "var(--color-border)";
      lctx.lineWidth = 1;
      lctx.strokeRect(0.5, 0.5, lossW - 1, lossH - 1);

      frame++;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [board]);

  const handleReset = () => {
    setDatasetKind("circle");
    setNumLayers(2);
    setNodes(6);
    setLr(0.05);
    setActivation("tanh");
    setRunning(false);
    // 上の effect が構成変更で作り直すが、同じ値なら発火しないので明示的に初期化。
    dataRef.current = makeDataset("circle", { n: 220, seed: SEED });
    const config: MLPConfig = {
      inputDim: 2,
      hiddenLayers: [6, 6],
      outputDim: 1,
      activation: "tanh",
      optimizer: "adam",
      learningRate: 0.05,
      seed: SEED,
    };
    configRef.current = config;
    mlpRef.current = createMLP(config);
    histRef.current = [];
    epochRef.current = 0;
    setEpoch(0);
    setLoss(null);
    setAcc(null);
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
      title="ミニNN訓練場（ブラウザ内で学習）"
      guide={
        <>
          「渦巻き」を選び、隠れ層を1にすると学習しきれないことを確かめよう。／
          層数とノード数を増やしてから Run を押し、決定境界がデータに沿っていく様子を見てみよう。
        </>
      }
      onReset={handleReset}
      controls={
        <>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>データセット</span>
            <select
              style={selectStyle}
              value={datasetKind}
              onChange={(e) => setDatasetKind(e.target.value as Dataset2DKind)}
            >
              {(Object.keys(DATASET_LABELS) as Dataset2DKind[]).map((k) => (
                <option key={k} value={k}>
                  {DATASET_LABELS[k]}
                </option>
              ))}
            </select>
          </label>

          <Slider
            label="隠れ層の数"
            value={numLayers}
            min={1}
            max={3}
            step={1}
            unit="層"
            onChange={setNumLayers}
          />
          <Slider
            label="1層あたりのノード数"
            value={nodes}
            min={1}
            max={8}
            step={1}
            unit="個"
            onChange={setNodes}
          />
          <Slider
            label="学習率 η"
            value={lr}
            min={0.005}
            max={0.3}
            step={0.005}
            format={(v) => v.toFixed(3)}
            onChange={setLr}
          />

          <label style={{ display: "block", margin: "12px 0" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>活性化関数</span>
            <select
              style={selectStyle}
              value={activation}
              onChange={(e) => setActivation(e.target.value as Activation)}
            >
              <option value="tanh">tanh</option>
              <option value="relu">ReLU</option>
            </select>
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={running ? "btn" : "btn btn-accent"}
              onClick={() => setRunning((r) => !r)}
            >
              {running ? "⏸ Pause" : "▶ Run"}
            </button>
            <button type="button" className="btn" onClick={handleReset}>
              ↺ Reset
            </button>
          </div>

          <div
            style={{
              marginTop: 12,
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
              lineHeight: 1.7,
            }}
          >
            エポック: <strong>{epoch}</strong>
            <br />
            損失: <strong>{loss === null ? "—" : loss.toFixed(4)}</strong>
            <br />
            正解率: <strong>{acc === null ? "—" : `${(acc * 100).toFixed(1)}%`}</strong>
          </div>
        </>
      }
    >
      <div ref={wrapRef} style={{ width: "100%" }}>
        <canvas
          ref={boundaryRef}
          style={{
            width: board,
            height: board,
            maxWidth: "100%",
            display: "block",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: "#fff",
          }}
          aria-label="決定境界（青=クラス0 / 橙=クラス1）"
        />
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: "8px 0 4px" }}>
          損失曲線（訓練が進むと下がる）
        </div>
        <canvas
          ref={lossRef}
          style={{
            width: board,
            height: 110,
            maxWidth: "100%",
            display: "block",
            borderRadius: 8,
          }}
          aria-label="損失曲線"
        />
      </div>
    </PlaygroundFrame>
  );
}
