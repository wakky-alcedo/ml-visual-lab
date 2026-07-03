// 選択式クイズ。各問は独立に回答でき、選んだ瞬間に正誤判定＋解説を表示する。
// 進捗は localStorage["mlsite:quiz:<module>"] に保存し、リロード後も復元する。
// React 固有APIは useState/useEffect のみ（Preact/compat 互換）。
import { useEffect, useState } from "react";
import type { QuizBlockProps, QuizProgress, QuizSet } from "../../lib/types";
import { getQuiz } from "../../data/quiz";
import { clearProgress, loadProgress, saveProgress } from "../../lib/quiz-progress";
import "./QuizBlock.css";

function computeProgress(questions: QuizSet, answered: (number | undefined)[]): QuizProgress {
  let correct = 0;
  for (let i = 0; i < questions.length; i++) {
    if (answered[i] !== undefined && answered[i] === questions[i].answerIndex) correct++;
  }
  return { answered, correct, total: questions.length };
}

export default function QuizBlock({ module, questions: propQuestions }: QuizBlockProps) {
  const questions = propQuestions ?? getQuiz(module);
  const [answered, setAnswered] = useState<(number | undefined)[]>(() =>
    new Array(questions.length).fill(undefined),
  );

  // マウント時に保存済み進捗を復元する（SSR とハイドレーションの差異を避けるため effect 内で）。
  useEffect(() => {
    const saved = loadProgress(module);
    if (saved && saved.answered.length === questions.length) {
      setAnswered(saved.answered);
    }
    // module 単位で1回だけ。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  if (questions.length === 0) {
    return (
      <div className="quiz quiz--empty">
        このモジュールのクイズは準備中です（module: {module}）。
      </div>
    );
  }

  function choose(qIndex: number, choiceIndex: number) {
    if (answered[qIndex] !== undefined) return; // 回答済みは変更不可
    const nextAnswered = answered.slice();
    nextAnswered[qIndex] = choiceIndex;
    setAnswered(nextAnswered);
    saveProgress(module, computeProgress(questions, nextAnswered));
  }

  function reset() {
    const cleared = new Array(questions.length).fill(undefined);
    setAnswered(cleared);
    clearProgress(module);
  }

  const progress = computeProgress(questions, answered);
  const answeredCount = answered.filter((a) => a !== undefined).length;

  return (
    <div className="quiz">
      <div className="quiz__head">
        <span className="quiz__count">
          確認クイズ（{answeredCount} / {questions.length} 問回答）
        </span>
        <span className="quiz__score">
          正解 {progress.correct} / {progress.total}
        </span>
      </div>

      <ol className="quiz__list">
        {questions.map((q, qi) => {
          const chosen = answered[qi];
          const done = chosen !== undefined;
          const isCorrect = done && chosen === q.answerIndex;
          return (
            <li key={qi} className="quiz__item">
              <p className="quiz__question">{q.question}</p>
              <div className="quiz__choices" role="group">
                {q.choices.map((choice, ci) => {
                  const selected = chosen === ci;
                  const showAsCorrect = done && ci === q.answerIndex;
                  const showAsWrong = done && selected && ci !== q.answerIndex;
                  const cls = [
                    "quiz__choice",
                    selected ? "is-selected" : "",
                    showAsCorrect ? "is-correct" : "",
                    showAsWrong ? "is-wrong" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      type="button"
                      key={ci}
                      className={cls}
                      disabled={done}
                      aria-pressed={selected}
                      onClick={() => choose(qi, ci)}
                    >
                      <span className="quiz__marker" aria-hidden="true">
                        {showAsCorrect ? "○" : showAsWrong ? "×" : String.fromCharCode(65 + ci)}
                      </span>
                      <span>{choice}</span>
                    </button>
                  );
                })}
              </div>
              {done && (
                <div
                  className={`quiz__explain ${isCorrect ? "is-correct" : "is-wrong"}`}
                  role="status"
                >
                  <strong>{isCorrect ? "正解！" : "不正解"}</strong> {q.explanation}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="quiz__footer">
        <button type="button" className="btn" onClick={reset}>
          ↺ クイズをやり直す
        </button>
      </div>
    </div>
  );
}
