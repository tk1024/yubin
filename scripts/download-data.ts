import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { unzipSync } from "fflate";

const rawDir = join(__dirname, "..", "raw");
const sources = [
  {
    url: "https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip",
    file: "utf_ken_all.csv",
    encoding: "utf-8",
    columns: 15,
    minimumRows: 100_000,
  },
  {
    url: "https://www.post.japanpost.jp/service/search/zipcode/download/office/zip/jigyosyo.zip",
    file: "JIGYOSYO.CSV",
    encoding: "shift_jis",
    columns: 13,
    minimumRows: 10_000,
  },
];

async function main() {
  await mkdir(rawDir, { recursive: true });
  const downloads: { file: string; csv: string; rows: number }[] = [];
  for (const source of sources) {
    let bytes: Uint8Array | undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(source.url, {
          signal: AbortSignal.timeout(120_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
        bytes = archive[source.file];
        if (!bytes) throw new Error("missing from ZIP");
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        console.warn(`${source.file}: retry ${attempt}: ${error}`);
      }
    }
    if (!bytes) throw new Error(`${source.file}: missing from ZIP`);
    const csv = new TextDecoder(source.encoding, { fatal: true }).decode(bytes);
    const rows = csv.trim().split(/\r?\n/);
    if (rows.length < source.minimumRows) {
      throw new Error(`${source.file}: unexpectedly few rows (${rows.length})`);
    }
    // Count separators outside quoted fields; commas inside names are valid CSV.
    for (const [index, row] of rows.entries()) {
      const columns = row.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      if (columns.length !== source.columns) {
        throw new Error(`${source.file}:${index + 1}: invalid column count`);
      }
    }
    downloads.push({ file: source.file, csv, rows: rows.length });
  }
  // Validate both sources before replacing any previously downloaded data.
  for (const { file, csv } of downloads) {
    await writeFile(join(rawDir, `${file}.tmp`), csv);
  }
  for (const { file, rows } of downloads) {
    await rename(join(rawDir, `${file}.tmp`), join(rawDir, file));
    console.log(`${file}: ${rows} rows → ${rawDir}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
