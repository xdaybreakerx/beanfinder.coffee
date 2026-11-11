import { readFile, appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { setTimeout } from "node:timers/promises";
import { LOCK_PATH, PACKAGE_PATH, readReleaseVersion } from "../server/release-version.ts";

const productionUrl = "https://beanfinder.coffee/release.json";

export async function publishRelease({ repository, sha, token, version, fetch: request = fetch, wait = ms => setTimeout(ms), attempts = 60 }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "") || !/^[a-f\d]{40}$/.test(sha ?? "") || !token) {
    throw new Error("Release publication requires a repository, full commit SHA and GitHub token.");
  }
  const tag = `v${version}`;
  const api = async (path, { method = "GET", body, allowMissing = false } = {}) => {
    const response = await request(`https://api.github.com/repos/${repository}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub ${method} ${path} failed: HTTP ${response.status}`);
    return response.json();
  };

  // Confirm an existing lightweight or annotated tag before reusing it. Never move tags.
  const ref = await api(`git/ref/tags/${tag}`, { allowMissing: true });
  if (ref) {
    let object = ref.object;
    for (let depth = 0; object.type === "tag" && depth < 10; depth++) {
      object = (await api(`git/tags/${object.sha}`)).object;
    }
    if (object.type !== "commit") throw new Error(`Cannot resolve ${tag} to a commit.`);
    if (object.sha !== sha) {
      // Explanation-only form PRs keep their version and need no new release.
      // The old tag must still be an ancestor of this commit.
      const comparison = await api(`compare/${object.sha}...${sha}`);
      if (comparison.status !== "ahead") throw new Error(`${tag} already points to another release history.`);
      console.log(`${tag} already exists on an earlier commit; no version change to release.`);
      return { status: "unchanged", tag };
    }
    const existing = await api(`releases/tags/${tag}`, { allowMissing: true });
    if (existing) {
      if (existing.draft || existing.prerelease) throw new Error(`${tag} exists but is not a published stable release.`);
      console.log(`${tag} is already published.`);
      return { status: "existing", tag, url: existing.html_url };
    }
  }

  // CI and Netlify run independently. Only publish a commit observed on production.
  let deployed = false;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await request(`${productionUrl}?commit=${sha}&attempt=${attempt}`, {
        cache: "no-store", signal: AbortSignal.timeout(10_000),
      });
      const stamp = response.ok ? await response.json() : null;
      if (stamp?.commit === sha && stamp.version === version && stamp.context === "production") {
        deployed = true;
        break;
      }
    } catch {
      // A temporary outage or old deployment without the stamp may recover on the next poll.
    }
    console.log(`Waiting for production ${tag} at ${sha} (${attempt + 1}/${attempts}).`);
    if (attempt + 1 < attempts) await wait(15_000);
  }
  if (!deployed) throw new Error(`Production did not serve ${tag} at ${sha}. Check Netlify, then rerun the workflow. No release was created.`);

  const release = await api("releases", {
    method: "POST",
    body: { tag_name: tag, target_commitish: sha, name: tag, draft: false, prerelease: false, generate_release_notes: true, make_latest: "legacy" },
  });
  console.log(`Published ${tag}: ${release.html_url}`);
  return { status: "published", tag, url: release.html_url };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL("../../../", import.meta.url);
  const files = Object.fromEntries(await Promise.all([PACKAGE_PATH, LOCK_PATH].map(async path => [path, await readFile(new URL(path, root), "utf8")])));
  const result = await publishRelease({
    repository: process.env.GITHUB_REPOSITORY,
    sha: process.env.GITHUB_SHA,
    token: process.env.GITHUB_TOKEN,
    version: readReleaseVersion(files),
  });
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `Release ${result.tag}: ${result.status}${result.url ? ` — ${result.url}` : ""}\n`);
  }
}
