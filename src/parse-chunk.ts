import type { Address, JigyosyoAddress, KenAllAddress } from "./types.js";

/** base64 文字列を Uint8Array にデコード */
export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** CSV 行を Address に変換 */
function parseRow(line: string): Address | null {
  const cols = line.split(",");
  const type = cols[0];

  if (type === "k") {
    return {
      source: "ken_all",
      postalCode: cols[1],
      oldPostalCode: cols[2],
      jisCode: cols[3],
      prefecture: cols[4],
      prefectureKana: cols[5],
      city: cols[6],
      cityKana: cols[7],
      town: cols[8],
      townKana: cols[9],
      multiPostalCode: cols[10] === "1",
      koazabanchi: cols[11] === "1",
      chome: cols[12] === "1",
      multiTown: cols[13] === "1",
    } satisfies KenAllAddress;
  }

  if (type === "j") {
    return {
      source: "jigyosyo",
      postalCode: cols[1],
      oldPostalCode: cols[2],
      jisCode: cols[3],
      prefecture: cols[4],
      city: cols[5],
      town: cols[6],
      streetAddress: cols[7],
      companyName: cols[8],
      companyNameKana: cols[9],
      postOffice: cols[10],
      codeType: cols[11] === "1" ? 1 : 0,
    } satisfies JigyosyoAddress;
  }

  return null;
}

/** 展開済み CSV 文字列をパースして postalCode → Address の Map に変換 */
export function parseChunk(csv: string): Map<string, Address> {
  const map = new Map<string, Address>();
  const lines = csv.split("\n");
  for (const line of lines) {
    if (!line) continue;
    const entry = parseRow(line);
    if (entry) {
      map.set(entry.postalCode, entry);
    }
  }
  return map;
}
