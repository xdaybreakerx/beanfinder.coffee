// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { publishRelease } from "../scripts/publish-release.mjs";

const sha = "a".repeat(40);
const oldSha = "b".repeat(40);
const options = { repository: "owner/repo", sha, token: "fixture-token", version: "2.0.4", attempts: 2 };
const stamp = { version: options.version, commit: sha, context: "production" };
const notFound = () => new Response(null, { status: 404 });

function fixture({ ref = null as object | null, release = null as object | null, stamps = [stamp] as object[], comparison = "ahead" } = {}) {
  const requests: { url: string; init: RequestInit }[] = [];
  let stampIndex = 0;
  const fetcher = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push({ url, init });
    if (url.startsWith("https://beanfinder.coffee/")) {
      return Response.json(stamps[Math.min(stampIndex++, stamps.length - 1)]);
    }
    const path = new URL(url).pathname;
    if (path.includes("/git/ref/")) return ref ? Response.json({ object: ref }) : notFound();
    if (path.includes("/git/tags/")) return Response.json({ object: { type: "commit", sha } });
    if (path.includes("/compare/")) return Response.json({ status: comparison });
    if (path.includes("/releases/tags/")) return release ? Response.json(release) : notFound();
    if (path.endsWith("/releases") && init.method === "POST") return Response.json({ html_url: "https://github.com/owner/repo/releases/tag/v2.0.4" });
    throw new Error(`Unexpected request: ${url}`);
  });
  const wait = vi.fn(async () => undefined);
  return { fetcher, wait, requests, run: () => publishRelease({ ...options, fetch: fetcher, wait }) };
}

describe("release publication after verification", () => {
  it("waits for the exact production commit and creates its tag with generated release notes", async () => {
    const f = fixture({ stamps: [{ ...stamp, commit: oldSha }, stamp] });
    expect(await f.run()).toMatchObject({ status: "published", tag: "v2.0.4" });
    expect(f.wait).toHaveBeenCalledOnce();
    const publication = f.requests.find(r => r.init.method === "POST")!;
    expect(JSON.parse(publication.init.body as string)).toMatchObject({
      tag_name: "v2.0.4", target_commitish: sha, draft: false, prerelease: false, generate_release_notes: true,
    });
    for (const { init } of f.requests.filter(r => r.url.startsWith("https://beanfinder.coffee/"))) {
      expect(init.headers).toBeUndefined(); // GitHub credentials never go to the live site.
    }
  });

  it.each([
    { ...stamp, commit: oldSha },
    { ...stamp, version: "2.0.3" },
    { ...stamp, context: "deploy-preview" },
  ])("does not publish a mismatched deployment: %j", async badStamp => {
    const f = fixture({ stamps: [badStamp] });
    await expect(f.run()).rejects.toThrow("No release was created");
    expect(f.requests.some(r => r.init.method === "POST")).toBe(false);
  });

  it.each(["commit", "tag"])("safely retries an already published %s tag", async type => {
    const f = fixture({ ref: { type, sha }, release: { html_url: "https://github.com/release", draft: false, prerelease: false } });
    expect(await f.run()).toMatchObject({ status: "existing" });
    expect(f.requests.some(r => r.init.method === "POST")).toBe(false);
  });

  it("recovers when the tag exists but creating the release previously failed", async () => {
    const f = fixture({ ref: { type: "commit", sha } });
    expect(await f.run()).toMatchObject({ status: "published" });
  });

  it("skips a version already released on an ancestor for explanation-only form PRs", async () => {
    const f = fixture({ ref: { type: "commit", sha: oldSha } });
    expect(await f.run()).toMatchObject({ status: "unchanged" });
    expect(f.requests.some(r => r.init.method === "POST")).toBe(false);
  });

  it("refuses to reuse a tag from another history", async () => {
    const f = fixture({ ref: { type: "commit", sha: oldSha }, comparison: "diverged" });
    await expect(f.run()).rejects.toThrow("another release history");
    expect(f.requests.some(r => r.init.method === "POST")).toBe(false);
  });

  it("fails visibly on API errors without publishing", async () => {
    await expect(publishRelease({ ...options, fetch: async () => new Response(null, { status: 403 }) })).rejects.toThrow("HTTP 403");
  });
});
