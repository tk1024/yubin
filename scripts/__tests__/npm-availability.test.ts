import { describe, expect, it, vi } from "vitest";
import { waitForNpmVersion } from "../npm-availability";

const ready = {
  status: 0,
  stdout: JSON.stringify({ version: "0.2.3", gitHead: "a".repeat(40) }),
  stderr: "",
};
const pending = {
  status: 1,
  stdout: JSON.stringify({ error: { code: "E404" } }),
  stderr: "npm error code E404",
};

function harness() {
  let time = 0;
  const query = vi.fn().mockReturnValue(ready);
  const sleep = vi.fn(async (ms: number) => {
    time += ms;
  });
  return {
    query,
    sleep,
    now: () => time,
    log: vi.fn(),
    timeoutMs: 60_000,
    intervalMs: 30_000,
  };
}

describe("availability after npm accepted a publication", () => {
  it("finishes immediately when the version is already available", async () => {
    const deps = harness();
    expect(await waitForNpmVersion("0.2.3", deps)).toEqual({
      attempts: 1,
      elapsedMs: 0,
    });
    expect(deps.sleep).not.toHaveBeenCalled();
  });

  it("waits through processing E404s and succeeds without another publish", async () => {
    const deps = harness();
    deps.timeoutMs = 120_000;
    deps.query.mockReturnValueOnce(pending).mockReturnValueOnce(pending);
    expect(await waitForNpmVersion("0.2.3", deps)).toEqual({
      attempts: 3,
      elapsedMs: 60_000,
    });
    expect(deps.sleep.mock.calls).toEqual([[30_000], [30_000]]);
    expect(deps.query.mock.calls).toEqual([["0.2.3"], ["0.2.3"], ["0.2.3"]]);
  });

  it("times out with an explicit accepted-but-unconfirmed message", async () => {
    const deps = harness();
    deps.query.mockReturnValue(pending);
    await expect(waitForNpmVersion("0.2.3", deps)).rejects.toThrow(
      "Do not republish while processing",
    );
    expect(deps.now()).toBe(60_000);
    expect(deps.query).toHaveBeenCalledTimes(2);
  });

  it("bounds the last wait to the remaining time", async () => {
    const deps = harness();
    deps.timeoutMs = 45_000;
    deps.query.mockReturnValue(pending);
    await expect(waitForNpmVersion("0.2.3", deps)).rejects.toThrow(
      "availability was not confirmed",
    );
    expect(deps.sleep.mock.calls).toEqual([[30_000], [15_000]]);
  });

  it.each([
    "E401",
    "E403",
    "E500",
    "ENOTFOUND",
  ])("fails immediately for %s instead of treating it as processing", async (code) => {
    const deps = harness();
    deps.query.mockReturnValue({
      ...pending,
      stdout: JSON.stringify({ error: { code } }),
    });
    await expect(waitForNpmVersion("0.2.3", deps)).rejects.toThrow(
      "lookup failed",
    );
    expect(deps.sleep).not.toHaveBeenCalled();
  });

  it("does not retry non-JSON failures based on stderr alone", async () => {
    const deps = harness();
    deps.query.mockReturnValue({ ...pending, stdout: "" });
    await expect(waitForNpmVersion("0.2.3", deps)).rejects.toThrow(
      "lookup failed",
    );
    expect(deps.sleep).not.toHaveBeenCalled();
  });

  it("rejects metadata for a different version", async () => {
    const deps = harness();
    deps.query.mockReturnValue({
      ...ready,
      stdout: JSON.stringify({ version: "0.2.2" }),
    });
    await expect(waitForNpmVersion("0.2.3", deps)).rejects.toThrow(
      "unexpected version",
    );
  });

  it("propagates a missing CLI or subprocess timeout without retrying", async () => {
    const deps = harness();
    deps.query.mockReturnValue({
      ...pending,
      error: new Error("spawn timeout"),
    });
    await expect(waitForNpmVersion("0.2.3", deps)).rejects.toThrow(
      "spawn timeout",
    );
    expect(deps.sleep).not.toHaveBeenCalled();
  });

  it.each([
    0,
    -1,
    Number.POSITIVE_INFINITY,
  ])("rejects an invalid polling limit %s before querying npm", async (limit) => {
    const deps = harness();
    await expect(
      waitForNpmVersion("0.2.3", { ...deps, timeoutMs: limit }),
    ).rejects.toThrow("positive and finite");
    await expect(
      waitForNpmVersion("0.2.3", { ...deps, intervalMs: limit }),
    ).rejects.toThrow("positive and finite");
    expect(deps.query).not.toHaveBeenCalled();
  });
});
