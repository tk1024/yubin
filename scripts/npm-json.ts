function singleResult(json: string): unknown {
  const value: unknown = JSON.parse(json);
  if (!Array.isArray(value)) return value;
  if (value.length !== 1) {
    throw new Error("Expected exactly one npm view result");
  }
  return value[0];
}

function version(value: unknown): string {
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error("Invalid published version");
  }
  return value;
}

/** npm 11 returns a scalar/object; npm 12 always wraps view results in an array. */
export function readNpmVersion(json: string): string {
  return version(singleResult(json));
}

export function readNpmPackage(json: string): {
  version: string;
  gitHead?: string;
} {
  const value = singleResult(json);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid npm package metadata");
  }
  const data = value as Record<string, unknown>;
  if (data.gitHead !== undefined && typeof data.gitHead !== "string") {
    throw new Error("Invalid npm gitHead");
  }
  return { version: version(data.version), gitHead: data.gitHead };
}

/** npm 11 returns an array; npm 12 keys pack results by package name. */
export function readNpmPack(json: string): { filename: string } {
  let value: unknown = JSON.parse(json);
  if (Array.isArray(value)) {
    if (value.length !== 1) throw new Error("Expected one packed package");
    value = value[0];
  } else if (
    typeof value === "object" &&
    value !== null &&
    Object.keys(value).length === 1 &&
    "yubin" in value
  ) {
    value = value.yubin;
  } else {
    throw new Error("Expected one packed package");
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !("name" in value) ||
    value.name !== "yubin" ||
    !("filename" in value) ||
    typeof value.filename !== "string" ||
    !/^[^/\\]+\.tgz$/.test(value.filename)
  ) {
    throw new Error("Invalid packed package");
  }
  return { filename: value.filename };
}
