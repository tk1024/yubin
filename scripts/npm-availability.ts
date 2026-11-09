import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { readNpmPackage } from "./npm-json";

type QueryResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

type Options = {
  timeoutMs?: number;
  intervalMs?: number;
  query?: (version: string) => QueryResult;
  sleep?: (ms: number) => Promise<unknown>;
  now?: () => number;
  log?: (message: string) => void;
};

/** Call only after this run's successful publish; E404 alone is not proof of upload. */
export async function waitForNpmVersion(
  version: string,
  options: Options = {},
) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Invalid version");
  const {
    timeoutMs = 30 * 60_000,
    intervalMs = 30_000,
    query = (target) =>
      spawnSync(
        "npm",
        ["view", `yubin@${target}`, "--json", "--prefer-online"],
        { encoding: "utf8", timeout: 30_000 },
      ),
    sleep = setTimeout,
    now = Date.now,
    log = console.log,
  } = options;
  if (
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isFinite(intervalMs) ||
    intervalMs <= 0
  ) {
    throw new Error("Availability wait limits must be positive and finite");
  }
  const start = now();
  const deadline = start + timeoutMs;
  const timedOut = () =>
    new Error(
      `npm accepted yubin@${version}, but availability was not confirmed within ${timeoutMs / 60_000} minutes. Do not republish while processing; check availability before rerunning the workflow.`,
    );

  for (let attempt = 1; ; attempt++) {
    if (attempt > 1 && now() >= deadline) throw timedOut();
    const result = query(version);
    if (result.error) throw result.error;
    if (result.status === 0) {
      const published = readNpmPackage(result.stdout);
      if (published.version !== version) {
        throw new Error("npm returned an unexpected version");
      }
      log(`yubin@${version} is available after ${now() - start} ms`);
      return { attempts: attempt, elapsedMs: now() - start };
    }

    let code: unknown;
    try {
      code = JSON.parse(result.stdout).error?.code;
    } catch {
      // A failed CLI invocation can have no JSON output; never assume it is E404.
    }
    if (code !== "E404") {
      throw new Error(
        `npm availability lookup failed (status ${result.status})`,
      );
    }
    if (now() >= deadline) throw timedOut();
    log(`npm accepted yubin@${version}; still processing, waiting to retry`);
    await sleep(Math.min(intervalMs, deadline - now()));
  }
}
