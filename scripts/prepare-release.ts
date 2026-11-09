import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readNpmPack, readNpmVersion } from "./npm-json";
import { parseManifest, planRelease, planTaggedRelease } from "./release-plan";

const root = join(__dirname, "..");
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const current = parseManifest(
  JSON.parse(readFileSync(join(root, "postal-data.json"), "utf8")),
);
const publishedVersion = readNpmVersion(
  execFileSync("npm", ["view", "yubin@latest", "version", "--json"], {
    encoding: "utf8",
  }),
);

// npm pack verifies registry integrity; registry/download errors must fail the run.
// Only the absent manifest in legacy releases is treated as a first update.
const temp = mkdtempSync(join(tmpdir(), "yubin-published-"));
let published = null;
try {
  const packed = readNpmPack(
    execFileSync(
      "npm",
      [
        "pack",
        `yubin@${publishedVersion}`,
        "--json",
        "--ignore-scripts",
        "--pack-destination",
        temp,
      ],
      { encoding: "utf8" },
    ),
  );
  const archive = join(temp, packed.filename);
  const files = execFileSync("tar", ["-tf", archive], {
    encoding: "utf8",
  }).split("\n");
  if (files.includes("package/postal-data.json")) {
    published = parseManifest(
      JSON.parse(
        execFileSync("tar", ["-xOf", archive, "package/postal-data.json"], {
          encoding: "utf8",
        }),
      ),
    );
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}

const plan =
  process.env.GITHUB_EVENT_NAME === "push"
    ? planTaggedRelease(
        pkg.version,
        publishedVersion,
        current,
        published,
        process.env.GITHUB_REF_NAME ?? "",
      )
    : planRelease(pkg.version, publishedVersion, current, published);

if (process.argv.includes("--dry-run")) {
  console.log(JSON.stringify({ publishedVersion, ...plan }, null, 2));
} else {
  pkg.version = plan.version;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `publish=${plan.publish}\nversion=${plan.version}\n`,
    );
  }
  console.log(`npm latest: ${publishedVersion}; plan: ${JSON.stringify(plan)}`);
}
