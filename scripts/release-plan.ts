export type Manifest = {
  sources: { file: string; sha256: string }[];
  entries: number;
};

const sourceFiles = ["utf_ken_all.csv", "JIGYOSYO.CSV"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate and canonicalize the two source hashes used for release decisions. */
export function parseManifest(value: unknown): Manifest {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.entries) ||
    (value.entries as number) <= 0 ||
    !Array.isArray(value.sources) ||
    value.sources.length !== sourceFiles.length
  ) {
    throw new Error("Invalid postal data manifest");
  }

  const hashes = new Map<string, string>();
  for (const source of value.sources) {
    if (
      !isRecord(source) ||
      typeof source.file !== "string" ||
      !sourceFiles.includes(source.file) ||
      hashes.has(source.file) ||
      typeof source.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/i.test(source.sha256)
    ) {
      throw new Error("Invalid postal data source");
    }
    hashes.set(source.file, source.sha256.toLowerCase());
  }

  return {
    sources: sourceFiles.map((file) => ({
      file,
      // Exactly two distinct, recognized source names were validated above.
      sha256: hashes.get(file) as string,
    })),
    entries: value.entries as number,
  };
}

function parseVersion(version: string): number[] {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`Expected stable semantic version: ${version}`);
  }
  const parts = version.split(".").map(Number);
  if (!parts.every(Number.isSafeInteger)) {
    throw new Error(`Version component exceeds safe integer range: ${version}`);
  }
  return parts;
}

function compareVersions(left: number[], right: number[]): number {
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

/** Compare with the last successful publication, so failed releases are retried. */
export function planRelease(
  localVersion: string,
  publishedVersion: string,
  current: Manifest,
  published: Manifest | null,
): { publish: boolean; version: string } {
  const local = parseVersion(localVersion);
  const latest = parseVersion(publishedVersion);
  const canonicalCurrent = parseManifest(current);
  const canonicalPublished =
    published === null ? null : parseManifest(published);

  // An explicit local version bump also releases code without data changes.
  if (compareVersions(local, latest) > 0) {
    return { publish: true, version: localVersion };
  }
  if (
    canonicalPublished !== null &&
    JSON.stringify(canonicalCurrent) === JSON.stringify(canonicalPublished)
  ) {
    return { publish: false, version: publishedVersion };
  }

  if (!Number.isSafeInteger(latest[2] + 1)) {
    throw new Error("Patch version exceeds safe integer range");
  }
  latest[2] += 1;
  return { publish: true, version: latest.join(".") };
}

/** A published tag can finish its GitHub Release without republishing new data. */
export function planTaggedRelease(
  localVersion: string,
  publishedVersion: string,
  current: Manifest,
  published: Manifest | null,
  tag: string,
): { publish: boolean; version: string } {
  const local = parseVersion(localVersion);
  const latest = parseVersion(publishedVersion);
  if (tag !== `v${localVersion}`) {
    throw new Error("Release tag must match package.json version");
  }
  parseManifest(current);
  if (published !== null) parseManifest(published);

  const comparison = compareVersions(local, latest);
  if (comparison < 0) {
    throw new Error("Release tag is older than npm latest");
  }
  return { publish: comparison > 0, version: localVersion };
}
