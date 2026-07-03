// ラベル・現在値・単位つきスライダー。タッチ対応（range input はモバイルでも動く）。
// フレームワーク非依存を保つため React 固有APIは useId のみ利用（Preact/compat でも動作）。
import { useId } from "react";
import type { SliderProps } from "../../lib/types";
import "./Slider.css";

export default function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  format,
  onChange,
  disabled = false,
}: SliderProps) {
  const id = useId();
  const display = format ? format(value) : `${value}${unit ? unit : ""}`;

  return (
    <div className="ui-slider">
      <div className="ui-slider__head">
        <label className="ui-slider__label" htmlFor={id}>
          {label}
        </label>
        <output className="ui-slider__value" htmlFor={id}>
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
