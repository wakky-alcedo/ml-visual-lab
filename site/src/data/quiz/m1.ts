import type { QuizSet } from "../../lib/types";

// M1 のサンプルクイズ（後続の本文バッチが正式版に差し替える想定の仮データ）。
const quiz: QuizSet = [
  {
    question:
      "AI・機械学習（Machine Learning）・深層学習（Deep Learning）の包含関係として正しいものはどれですか。",
    choices: [
      "AI ⊃ 機械学習 ⊃ 深層学習",
      "深層学習 ⊃ 機械学習 ⊃ AI",
      "機械学習 ⊃ AI ⊃ 深層学習",
      "3つは互いに独立した別分野",
    ],
    answerIndex: 0,
    explanation:
      "深層学習は機械学習の一手法であり、機械学習はAIを実現する一つのアプローチです。したがって AI ⊃ 機械学習 ⊃ 深層学習 という入れ子の関係になります。",
  },
];

export default quiz;
