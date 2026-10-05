// @vitest-environment node
import { describe, expect, it } from "vitest";
import { LOCK_PATH, nextPatchVersion, PACKAGE_PATH, patchReleaseFiles } from "./release-version";

const pkg = { name: "test-site", version: "1.0.0", dependencies: { astro: "^7.3.5" } };
const lock = { name: pkg.name, version: pkg.version, lockfileVersion: 3, packages: { "": { ...pkg }, "node_modules/astro": { version: "7.3.5", integrity: "existing-integrity" } } };
const files = () => ({ [PACKAGE_PATH]: JSON.stringify(pkg, null, 2) + "\n", [LOCK_PATH]: JSON.stringify(lock, null, 2) + "\n" });

describe("data PR release versioning", () => {
  it.each([["1.0.0", "1.0.1"], ["1.1.0", "1.1.1"], ["1.1.9", "1.1.10"], ["1.9.99", "1.9.100"], ["0.0.0", "0.0.1"]])("bumps %s to %s", (previous, next) => {
    expect(nextPatchVersion(previous)).toBe(next);
  });
  it.each([undefined, "v1.0.0", "1.0", "01.0.0", "1.0.0-beta.1", "1.0.0+build", "9007199254740992.0.0", "1.0.9007199254740991"])("rejects unsupported version %s", version => {
    expect(() => nextPatchVersion(version)).toThrow();
  });
  it("updates all root versions and preserves dependency versions and lock metadata", () => {
    const result = patchReleaseFiles(files());
    expect(result).toMatchObject({ previousVersion: "1.0.0", version: "1.0.1" });
    expect(JSON.parse(result.contents[PACKAGE_PATH])).toEqual({ ...pkg, version: "1.0.1" });
    expect(JSON.parse(result.contents[LOCK_PATH])).toEqual({ ...lock, version: "1.0.1", packages: { ...lock.packages, "": { ...pkg, version: "1.0.1" } } });
    expect(result.contents[LOCK_PATH].endsWith("\n")).toBe(true);
  });
  it.each(["top-level", "package-root"])("rejects a mismatched %s lockfile version", position => {
    const input = files();
    const mismatched = JSON.parse(input[LOCK_PATH]);
    if (position === "top-level") mismatched.version = "0.9.0";
    else mismatched.packages[""].version = "0.9.0";
    input[LOCK_PATH] = JSON.stringify(mismatched);
    expect(() => patchReleaseFiles(input)).toThrow("must match");
  });
  it("rejects a lockfile without root package metadata", () => {
    const input = files();
    input[LOCK_PATH] = JSON.stringify({ name: pkg.name, version: pkg.version, packages: {} });
    expect(() => patchReleaseFiles(input)).toThrow("must match");
  });
});
