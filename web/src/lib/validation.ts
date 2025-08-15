export function normalizeDisplayName(input: string): string {
  return (input || "").trim().replace(/\s{2,}/g, " ");
}

// Allowlist approach to avoid emojis and potentially dangerous symbols
// - Japanese (Hiragana/Katakana/Kanji), ASCII letters/digits, space, and a small set of punctuation
// - Disallows angle brackets and quotes to reduce XSS vectors in other contexts
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
  // Drop characters commonly used in XSS vectors or control chars
  s = s.replace(/[<>"'`]/g, "");
  s = s.replace(/[\u0000-\u001F\u007F]/g, "");
  return s;
}

