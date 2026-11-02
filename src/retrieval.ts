import type { Chapter } from "./types";
const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function searchBook(
  chapters: Chapter[],
  query: string,
): { label: string; href: string; excerpt: string }[] {
  const needle = normalize(query.trim());
  if (needle.length < 2) return [];
  const result: { label: string; href: string; excerpt: string }[] = [];
  for (const c of chapters) {
    const haystack = normalize(c.text);
    let start = 0;
    while (result.length < 60) {
      const index = haystack.indexOf(needle, start);
      if (index < 0) break;
      result.push({
        label: c.label,
        href: c.href,
        excerpt:
          (index > 90 ? "…" : "") +
          c.text
            .slice(Math.max(0, index - 90), index + needle.length + 150)
            .replace(/\s+/g, " ") +
          (index + needle.length + 150 < c.text.length ? "…" : ""),
      });
      start = index + needle.length;
    }
    if (result.length >= 60) break;
  }
  return result;
}
