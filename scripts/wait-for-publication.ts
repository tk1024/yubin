import { waitForNpmVersion } from "./npm-availability";

waitForNpmVersion(process.env.VERSION ?? "").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
