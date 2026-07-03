// 英語表記から用語IDの kebab-case スラグを生成する共通関数。
// TermDef と glossary ページの両方で使い、リンク先とアンカーを必ず一致させる。
// 例: "Gradient Descent" → "gradient-descent"、"L2 Regularization" → "l2-regularization"

export function toSlug(en: string): string {
  return en
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // 英数字以外は区切りに
    .replace(/^-+|-+$/g, ""); // 前後のハイフン除去
}
