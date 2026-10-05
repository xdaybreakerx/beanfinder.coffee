export const PACKAGE_PATH = "app/package.json";
export const LOCK_PATH = "app/package-lock.json";

// Match npm's stable version shape. Data PRs must not silently promote prereleases.
export function nextPatchVersion(version: unknown): string {
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error("Automated data PRs require a stable major.minor.patch package version");
  }
  const [major, minor, patch] = version.split(".").map(Number);
  if (![major, minor, patch + 1].every(Number.isSafeInteger)) throw new Error("Package version exceeds the supported range");
  return `${major}.${minor}.${patch + 1}`;
}

export function patchReleaseFiles(files: Record<string, string>) {
  const pkg = JSON.parse(files[PACKAGE_PATH]);
  const lock = JSON.parse(files[LOCK_PATH]);
  const rootPackage = lock.packages?.[""];
  if (!rootPackage || lock.version !== pkg.version || rootPackage.version !== pkg.version || lock.name !== pkg.name || rootPackage.name !== pkg.name) {
    throw new Error("Package and lockfile root versions/names must match before proposing a release");
  }
  const version = nextPatchVersion(pkg.version);
  const previousVersion: string = pkg.version;
  pkg.version = version;
  lock.version = version;
  rootPackage.version = version;
  const contents: Record<string, string> = {};
  for (const [path, document] of [[PACKAGE_PATH, pkg], [LOCK_PATH, lock]] as const) {
    const indent = files[path].match(/\n( +)"/)?.[1].length ?? 2;
    contents[path] = JSON.stringify(document, null, indent) + (files[path].endsWith("\n") ? "\n" : "");
  }
  return { previousVersion, version, contents };
}
