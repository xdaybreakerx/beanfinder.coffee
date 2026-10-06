// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const fixtures: string[] = [];
afterEach(() => { for (const path of fixtures.splice(0)) rmSync(path, { recursive: true, force: true }); });

describe("form PR release validation in an Actions checkout", () => {
  it.each([
    { base: "1.0.0", proposed: "1.0.1", changesData: true, succeeds: true },
    { base: "1.0.1", proposed: "1.0.1", changesData: true, succeeds: false },
    { base: "1.0.0", proposed: "1.0.0", changesData: false, succeeds: true },
  ])("checks $proposed against $base (data change: $changesData)", ({ base, proposed, changesData, succeeds }) => {
    const temp = mkdtempSync(join(tmpdir(), "beanfinder-release-check-"));
    fixtures.push(temp);
    const repo = join(temp, "source");
    const checkout = join(temp, "checkout");
    mkdirSync(repo);
    const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, stdio: "pipe" });
    git("init", "-b", "main");
    git("config", "user.name", "Release Check Fixture");
    git("config", "user.email", "fixture@example.invalid");
    git("config", "commit.gpgSign", "false");
    git("config", "core.hooksPath", "/dev/null");
    for (const path of ["app/src/scripts", "app/src/server", "app/src/data"]) mkdirSync(join(repo, path), { recursive: true });
    copyFileSync(new URL("../scripts/validate-release.mjs", import.meta.url), join(repo, "app/src/scripts/validate-release.mjs"));
    copyFileSync(new URL("./release-version.ts", import.meta.url), join(repo, "app/src/server/release-version.ts"));
    const writeVersions = (version: string) => {
      writeFileSync(join(repo, "app/package.json"), JSON.stringify({ name: "fixture", type: "module", version }));
      writeFileSync(join(repo, "app/package-lock.json"), JSON.stringify({ name: "fixture", version, packages: { "": { name: "fixture", version } } }));
    };
    writeVersions(base);
    for (const name of ["coffee-roasters", "coffee-roasters-multi"]) writeFileSync(join(repo, `app/src/data/${name}.json`), "[]");
    git("add", ".");
    git("commit", "-m", "Current main");
    git("switch", "-c", "forms/fixture");
    writeVersions(proposed);
    if (changesData) writeFileSync(join(repo, "app/src/data/coffee-roasters.json"), '[{"Name":"Fixture"}]');
    else writeFileSync(join(repo, "notes.txt"), "Explanation only");
    git("add", ".");
    git("commit", "-m", "Form proposal");
    git("switch", "main");
    git("merge", "--no-ff", "forms/fixture", "-m", "PR test merge");
    git("clone", "--depth", "2", pathToFileURL(repo).href, checkout);
    expect(execFileSync("git", ["rev-parse", "--is-shallow-repository"], { cwd: checkout, encoding: "utf8" }).trim()).toBe("true");
    const result = spawnSync(process.execPath, ["app/src/scripts/validate-release.mjs"], {
      cwd: checkout, encoding: "utf8",
      env: { ...process.env, GITHUB_EVENT_NAME: "pull_request", DATA_PR_BRANCH: "forms/fixture" },
    });
    expect(result.status).toBe(succeeds ? 0 : 1);
    expect(succeeds ? result.stdout : result.stderr).toContain(succeeds ? `root version ${proposed}` : "must be 1.0.2 against current main");
  });
});
