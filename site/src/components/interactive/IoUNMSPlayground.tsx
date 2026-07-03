// IoUNMSPlayground（M7・SVG）
// IoU/NMS を操作で体感するプレイグラウンド。
// IoUモード: 2つのボックスをドラッグ＆リサイズ → 交差面積・和集合面積・IoU値をリアルタイム表示。
// NMSモード: 重なった候補ボックス群（スコア付き）＋IoU閾値スライダー → NMSステップ実行で除去過程を可視化。
import { useCallback, useEffect, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import Slider from "../ui/Slider";
import {
  computeIoU,
  intersectionArea,
  intersectionRect,
  nmsSteps,
  unionArea,
  type BBox,
} from "../../lib/iou";

// ────────────────────────────────────────────────────────────────
// SVG の論理座標系（viewBox）
// ────────────────────────────────────────────────────────────────
const VB_W = 580;
const VB_H = 340;

// ドラッグのハンドル種別
type HandleKind = "move" | "tl" | "tr" | "bl" | "br";
const HANDLE_R = 6; // ハンドル円半径
const MIN_BOX_SIZE = 20;

// ────────────────────────────────────────────────────────────────
// IoU モードの初期ボックス
// ────────────────────────────────────────────────────────────────
const IOU_INIT: [BBox, BBox] = [
  [80, 80, 300, 260],
  [200, 120, 460, 300],
];

// ────────────────────────────────────────────────────────────────
// NMS モードの初期データ
// ────────────────────────────────────────────────────────────────
const NMS_INIT_BOXES: BBox[] = [
  [50, 50, 230, 210], // score 0.92
  [70, 65, 250, 220], // score 0.78
  [85, 55, 240, 215], // score 0.65
  [290, 60, 470, 230], // score 0.88
  [305, 70, 490, 245], // score 0.61
  [150, 160, 380, 310], // score 0.55
];
const NMS_SCORES = [0.92, 0.78, 0.65, 0.88, 0.61, 0.55];
const NMS_BOX_COLORS = ["#e53e3e", "#ea580c", "#ca8a04", "#16a34a", "#2563eb", "#7c3aed"];

// ────────────────────────────────────────────────────────────────
// ResizeObserver フック
// ────────────────────────────────────────────────────────────────
function useContainerWidth(ref: React.RefObject<HTMLElement | null>, initial = 560) {
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

// SVG 上のクライアント座標 → viewBox 論理座標
function clientToVB(
  e: { clientX: number; clientY: number },
  svgEl: SVGSVGElement,
  cssW: number,
): { x: number; y: number } {
  const rect = svgEl.getBoundingClientRect();
  const scale = VB_W / (rect.width || cssW);
  return {
    x: (e.clientX - rect.left) * scale,
    y: (e.clientY - rect.top) * scale * (VB_H / VB_W) * (rect.width / (rect.height || 1)),
  };
}

// ────────────────────────────────────────────────────────────────
// ボックスを描く共通コンポーネント（IoU モード用）
// ────────────────────────────────────────────────────────────────
interface DraggableBoxProps {
  box: BBox;
  color: string;
  label: string;
  onMouseDownMove: (e: React.MouseEvent) => void;
  onMouseDownHandle: (e: React.MouseEvent, kind: HandleKind) => void;
}

function DraggableBox({ box, color, label, onMouseDownMove, onMouseDownHandle }: DraggableBoxProps) {
  const [x1, y1, x2, y2] = box;
  const handles: { x: number; y: number; kind: HandleKind }[] = [
    { x: x1, y: y1, kind: "tl" },
    { x: x2, y: y1, kind: "tr" },
    { x: x1, y: y2, kind: "bl" },
    { x: x2, y: y2, kind: "br" },
  ];
  return (
    <g>
      {/* ボックス本体（ドラッグ移動） */}
      <rect
        x={x1}
        y={y1}
        width={x2 - x1}
        height={y2 - y1}
        fill={`${color}22`}
        stroke={color}
        strokeWidth={2.5}
        rx={3}
        style={{ cursor: "move" }}
        onMouseDown={onMouseDownMove}
      />
      {/* ラベル */}
      <text x={(x1 + x2) / 2} y={y1 - 6} textAnchor="middle" fontSize={13} fill={color} fontWeight={700}>
        {label}
      </text>
      {/* コーナーハンドル */}
      {handles.map((h) => (
        <circle
          key={h.kind}
          cx={h.x}
          cy={h.y}
          r={HANDLE_R}
          fill={color}
          stroke="#fff"
          strokeWidth={1.5}
          style={{ cursor: h.kind === "tl" || h.kind === "br" ? "nwse-resize" : "nesw-resize" }}
          onMouseDown={(e) => onMouseDownHandle(e, h.kind)}
        />
      ))}
    </g>
  );
}

// ────────────────────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────────────────────
export default function IoUNMSPlayground() {
  const [mode, setMode] = useState<"iou" | "nms">("iou");

  // IoU モードの状態
  const [iouBoxes, setIouBoxes] = useState<[BBox, BBox]>([...IOU_INIT]);

  // NMS モードの状態
  const [iouThreshold, setIouThreshold] = useState(0.5);
  const [nmsStep, setNmsStep] = useState(-1); // -1: 未実行、>=0: ステップ番号

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cssW = useContainerWidth(wrapRef, 560);
  const cssH = Math.round(cssW * (VB_H / VB_W));

  // ────────────────────────────────
  // IoU モードのドラッグロジック
  // ────────────────────────────────
  const draggingRef = useRef<{
    boxIdx: 0 | 1;
    handle: HandleKind;
    startMouseVB: { x: number; y: number };
    origBox: BBox;
  } | null>(null);

  const startDrag = useCallback(
    (
      e: React.MouseEvent,
      boxIdx: 0 | 1,
      handle: HandleKind,
    ) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const pos = clientToVB(e, svg, cssW);
      draggingRef.current = {
        boxIdx,
        handle,
        startMouseVB: pos,
        origBox: [...iouBoxes[boxIdx]] as BBox,
      };
    },
    [iouBoxes, cssW],
  );

  useEffect(() => {
    if (mode !== "iou") return;

    const onMouseMove = (e: MouseEvent) => {
      const d = draggingRef.current;
      const svg = svgRef.current;
      if (!d || !svg) return;

      const pos = clientToVB(e, svg, cssW);
      const dx = pos.x - d.startMouseVB.x;
      const dy = pos.y - d.startMouseVB.y;
      const [ox1, oy1, ox2, oy2] = d.origBox;

      let newBox: BBox;
      if (d.handle === "move") {
        newBox = [
          Math.max(0, ox1 + dx),
          Math.max(0, oy1 + dy),
          Math.min(VB_W, ox2 + dx),
          Math.min(VB_H, oy2 + dy),
        ];
      } else {
        let [nx1, ny1, nx2, ny2] = [ox1, oy1, ox2, oy2];
        if (d.handle === "tl" || d.handle === "bl") nx1 = Math.max(0, Math.min(ox2 - MIN_BOX_SIZE, ox1 + dx));
        if (d.handle === "tr" || d.handle === "br") nx2 = Math.min(VB_W, Math.max(ox1 + MIN_BOX_SIZE, ox2 + dx));
        if (d.handle === "tl" || d.handle === "tr") ny1 = Math.max(0, Math.min(oy2 - MIN_BOX_SIZE, oy1 + dy));
        if (d.handle === "bl" || d.handle === "br") ny2 = Math.min(VB_H, Math.max(oy1 + MIN_BOX_SIZE, oy2 + dy));
        newBox = [nx1, ny1, nx2, ny2];
      }

      setIouBoxes((prev) => {
        const next: [BBox, BBox] = [prev[0], prev[1]];
        next[d.boxIdx] = newBox;
        return next;
      });
    };

    const onMouseUp = () => {
      draggingRef.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [mode, cssW]);

  // ────────────────────────────────
  // IoU 計算
  // ────────────────────────────────
  const iouValue = computeIoU(iouBoxes[0], iouBoxes[1]);
  const interArea = intersectionArea(iouBoxes[0], iouBoxes[1]);
  const uniArea = unionArea(iouBoxes[0], iouBoxes[1]);
  const interRect = intersectionRect(iouBoxes[0], iouBoxes[1]);

  // ────────────────────────────────
  // NMS 計算
  // ────────────────────────────────
  const steps = nmsSteps(NMS_INIT_BOXES, NMS_SCORES, iouThreshold);

  // nmsStep === -1: 全部 alive
  // nmsStep >= 0: ステップ 0..nmsStep まで実行済み
  const keptSet = new Set<number>();
  const suppressedSet = new Set<number>();
  for (let s = 0; s <= nmsStep && s < steps.length; s++) {
    keptSet.add(steps[s].pivot);
    for (const j of steps[s].suppressed) suppressedSet.add(j);
  }

  const handleReset = () => {
    setMode("iou");
    setIouBoxes([...IOU_INIT] as [BBox, BBox]);
    setIouThreshold(0.5);
    setNmsStep(-1);
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
      title="IoU / NMS プレイグラウンド"
      guide={
        <>
          IoUモード: ボックスをドラッグ・コーナーをリサイズして、重なり方とIoU値の関係を体感しよう。半分重ねたときの値が意外と小さいことに気づくはず。／
          NMSモード: しきい値を変えてから「次のステップ」を押して、最高スコアのボックスが残り、重なりすぎる候補が除去される流れを追ってみよう。
        </>
      }
      onReset={handleReset}
      controls={
        <>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>モード</span>
            <select
              style={selectStyle}
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as "iou" | "nms");
                setNmsStep(-1);
              }}
            >
              <option value="iou">IoU モード（ボックスをドラッグ）</option>
              <option value="nms">NMS モード（ステップ実行）</option>
            </select>
          </label>

          {mode === "iou" && (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--color-surface)",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                fontSize: "var(--text-sm)",
                lineHeight: 2.0,
              }}
            >
              <div>
                <span style={{ color: "#2563eb", fontWeight: 700 }}>ボックスA</span>{" "}
                面積: {Math.round((iouBoxes[0][2] - iouBoxes[0][0]) * (iouBoxes[0][3] - iouBoxes[0][1]))}
              </div>
              <div>
                <span style={{ color: "#ea580c", fontWeight: 700 }}>ボックスB</span>{" "}
                面積: {Math.round((iouBoxes[1][2] - iouBoxes[1][0]) * (iouBoxes[1][3] - iouBoxes[1][1]))}
              </div>
              <div>
                交差面積（Intersection）: <strong>{Math.round(interArea)}</strong>
              </div>
              <div>
                和集合面積（Union）: <strong>{Math.round(uniArea)}</strong>
              </div>
              <div style={{ fontSize: "1.1em", marginTop: 4 }}>
                <strong style={{ color: iouValue >= 0.5 ? "#16a34a" : "#dc2626" }}>
                  IoU = {iouValue.toFixed(3)}
                </strong>
                {iouValue >= 0.5 && (
                  <span style={{ color: "#16a34a", marginLeft: 8 }}>✓ 0.5以上（検出成功の目安）</span>
                )}
              </div>
              <div style={{ color: "var(--color-text-muted)", marginTop: 4, fontSize: 11 }}>
                ヒント: 図のコーナーをドラッグしてリサイズ、内部をドラッグして移動できます。
              </div>
            </div>
          )}

          {mode === "nms" && (
            <>
              <Slider
                label="IoU しきい値"
                value={iouThreshold}
                min={0.1}
                max={0.9}
                step={0.05}
                format={(v) => v.toFixed(2)}
                onChange={(v) => {
                  setIouThreshold(v);
                  setNmsStep(-1);
                }}
              />
              <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setNmsStep((s) => Math.min(s + 1, steps.length - 1))}
                  disabled={nmsStep >= steps.length - 1}
                >
                  次のステップ →
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setNmsStep(-1)}
                >
                  最初から
                </button>
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  background: "var(--color-surface)",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  fontSize: "var(--text-sm)",
                  lineHeight: 1.8,
                }}
              >
                {nmsStep === -1 ? (
                  <span style={{ color: "var(--color-text-muted)" }}>
                    「次のステップ」を押してNMSを実行してください。
                    <br />
                    しきい値 {iouThreshold.toFixed(2)} 以上で重なるボックスを除去します。
                  </span>
                ) : (
                  <>
                    <strong>ステップ {nmsStep + 1} / {steps.length}</strong>
                    <br />
                    採用（pivot）:{" "}
                    <span style={{ color: NMS_BOX_COLORS[steps[nmsStep].pivot], fontWeight: 700 }}>
                      ボックス{steps[nmsStep].pivot + 1}（スコア {NMS_SCORES[steps[nmsStep].pivot].toFixed(2)}）
                    </span>
                    <br />
                    このステップで除去:{" "}
                    {steps[nmsStep].suppressed.length === 0 ? (
                      <span style={{ color: "var(--color-text-muted)" }}>なし</span>
                    ) : (
                      steps[nmsStep].suppressed.map((j) => (
                        <span key={j} style={{ color: NMS_BOX_COLORS[j], fontWeight: 700, marginRight: 6 }}>
                          ボックス{j + 1}
                        </span>
                      ))
                    )}
                    <br />
                    <span style={{ color: "var(--color-text-muted)" }}>
                      残り: {NMS_INIT_BOXES.length - suppressedSet.size} ボックス
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </>
      }
    >
      <div ref={wrapRef} style={{ width: "100%" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          width="100%"
          height={cssH}
          style={{
            display: "block",
            background: "var(--color-surface)",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            userSelect: "none",
          }}
          aria-label="IoU / NMS の可視化"
        >
          {/* ──── IoU モード ──── */}
          {mode === "iou" && (
            <>
              {/* 交差領域の塗り */}
              {interRect && (
                <rect
                  x={interRect[0]}
                  y={interRect[1]}
                  width={interRect[2] - interRect[0]}
                  height={interRect[3] - interRect[1]}
                  fill="rgba(250,204,21,0.55)"
                  stroke="#ca8a04"
                  strokeWidth={1.5}
                  rx={2}
                />
              )}

              {/* ボックス A */}
              <DraggableBox
                box={iouBoxes[0]}
                color="#2563eb"
                label="A"
                onMouseDownMove={(e) => startDrag(e, 0, "move")}
                onMouseDownHandle={(e, k) => startDrag(e, 0, k)}
              />

              {/* ボックス B */}
              <DraggableBox
                box={iouBoxes[1]}
                color="#ea580c"
                label="B"
                onMouseDownMove={(e) => startDrag(e, 1, "move")}
                onMouseDownHandle={(e, k) => startDrag(e, 1, k)}
              />

              {/* IoU ラベル */}
              <rect x={VB_W / 2 - 80} y={VB_H - 40} width={160} height={30} rx={8} fill="var(--color-bg, #fff)" stroke="var(--color-border)" />
              <text x={VB_W / 2} y={VB_H - 20} textAnchor="middle" fontSize={14} fontWeight={700} fill={iouValue >= 0.5 ? "#16a34a" : "#dc2626"}>
                IoU = {iouValue.toFixed(3)}
              </text>

              {/* 交差領域ラベル */}
              {interRect && (
                <text
                  x={(interRect[0] + interRect[2]) / 2}
                  y={(interRect[1] + interRect[3]) / 2 + 5}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#92400e"
                  fontWeight={600}
                >
                  Intersection
                </text>
              )}
            </>
          )}

          {/* ──── NMS モード ──── */}
          {mode === "nms" && (
            <>
              {NMS_INIT_BOXES.map((box, i) => {
                const [x1, y1, x2, y2] = box;
                const isKept = keptSet.has(i);
                const isSuppressed = suppressedSet.has(i);
                const isPivot = nmsStep >= 0 && steps[nmsStep]?.pivot === i;
                const isJustSuppressed = nmsStep >= 0 && steps[nmsStep]?.suppressed.includes(i);
                const color = NMS_BOX_COLORS[i];

                let opacity = 1;
                let strokeW = 2;
                let fillAlpha = "22";
                let textDecoration = "";
                if (isSuppressed) {
                  opacity = 0.25;
                  textDecoration = "line-through";
                }
                if (isPivot) {
                  strokeW = 3.5;
                  fillAlpha = "44";
                }
                if (isJustSuppressed) {
                  opacity = 0.4;
                }

                return (
                  <g key={i} opacity={opacity}>
                    <rect
                      x={x1}
                      y={y1}
                      width={x2 - x1}
                      height={y2 - y1}
                      fill={`${color}${fillAlpha}`}
                      stroke={color}
                      strokeWidth={strokeW}
                      rx={3}
                      strokeDasharray={isSuppressed ? "6 4" : undefined}
                    />
                    {/* スコアラベル */}
                    <rect x={x1} y={y1 - 22} width={68} height={18} rx={4} fill={color} />
                    <text
                      x={x1 + 34}
                      y={y1 - 9}
                      textAnchor="middle"
                      fontSize={11}
                      fill="#fff"
                      fontWeight={700}
                    >
                      {isSuppressed ? "×除去" : `スコア ${NMS_SCORES[i].toFixed(2)}`}
                    </text>
                    {/* pivot 表示 */}
                    {isPivot && (
                      <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 5} textAnchor="middle" fontSize={12} fill={color} fontWeight={700}>
                        ★採用
                      </text>
                    )}
                  </g>
                );
              })}

              {/* 完了メッセージ */}
              {nmsStep >= steps.length - 1 && (
                <g>
                  <rect x={VB_W / 2 - 100} y={VB_H - 46} width={200} height={36} rx={8} fill="#dcfce7" stroke="#16a34a" strokeWidth={1.5} />
                  <text x={VB_W / 2} y={VB_H - 24} textAnchor="middle" fontSize={13} fill="#14532d" fontWeight={700}>
                    NMS 完了 — {keptSet.size}ボックス残存
                  </text>
                </g>
              )}
            </>
          )}
        </svg>
      </div>
    </PlaygroundFrame>
  );
}
