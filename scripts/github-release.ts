import { execFileSync, spawnSync } from "node:child_process";
import { readNpmPackage } from "./npm-json";

// npm records the publishing commit as gitHead. Using today's HEAD would tag
// unrelated code if release creation is retried after main has advanced.
const requestedVersion = process.env.VERSION ?? "latest";
const published = readNpmPackage(
  execFileSync(
    "npm",
    // Selecting fields can return a scalar when a legacy field is missing.
    ["view", `yubin@${requestedVersion}`, "--json", "--prefer-online"],
    { encoding: "utf8" },
  ),
);
const tag = `v${published.version}`;
const existing = spawnSync("gh", ["release", "view", tag], {
  encoding: "utf8",
});
if (existing.error) throw existing.error;
if (existing.status === 0) {
  console.log(`GitHub Release ${tag} already exists`);
} else {
  // Network/auth/server errors must not be mistaken for a missing release.
  if (!/HTTP 404|release not found/i.test(existing.stderr)) {
    throw new Error(existing.stderr || "Could not inspect GitHub Release");
  }
  if (!published.gitHead || !/^[0-9a-f]{40}$/i.test(published.gitHead)) {
    throw new Error(
      `npm ${tag} has no valid publishing commit; refusing HEAD fallback`,
    );
  }
  execFileSync(
    "gh",
    [
      "release",
      "create",
      tag,
      "--target",
      published.gitHead,
      "--generate-notes",
    ],
    { stdio: "inherit" },
  );
}
