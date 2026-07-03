// 可視化の共通枠。全 interactive 部品はこれでラップする。
// 構成: タイトル ／ 操作パネル(controls) ／ 描画領域(children) ／ リセットボタン ／
//       「試してみよう」ガイド文(guide) スロット。
// レイアウトは CSS grid。スマホ幅では操作パネルを描画領域の上に縦積みする。
import type { PlaygroundFrameProps } from "../../lib/types";
import "./PlaygroundFrame.css";

export default function PlaygroundFrame({
  title,
  guide,
  controls,
  children,
  onReset,
  resetLabel = "リセット",
}: PlaygroundFrameProps) {
  return (
    <section className="pg wide" aria-label={title}>
      <header className="pg__header">
        <h3 className="pg__title">{title}</h3>
        {onReset && (
          <button type="button" className="btn pg__reset" onClick={onReset}>
            <span aria-hidden="true">↺</span> {resetLabel}
          </button>
        )}
      </header>

      {guide && <div className="pg__guide">{guide}</div>}

      <div className="pg__body">
        {controls && <div className="pg__controls">{controls}</div>}
        <div className="pg__canvas">{children}</div>
      </div>
    </section>
  );
}
