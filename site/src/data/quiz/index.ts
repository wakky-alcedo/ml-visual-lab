// クイズの読み込みレジストリ。
// 各モジュールのクイズは m<n>.ts に default export で置き、ここで集約する。
// QuizBlock はモジュールのスラグ（"m1" 等）でここから取得する。
// 後続バッチは m2.ts〜m7.ts を追加し、この registry に登録すること。

import type { QuizSet } from "../../lib/types";
import m1 from "./m1";
import m2 from "./m2";
import m3 from "./m3";
import m4 from "./m4";
import m5 from "./m5";
import m6 from "./m6";
import m7 from "./m7";

const registry: Record<string, QuizSet> = {
  m1,
  m2,
  m3,
  m4,
  m5,
  m6,
  m7,
};

/** モジュールスラグからクイズを取得する。未登録なら空配列。 */
export function getQuiz(moduleSlug: string): QuizSet {
  return registry[moduleSlug] ?? [];
}

/** 登録済みモジュールのスラグ一覧。 */
export function quizModules(): string[] {
  return Object.keys(registry);
}

export default registry;
