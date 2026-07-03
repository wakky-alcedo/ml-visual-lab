// クイズ進捗の localStorage 読み書きヘルパ。
// キーは仕様どおり "mlsite:quiz:<moduleSlug>"。
// SSR（window 不在）でも壊れないようガードする。QuizBlock とトップページの
// 達成率表示の両方から使う。

import type { QuizProgress } from "./types";

const PREFIX = "mlsite:quiz:";

export function quizKey(moduleSlug: string): string {
  return `${PREFIX}${moduleSlug}`;
}

/** 進捗を読み込む。未保存・不正データなら null。 */
export function loadProgress(moduleSlug: string): QuizProgress | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(quizKey(moduleSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuizProgress;
    if (!Array.isArray(parsed.answered)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 進捗を保存する。 */
export function saveProgress(moduleSlug: string, progress: QuizProgress): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(quizKey(moduleSlug), JSON.stringify(progress));
  } catch {
    // 容量超過等は黙って無視（進捗保存は必須機能ではない）。
  }
}

/** 進捗を消す。 */
export function clearProgress(moduleSlug: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(quizKey(moduleSlug));
  } catch {
    /* noop */
  }
}

/** 達成率（正解数/総数）を 0〜1 で返す。未回答は 0。 */
export function achievementRate(progress: QuizProgress | null): number {
  if (!progress || progress.total === 0) return 0;
  return progress.correct / progress.total;
}
