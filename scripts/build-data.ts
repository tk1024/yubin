/**
 * CSV → 圧縮チャンク変換スクリプト
 *
 * raw/utf_ken_all.csv と raw/JIGYOSYO.CSV を読み込み、
 * 郵便番号の上位3桁ごとに CSV を作成、deflate 圧縮し、
 * base64 エンコードして src/__generated__/chunks.ts に出力する。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "fflate";
import type { Address, JigyosyoAddress, KenAllAddress } from "../src/types";

const ROOT = join(__dirname, "..");
const RAW_DIR = join(ROOT, "raw");
const GENERATED_DIR = join(ROOT, "src", "__generated__");

/** CSVの1行をカンマで分割（ダブルクォート内のカンマを考慮） */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function loadKenAll(): Map<string, KenAllAddress> {
  const filePath = join(RAW_DIR, "utf_ken_all.csv");
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const map = new Map<string, KenAllAddress>();

  for (const line of lines) {
    const cols = parseCsvLine(line);
    const postalCode = cols[2];
    if (!postalCode || postalCode.length !== 7) continue;

    const entry: KenAllAddress = {
      source: "ken_all",
      postalCode,
      oldPostalCode: cols[1],
      jisCode: cols[0],
      prefectureKana: cols[3],
      cityKana: cols[4],
      townKana: cols[5],
      prefecture: cols[6],
      city: cols[7],
      town: cols[8],
      multiPostalCode: cols[9] === "1",
      koazabanchi: cols[10] === "1",
      chome: cols[11] === "1",
      multiTown: cols[12] === "1",
    };

    // 同一郵便番号が複数行ある場合は最初のエントリを採用
    if (!map.has(postalCode)) {
      map.set(postalCode, entry);
    }
  }

  console.log(`Loaded ${map.size} entries from utf_ken_all.csv`);
  return map;
}

function loadJigyosyo(): Map<string, JigyosyoAddress> {
  const filePath = join(RAW_DIR, "JIGYOSYO.CSV");
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const map = new Map<string, JigyosyoAddress>();

  for (const line of lines) {
    const cols = parseCsvLine(line);
    const postalCode = cols[7];
    if (!postalCode || postalCode.length !== 7) continue;

    const entry: JigyosyoAddress = {
      source: "jigyosyo",
      postalCode,
      oldPostalCode: cols[8],
      jisCode: cols[0],
      prefecture: cols[3],
      city: cols[4],
      town: cols[5],
      streetAddress: cols[6],
      companyName: cols[2],
      companyNameKana: cols[1],
      postOffice: cols[9],
      codeType: cols[10] === "1" ? 1 : 0,
    };

    map.set(postalCode, entry);
  }

  console.log(`Loaded ${map.size} entries from JIGYOSYO.CSV`);
  return map;
}

/** Address を CSV 行に変換 */
function toCsvRow(entry: Address): string {
  if (entry.source === "ken_all") {
    return [
      "k",
      entry.postalCode,
      entry.oldPostalCode,
      entry.jisCode,
      entry.prefecture,
      entry.prefectureKana,
      entry.city,
      entry.cityKana,
      entry.town,
      entry.townKana,
      entry.multiPostalCode ? 1 : 0,
      entry.koazabanchi ? 1 : 0,
      entry.chome ? 1 : 0,
      entry.multiTown ? 1 : 0,
    ].join(",");
  }
  return [
    "j",
    entry.postalCode,
    entry.oldPostalCode,
    entry.jisCode,
    entry.prefecture,
    entry.city,
    entry.town,
    entry.streetAddress,
    entry.companyName,
    entry.companyNameKana,
    entry.postOffice,
    entry.codeType,
  ].join(",");
}

function main() {
  mkdirSync(GENERATED_DIR, { recursive: true });

  const kenAll = loadKenAll();
  const jigyosyo = loadJigyosyo();

  // マージ（事業所データ優先）
  const merged = new Map<string, Address>();
  for (const [code, entry] of kenAll) {
    merged.set(code, entry);
  }
  for (const [code, entry] of jigyosyo) {
    merged.set(code, entry);
  }
  console.log(`Total merged entries: ${merged.size}`);

  // 上位3桁でグルーピング → CSV → deflate → base64
  const csvChunks = new Map<string, string[]>();
  for (const [code, entry] of merged) {
    const prefix = code.slice(0, 3);
    let rows = csvChunks.get(prefix);
    if (!rows) {
      rows = [];
      csvChunks.set(prefix, rows);
    }
    rows.push(toCsvRow(entry));
  }

  const entries: string[] = [];
  let totalCsvBytes = 0;
  let totalCompressedBytes = 0;

  for (const [prefix, rows] of csvChunks) {
    const csv = rows.join("\n");
    const csvBytes = new TextEncoder().encode(csv);
    const compressed = deflateSync(csvBytes);
    const base64 = Buffer.from(compressed).toString("base64");

    totalCsvBytes += csvBytes.length;
    totalCompressedBytes += compressed.length;
    entries.push(`"${prefix}":"${base64}"`);
  }

  // src/__generated__/chunks.ts を生成
  const tsContent = `// Generated file - do not edit\nexport const chunks: Record<string, string> = {${entries.join(",")}};\n`;
  writeFileSync(join(GENERATED_DIR, "chunks.ts"), tsContent);

  console.log(`CSV total: ${(totalCsvBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(
    `Deflated total: ${(totalCompressedBytes / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(
    `chunks.ts: ${(Buffer.byteLength(tsContent) / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(`Chunks: ${csvChunks.size}`);
}

main();
