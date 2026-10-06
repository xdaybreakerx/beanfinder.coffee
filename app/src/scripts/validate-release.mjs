import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { LOCK_PATH, PACKAGE_PATH, readReleaseVersion, validateDataRelease } from "../server/release-version.ts";

const rootUrl = new URL("../../../", import.meta.url);
const root = fileURLToPath(rootUrl);
const readWorking = path => readFile(new URL(path, rootUrl), "utf8");
const paths = [PACKAGE_PATH, LOCK_PATH];
const files = Object.fromEntries(await Promise.all(paths.map(async path => [path, await readWorking(path)])));
const version = readReleaseVersion(files);
if (process.env.GITHUB_EVENT_NAME === "pull_request" && process.env.DATA_PR_BRANCH?.startsWith("forms/")) {
  // Actions checks out the PR merge commit with depth 2: its first parent is current main.
  const readBase = path => execFileSync("git", ["show", `HEAD^1:${path}`], { cwd: root, encoding: "utf8" });
  const base = Object.fromEntries(paths.map(path => [path, readBase(path)]));
  const dataPaths = ["app/src/data/coffee-roasters.json", "app/src/data/coffee-roasters-multi.json"];
  const changed = await Promise.all(dataPaths.map(async path => (await readWorking(path)) !== readBase(path)));
  validateDataRelease(files, base, changed.some(Boolean));
}
console.log(`Validated package and lockfile root version ${version}.`);
