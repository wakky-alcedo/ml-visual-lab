// AugmentPreview（M5・Canvas）
// データ拡張（Data Augmentation）のプレビュー。flip / crop / erase / 明度 のトグルを選び、
// サンプル画像（imageSrc 未指定時はプロシージャル生成画像）にランダム適用した例を 3×3 グリッドで
// 表示する。「1枚が何枚分になるか」の組合せ数も示し、再生成ボタンで別の乱数例に差し替える。
import { useEffect, useMemo, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import { mulberry32, DEFAULT_SEED } from "../../lib/rng";
import type { AugmentPreviewProps } from "../../lib/types";

// 各拡張が生み出すおおよその「バリエーション数」（教材用の目安）。
const FACTOR = { flip: 2, crop: 9, erase: 16, brightness: 5 } as const;
const BASE_SIZE = 132;

function useContainerWidth(ref: React.RefObject<HTMLElement | null>, initial = 380) {
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.max(240, Math.floor(e.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** サンプル画像をプロシージャル生成（非対称にして flip/crop が分かるようにする）。 */
function drawProcedural(ctx: CanvasRenderingContext2D, s: number) {
  // 空
  const sky = ctx.createLinearGradient(0, 0, 0, s);
  sky.addColorStop(0, "#7ec8f5");
  sky.addColorStop(1, "#dff1fb");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, s, s);
  // 太陽（左上・非対称）
  ctx.fillStyle = "#fcd34d";
  ctx.beginPath();
  ctx.arc(s * 0.24, s * 0.24, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // 地面
  ctx.fillStyle = "#6bbf59";
  ctx.fillRect(0, s * 0.66, s, s * 0.34);
  // 山（三角形・中央右）
  ctx.fillStyle = "#c2683c";
  ctx.beginPath();
  ctx.moveTo(s * 0.62, s * 0.66);
  ctx.lineTo(s * 0.82, s * 0.28);
  ctx.lineTo(s * 0.98, s * 0.66);
  ctx.closePath();
  ctx.fill();
  // 家（青い四角・左下）
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(s * 0.14, s * 0.52, s * 0.16, s * 0.14);
  ctx.fillStyle = "#b91c1c";
  ctx.beginPath();
  ctx.moveTo(s * 0.12, s * 0.52);
  ctx.lineTo(s * 0.22, s * 0.43);
  ctx.lineTo(s * 0.32, s * 0.52);
  ctx.closePath();
  ctx.fill();
}

export default function AugmentPreview({ imageSrc }: AugmentPreviewProps) {
  const [flip, setFlip] = useState(true);
  const [crop, setCrop] = useState(true);
  const [erase, setErase] = useState(false);
  const [brightness, setBrightness] = useState(true);
  const [regen, setRegen] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const width = useContainerWidth(wrapRef, 380);
  const board = Math.min(384, width);

  // ベース画像を用意（imageSrc があれば読み込み、なければプロシージャル生成）。
  useEffect(() => {
    const base = document.createElement("canvas");
    base.width = BASE_SIZE;
    base.height = BASE_SIZE;
    const bctx = base.getContext("2d");
    if (!bctx) return;
    if (imageSrc) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        bctx.drawImage(img, 0, 0, BASE_SIZE, BASE_SIZE);
        baseRef.current = base;
        setReady(true);
      };
      img.onerror = () => {
        drawProcedural(bctx, BASE_SIZE);
        baseRef.current = base;
        setReady(true);
      };
      img.src = imageSrc;
    } else {
      drawProcedural(bctx, BASE_SIZE);
      baseRef.current = base;
      setReady(true);
    }
  }, [imageSrc]);

  // 組合せ数の計算。
  const combo = useMemo(() => {
    const parts: Array<{ label: string; n: number }> = [];
    if (flip) parts.push({ label: "反転", n: FACTOR.flip });
    if (crop) parts.push({ label: "切り出し", n: FACTOR.crop });
    if (erase) parts.push({ label: "消去", n: FACTOR.erase });
    if (brightness) parts.push({ label: "明度", n: FACTOR.brightness });
    const total = parts.reduce((p, x) => p * x.n, 1);
    return { parts, total };
  }, [flip, crop, erase, brightness]);

  // 3×3 グリッド描画。
  useEffect(() => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base || !ready) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(board * dpr);
    canvas.height = Math.round(board * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, board, board);

    const gap = 4;
    const cell = (board - gap * 2) / 3;
    const rng = mulberry32(DEFAULT_SEED + regen * 101);

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cx = c * (cell + gap);
        const cy = r * (cell + gap);
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx, cy, cell, cell);
        ctx.clip();
        ctx.translate(cx, cy);

        // crop（ランダムな部分を切り出して拡大）。
        let sx = 0;
        let sy = 0;
        let sw = BASE_SIZE;
        let sh = BASE_SIZE;
        if (crop) {
          const frac = rng.uniform(0.6, 0.85);
          sw = BASE_SIZE * frac;
          sh = BASE_SIZE * frac;
          sx = rng.uniform(0, BASE_SIZE - sw);
          sy = rng.uniform(0, BASE_SIZE - sh);
        }
        // 明度
        if (brightness) {
          const b = rng.uniform(0.6, 1.5);
          ctx.filter = `brightness(${b.toFixed(2)})`;
        }
        // flip（水平反転）
        const doFlip = flip && rng.next() < 0.5;
        if (doFlip) {
          ctx.translate(cell, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(base, sx, sy, sw, sh, 0, 0, cell, cell);
        ctx.filter = "none";

        // erase（ランダムな矩形を消す）
        if (erase) {
          const ew = cell * rng.uniform(0.2, 0.4);
          const eh = cell * rng.uniform(0.2, 0.4);
          const ex = rng.uniform(0, cell - ew);
          const ey = rng.uniform(0, cell - eh);
          ctx.fillStyle = "#5b636d";
          ctx.fillRect(ex, ey, ew, eh);
        }
        ctx.restore();

        // セル枠
        ctx.strokeStyle = "var(--color-border)";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + 0.5, cy + 0.5, cell - 1, cell - 1);
      }
    }
  }, [flip, crop, erase, brightness, regen, board, ready]);

  const handleReset = () => {
    setFlip(true);
    setCrop(true);
    setErase(false);
    setBrightness(true);
    setRegen(0);
  };

  const Toggle = ({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 10,
        fontSize: "var(--text-sm)",
      }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );

  return (
    <PlaygroundFrame
      title="データ拡張プレビュー"
      guide={
        <>
          反転と明度だけをONにして、同じ1枚から何通りの見た目が作れるか組合せ数を確かめよう。／
          消去（RandomErasing）もONにして、隠れても分類できるよう学ぶ狙いを想像してみよう。
        </>
      }
      onReset={handleReset}
      controls={
        <>
          <Toggle label="左右反転（flip）" checked={flip} onChange={setFlip} />
          <Toggle label="ランダム切り出し（crop）" checked={crop} onChange={setCrop} />
          <Toggle label="ランダム消去（erase）" checked={erase} onChange={setErase} />
          <Toggle label="明度変化（brightness）" checked={brightness} onChange={setBrightness} />

          <button
            type="button"
            className="btn btn-accent"
            onClick={() => setRegen((r) => r + 1)}
            style={{ marginTop: 8 }}
          >
            ↻ 再生成
          </button>

          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: "var(--color-surface)",
              borderRadius: 8,
              fontSize: "var(--text-sm)",
              lineHeight: 1.7,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>1枚が何枚分に？</div>
            {combo.parts.length === 0 ? (
              <span style={{ color: "var(--color-text-muted)" }}>拡張なし → 1通りのまま</span>
            ) : (
              <>
                {combo.parts.map((p) => `${p.label}${p.n}`).join(" × ")}
                {" = "}
                <strong style={{ color: "var(--color-accent)" }}>
                  約 {combo.total.toLocaleString()} 通り
                </strong>
              </>
            )}
          </div>
        </>
      }
    >
      <div ref={wrapRef} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <canvas
          ref={canvasRef}
          style={{
            width: board,
            height: board,
            maxWidth: "100%",
            display: "block",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: "#fff",
          }}
          aria-label="データ拡張の3×3プレビュー"
        />
      </div>
    </PlaygroundFrame>
  );
}
