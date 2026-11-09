import { describe, expect, it } from "vitest";
import {
  type Manifest,
  parseManifest,
  planRelease,
  planTaggedRelease,
} from "../release-plan";

function manifest(): Manifest {
  return {
    sources: [
      { file: "utf_ken_all.csv", sha256: "a".repeat(64) },
      { file: "JIGYOSYO.CSV", sha256: "b".repeat(64) },
    ],
    entries: 142_917,
  };
}

describe("planRelease", () => {
  it("skips identical data without publishing a duplicate version", () => {
    expect(planRelease("0.2.2", "0.2.2", manifest(), manifest())).toEqual({
      publish: false,
      version: "0.2.2",
    });
  });

  it.each([0, 1])("publishes when source %i changes", (index) => {
    const current = manifest();
    current.sources[index].sha256 = "c".repeat(64);
    expect(planRelease("0.2.2", "0.2.2", current, manifest())).toEqual({
      publish: true,
      version: "0.2.3",
    });
  });

  it("compares source order and hash case independently", () => {
    const published = manifest();
    published.sources.reverse();
    published.sources[0].sha256 = published.sources[0].sha256.toUpperCase();
    expect(planRelease("0.2.2", "0.2.2", manifest(), published).publish).toBe(
      false,
    );
  });

  it("publishes when the entry count changes", () => {
    const current = manifest();
    current.entries += 1;
    expect(planRelease("0.2.2", "0.2.2", current, manifest()).publish).toBe(
      true,
    );
  });

  it("updates a legacy publication without a manifest", () => {
    expect(planRelease("0.2.2", "0.2.2", manifest(), null)).toEqual({
      publish: true,
      version: "0.2.3",
    });
  });

  it("increments patch 9 to 10 rather than changing the minor version", () => {
    expect(planRelease("0.2.2", "0.2.9", manifest(), null).version).toBe(
      "0.2.10",
    );
  });

  it.each([
    manifest(),
    null,
  ])("honors an explicit newer local code version", (published) => {
    expect(planRelease("1.0.0", "0.2.9", manifest(), published)).toEqual({
      publish: true,
      version: "1.0.0",
    });
  });

  it("recovers a local version behind npm without republishing unchanged data", () => {
    expect(planRelease("0.2.2", "0.3.0", manifest(), manifest())).toEqual({
      publish: false,
      version: "0.3.0",
    });
  });

  it("uses the npm version as the patch baseline when local is behind", () => {
    expect(planRelease("0.2.2", "1.0.9", manifest(), null)).toEqual({
      publish: true,
      version: "1.0.10",
    });
  });

  it.each([
    "v1.2.3",
    "1.2",
    "01.2.3",
    "1.2.3-beta.1",
    "1.2.3+build",
    "-1.2.3",
    "1.2.3\n",
    "9007199254740992.0.0",
  ])("rejects invalid stable version %j on either side", (version) => {
    expect(() => planRelease(version, "1.2.3", manifest(), null)).toThrow();
    expect(() => planRelease("1.2.3", version, manifest(), null)).toThrow();
  });

  it("rejects patch overflow", () => {
    expect(() =>
      planRelease("1.2.3", "1.2.9007199254740991", manifest(), null),
    ).toThrow("Patch version exceeds");
  });

  it("validates both manifests even when local version is newer", () => {
    const invalid = manifest();
    invalid.entries = 0;
    expect(() => planRelease("2.0.0", "1.0.0", invalid, null)).toThrow();
    expect(() => planRelease("2.0.0", "1.0.0", manifest(), invalid)).toThrow();
  });
});

describe("parseManifest", () => {
  it("returns canonical supported fields without modifying its input", () => {
    const input = { ...manifest(), fetchedAt: "ignored" };
    input.sources.reverse();
    expect(parseManifest(input)).toEqual(manifest());
    expect(input.sources[0].file).toBe("JIGYOSYO.CSV");
  });

  it.each([
    null,
    [],
    {},
    { ...manifest(), entries: 0 },
    { ...manifest(), entries: -1 },
    { ...manifest(), entries: 1.5 },
    { ...manifest(), entries: "142917" },
    { ...manifest(), sources: [] },
    { ...manifest(), sources: [manifest().sources[0], manifest().sources[0]] },
    {
      ...manifest(),
      sources: [
        manifest().sources[0],
        { file: "other.csv", sha256: "b".repeat(64) },
      ],
    },
    {
      ...manifest(),
      sources: [manifest().sources[0], { file: "JIGYOSYO.CSV", sha256: "bad" }],
    },
    {
      ...manifest(),
      sources: [
        manifest().sources[0],
        { file: "JIGYOSYO.CSV", sha256: "g".repeat(64) },
      ],
    },
  ])("rejects malformed manifest %j", (value) => {
    expect(() => parseManifest(value)).toThrow();
  });
});

describe("planTaggedRelease", () => {
  it("recovers GitHub Release creation after the source data changes", () => {
    const current = manifest();
    current.sources[0].sha256 = "c".repeat(64);
    expect(
      planTaggedRelease("0.2.3", "0.2.3", current, manifest(), "v0.2.3"),
    ).toEqual({ publish: false, version: "0.2.3" });
  });

  it("recovers an already published legacy package without a manifest", () => {
    expect(
      planTaggedRelease("0.2.3", "0.2.3", manifest(), null, "v0.2.3"),
    ).toEqual({ publish: false, version: "0.2.3" });
  });

  it("publishes a new tagged version even with unchanged data", () => {
    expect(
      planTaggedRelease("0.2.3", "0.2.2", manifest(), manifest(), "v0.2.3"),
    ).toEqual({ publish: true, version: "0.2.3" });
  });

  it("rejects older tags even with changed data", () => {
    expect(() =>
      planTaggedRelease("0.2.2", "0.2.3", manifest(), null, "v0.2.2"),
    ).toThrow("older than npm latest");
  });

  it.each([
    "0.2.3",
    "v0.2.4",
    "v0.2.3-beta.1",
    "v0.2.3\n",
  ])("rejects a tag that does not exactly match the package version: %j", (tag) => {
    expect(() =>
      planTaggedRelease("0.2.3", "0.2.2", manifest(), null, tag),
    ).toThrow("must match");
  });

  it.each([
    "v0.2.3",
    "0.2.3-beta.1",
    "01.2.3",
  ])("validates both versions as stable semver: %j", (version) => {
    expect(() =>
      planTaggedRelease(version, "0.2.2", manifest(), null, `v${version}`),
    ).toThrow();
    expect(() =>
      planTaggedRelease("0.2.3", version, manifest(), null, "v0.2.3"),
    ).toThrow();
  });

  it("validates manifests even when only recovering a GitHub Release", () => {
    const invalid = manifest();
    invalid.entries = 0;
    expect(() =>
      planTaggedRelease("0.2.3", "0.2.3", invalid, null, "v0.2.3"),
    ).toThrow();
    expect(() =>
      planTaggedRelease("0.2.3", "0.2.3", manifest(), invalid, "v0.2.3"),
    ).toThrow();
  });
});
