import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execFileSync, spawnSync } = vi.hoisted(() => ({
  execFileSync: vi.fn(),
  spawnSync: vi.fn(),
}));
vi.mock("node:child_process", () => ({ execFileSync, spawnSync }));

const publishedCommit = "a".repeat(40);

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("VERSION", "0.2.3");
  execFileSync.mockReturnValue(
    JSON.stringify({ version: "0.2.3", gitHead: publishedCommit }),
  );
  spawnSync.mockReturnValue({ status: 1, stderr: "release not found" });
});
afterEach(() => vi.unstubAllEnvs());

describe("GitHub Release recovery", () => {
  it.each([
    false,
    true,
  ])("targets the published commit with npm 12 array wrapping=%s", async (wrapped) => {
    const metadata = { version: "0.2.3", gitHead: publishedCommit };
    execFileSync.mockReturnValue(
      JSON.stringify(wrapped ? [metadata] : metadata),
    );
    await import("../github-release");
    expect(execFileSync).toHaveBeenLastCalledWith(
      "gh",
      [
        "release",
        "create",
        "v0.2.3",
        "--target",
        publishedCommit,
        "--generate-notes",
      ],
      { stdio: "inherit" },
    );
    expect(execFileSync.mock.calls.some(([cmd]) => cmd === "git")).toBe(false);
  });

  it("recovers npm latest before selecting a new version", async () => {
    delete process.env.VERSION;
    await import("../github-release");
    expect(execFileSync.mock.calls[0][1]).toContain("yubin@latest");
    expect(spawnSync).toHaveBeenCalledWith(
      "gh",
      ["release", "view", "v0.2.3"],
      { encoding: "utf8" },
    );
    expect(execFileSync.mock.calls[1][1]).toContain(publishedCommit);
  });

  it("leaves an existing release unchanged, including legacy npm metadata", async () => {
    execFileSync.mockReturnValue(JSON.stringify({ version: "0.2.3" }));
    spawnSync.mockReturnValue({ status: 0, stderr: "" });
    await import("../github-release");
    expect(execFileSync).toHaveBeenCalledTimes(1);
  });

  it.each([
    undefined,
    "main",
    "bad-sha",
  ])("refuses a missing release without a valid published commit: %s", async (gitHead) => {
    execFileSync.mockReturnValue(JSON.stringify({ version: "0.2.3", gitHead }));
    await expect(import("../github-release")).rejects.toThrow(
      "refusing HEAD fallback",
    );
    expect(execFileSync).toHaveBeenCalledTimes(1);
  });

  it.each([
    "HTTP 503: unavailable",
    "HTTP 401: bad credentials",
    "network error",
  ])("stops on a GitHub lookup error instead of creating a release: %s", async (stderr) => {
    spawnSync.mockReturnValue({ status: 1, stderr });
    await expect(import("../github-release")).rejects.toThrow(stderr);
    expect(execFileSync).toHaveBeenCalledTimes(1);
  });

  it("stops when npm metadata cannot be fetched", async () => {
    execFileSync.mockImplementation(() => {
      throw new Error("npm registry unavailable");
    });
    await expect(import("../github-release")).rejects.toThrow(
      "npm registry unavailable",
    );
    expect(spawnSync).not.toHaveBeenCalled();
  });
});
