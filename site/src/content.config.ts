// コンテンツコレクション定義（Astro 5 のコンテンツレイヤ）。
// modules コレクション: 各モジュール本文 m1.mdx … m7.mdx の frontmatter を zod で検証する。
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const modules = defineCollection({
  loader: glob({ pattern: "m*.mdx", base: "./src/content/modules" }),
  schema: z.object({
    /** モジュール番号（1〜7）。 */
    number: z.number().int().min(1).max(7),
    /** タイトル。 */
    title: z.string(),
    /** 目安の所要時間（分）。 */
    minutes: z.number().int().positive(),
    /** 一覧カード等に出す短い説明。 */
    description: z.string(),
    /** Colab ノートブックへのリンク（任意・複数可）。 */
    colab: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().url(),
        }),
      )
      .optional(),
  }),
});

export const collections = { modules };
