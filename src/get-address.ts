import { inflateSync } from "fflate";
import { chunks } from "./__generated__/chunks.js";
import { normalizePostalCode } from "./normalize.js";
import { base64ToBytes, parseChunk } from "./parse-chunk.js";
import type { Address } from "./types.js";

const cache = new Map<string, Map<string, Address> | null>();

function loadChunk(prefix: string): Map<string, Address> | null {
  const cached = cache.get(prefix);
  if (cached !== undefined) return cached;

  const base64 = chunks[prefix];
  if (!base64) {
    cache.set(prefix, null);
    return null;
  }

  const compressed = base64ToBytes(base64);
  const decompressed = inflateSync(compressed);
  const csv = new TextDecoder().decode(decompressed);
  const map = parseChunk(csv);

  cache.set(prefix, map);
  return map;
}

/**
 * 郵便番号から住所情報を取得する。
 *
 * @param postalCode - 郵便番号（ハイフンあり/なし両対応、全角数字対応）
 * @returns 住所情報。見つからない場合は null。同一郵便番号が両データに存在する場合は事業所データを優先。
 */
export function getAddress(postalCode: string): Address | null {
  const normalized = normalizePostalCode(postalCode);
  if (normalized === null) return null;

  const prefix = normalized.slice(0, 3);
  const chunk = loadChunk(prefix);
  if (chunk === null) return null;

  return chunk.get(normalized) ?? null;
}
