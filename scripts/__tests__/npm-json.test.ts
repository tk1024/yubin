import { describe, expect, it } from "vitest";
import { readNpmPack, readNpmPackage, readNpmVersion } from "../npm-json";

describe("npm view JSON compatibility", () => {
  it.each([
    '"0.2.2"',
    '["0.2.2"]',
  ])("reads the published version from npm 11/12: %s", (json) =>
    expect(readNpmVersion(json)).toBe("0.2.2"));

  const metadata = { version: "0.2.2", gitHead: "a".repeat(40) };
  it.each([
    metadata,
    [metadata],
  ])("reads the npm 11/12 package metadata: %j", (value) =>
    expect(readNpmPackage(JSON.stringify(value))).toEqual(metadata));

  it.each([
    { version: "0.2.2" },
    [{ version: "0.2.2" }],
  ])("keeps missing legacy gitHead optional: %j", (value) =>
    expect(readNpmPackage(JSON.stringify(value)).gitHead).toBeUndefined());

  it.each([
    "[]",
    '["0.2.2","0.2.3"]',
    "null",
    "{}",
    '"invalid"',
  ])("rejects missing, multiple, or malformed versions: %s", (json) =>
    expect(() => readNpmVersion(json)).toThrow());

  it.each([
    "[]",
    '[{"version":"0.2.2"},{"version":"0.2.3"}]',
    '"0.2.2"',
    "null",
    "{}",
    '{"version":"0.2.2","gitHead":123}',
  ])("rejects ambiguous or malformed package metadata: %s", (json) => {
    expect(() => readNpmPackage(json)).toThrow();
  });
});

describe("npm pack JSON compatibility", () => {
  const packed = { name: "yubin", filename: "yubin-0.2.2.tgz" };
  it.each([
    [packed],
    { yubin: packed },
  ])("reads npm 11/12 output: %j", (value) => {
    expect(readNpmPack(JSON.stringify(value))).toEqual({
      filename: "yubin-0.2.2.tgz",
    });
  });

  it.each([
    [],
    [packed, packed],
    null,
    {},
    { yubin: packed, other: packed },
    { other: packed },
    [{ name: "other", filename: "other.tgz" }],
    [{ name: "yubin", filename: "../other.tgz" }],
    [{ name: "yubin", filename: "/tmp/other.tgz" }],
    [{ name: "yubin", filename: "..\\other.tgz" }],
  ])("rejects ambiguous or unsafe archive results: %j", (value) => {
    expect(() => readNpmPack(JSON.stringify(value))).toThrow();
  });
});
