// base パス（astro.config の base / BASE_PATH）を考慮したリンク生成。
// import.meta.env.BASE_URL は末尾に "/" を含みうるので正規化する。

const RAW_BASE = import.meta.env.BASE_URL ?? "/";
const BASE = RAW_BASE.replace(/\/$/, ""); // 末尾スラッシュを除去（"" or "/mlsite"）

/** サイト内リンクを base 付きで作る。href("/glossary") → "/mlsite/glossary" 等。 */
export function href(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}${p}` || "/";
}

/** モジュールのスラグからページURL。 */
export function moduleHref(slug: string): string {
  return href(`/modules/${slug}`);
}
