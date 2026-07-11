export function normalizeDisplayName(input: string): string {
  return (input || "").trim().replace(/\s{2,}/g, " ");
}

const DISPLAY_NAME_ALLOWED = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}A-Za-z0-9 _\.\-\/\(\)\[\]!\?]/u;

export function isValidDisplayName(name: string): boolean {
  const n = normalizeDisplayName(name);
  if (n.length < 1 || n.length > 32) return false;
  for (const ch of n) {
    if (!DISPLAY_NAME_ALLOWED.test(ch)) return false;
  }
  return true;
}

export function sanitizeInlineText(input: string, maxLen = 500): string {
  let s = (input || "").slice(0, maxLen);
  s = s.replace(/[<>"'`]/g, "");
  s = s.replace(/[\u0000-\u001F\u007F]/g, "");
  return s;
}
