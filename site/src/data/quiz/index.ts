// クイズの読み込みレジストリ。
// 各モジュールのクイズは m<n>.ts に default export で置き、ここで集約する。
// QuizBlock はモジュールのスラグ（"m1" 等）でここから取得する。
// 後続バッチは m2.ts〜m7.ts を追加し、この registry に登録すること。

import type { QuizSet } from "../../lib/types";
import m1 from "./m1";

const registry: Record<string, QuizSet> = {
  m1,
  // m2〜m7 は後続バッチがここに追加する。
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
