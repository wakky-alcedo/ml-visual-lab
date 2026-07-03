// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// site / base は環境変数で上書き可能（ドメイン直下配置を既定とする）。
// 例: SITE_URL=https://example.com BASE_PATH=/mlsite npm run build
const site = process.env.SITE_URL || "https://example.com";
const base = process.env.BASE_PATH || undefined;

// https://astro.build/config
export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "ignore",
  integrations: [
    react(),
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  ],
});
