/**
 * 郵便番号を正規化する。
 * - 前後空白除去
 * - 〒 除去
 * - ハイフン類除去（-, －, ー, ‐, −）
 * - 全角数字→半角変換
 *
 * @returns 正規化された7桁の郵便番号文字列、または不正な場合 null
 */
export function normalizePostalCode(input: string): string | null {
  let s = input.trim();
  s = s.replace(/〒/g, "");
  s = s.replace(/[-－ー‐−]/g, "");
  s = s.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
  s = s.trim();

  if (!/^\d{7}$/.test(s)) return null;
  return s;
}
