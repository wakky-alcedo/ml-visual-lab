// ============================================================================
// 【削除可・dev確認用のダミー】
// PlaygroundFrame + Slider + シード付き乱数 + リセットの使い方を示す参考実装。
// 可視化バッチ（A/B/C）の着手時のテンプレートとして参照してください。
// 本番ルートには組み込んでいません。不要になったらこのファイルごと削除して構いません。
// ============================================================================
import { useMemo, useRef, useState } from "react";
import PlaygroundFrame from "../ui/PlaygroundFrame";
import Slider from "../ui/Slider";
import { mulberry32, DEFAULT_SEED } from "../../lib/rng";

export default function DemoPlayground() {
  // 操作パラメータは useState、初期値は意味のある値にする（仕様の要求）。
  const [count, setCount] = useState(30);
  const [spread, setSpread] = useState(0.6);
  // リセットで乱数を作り直すためのシード。リセット→同じ結果を保証する。
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const width = 480;
  const height = 280;
  const svgRef = useRef<SVGSVGElement>(null);

  // シードとパラメータから点群を決定論的に生成（描画は純粋関数的に導出）。
  const points = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      x: rng.normal(width / 2, spread * width * 0.18),
      y: rng.normal(height / 2, spread * height * 0.18),
      r: 3 + rng.next() * 4,
    }));
  }, [count, spread, seed]);

  return (
    <PlaygroundFrame
      title="デモ: 点群ジェネレータ（削除可）"
      guide="スライダーで点の数と散らばりを変えてみましょう。リセットで同じ初期状態に戻ります。"
      onReset={() => {
        setCount(30);
        setSpread(0.6);
        setSeed(DEFAULT_SEED);
      }}
      controls={
        <>
          <Slider
            label="点の数"
            value={count}
            min={5}
            max={200}
            step={5}
            unit="点"
            onChange={setCount}
          />
          <Slider
            label="散らばり"
            value={spread}
            min={0.1}
            max={1.5}
            step={0.1}
            onChange={setSpread}
          />
        </>
      }
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ maxWidth: width, background: "var(--color-surface)", borderRadius: 8 }}
        role="img"
        aria-label="生成された点群"
      >
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="var(--color-accent)" opacity={0.6} />
        ))}
      </svg>
    </PlaygroundFrame>
  );
}
