// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@netlify/functions";
import handler from "../../netlify/functions/submission-created.mts";
import { createSubmissionPR, parseSubmission, proposeChange, SubmissionError } from "./form-submission-prs";
import { LOCK_PATH, PACKAGE_PATH } from "./release-version";

const ROASTERS = "app/src/data/coffee-roasters.json";
const MULTI = "app/src/data/coffee-roasters-multi.json";
const existing = { businessId: "biz-existing", provenance: { source: "legacy-directory" as const, verifiedAt: null }, Name: "Existing Coffee", Website: "https://existing.coffee/", State: "VIC, NSW", hasCafe: true, multiRoaster: false };
const multi = { businessId: "biz-club", provenance: { source: "legacy-directory" as const, verifiedAt: null }, Name: "Coffee Club", Website: "https://club.coffee/", State: "all", hasCafe: false, multiRoaster: true };
const data = () => ({
  [ROASTERS]: JSON.stringify([existing], null, 2), [MULTI]: JSON.stringify([multi], null, 4),
  [PACKAGE_PATH]: JSON.stringify({ name: "test-site", version: "1.0.0" }),
  [LOCK_PATH]: JSON.stringify({ name: "test-site", version: "1.0.0", lockfileVersion: 3, packages: { "": { name: "test-site", version: "1.0.0" } } }),
});
function payload(overrides: Record<string, unknown> = {}, id = "submission-123") {
  return {
    id, form_name: "roaster-form",
    data: { "form-name": "roaster-form", "submission-type": "recommendation", "roaster-name": "New Coffee", "roaster-website": "https://new.coffee", state: "SA", "has-cafe": "false", "multi-roaster": "false", details: "Great beans", ...overrides },
  };
}

// Models GitHub's immutable commits and atomic branch creation, rather than prescribing request order.
function github() {
  const commits = new Map<string, Record<string, string>>([["main-sha", data()]]);
  const refs = new Map([["main", "main-sha"]]);
  const trees = new Map<string, Record<string, string>>();
  const prs: Array<{ head: string; html_url: string; body: string; state: string }> = [];
  let failPR = false;
  let sequence = 0;
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    expect(url.origin).toBe("https://api.github.com");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-token" });
    const path = decodeURIComponent(url.pathname.replace("/repos/xdaybreakerx/beanfinder.coffee", ""));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const response = (body: unknown, status = 200) => Response.json(body, { status });
    if (path === "/pulls" && init?.method === "GET") return response(prs.filter(pr => url.searchParams.get("head") === `xdaybreakerx:${pr.head}`));
    if (path.startsWith("/git/ref/heads/")) {
      const sha = refs.get(path.slice("/git/ref/heads/".length));
      return sha ? response({ object: { sha } }) : response({}, 404);
    }
    if (path.startsWith("/contents/")) {
      const ref = url.searchParams.get("ref")!;
      const content = commits.get(refs.get(ref) ?? ref)?.[path.slice("/contents/".length)];
      return content === undefined ? response({}, 404) : response({ encoding: "base64", content: Buffer.from(content).toString("base64") });
    }
    if (path.startsWith("/git/commits/")) return response({ tree: { sha: path.slice("/git/commits/".length) } });
    if (path === "/git/trees") {
      const sha = `tree-${++sequence}`;
      const files = { ...commits.get(body.base_tree) };
      for (const entry of body.tree) files[entry.path] = entry.content;
      trees.set(sha, files);
      return response({ sha }, 201);
    }
    if (path === "/git/commits") {
      const sha = `commit-${++sequence}`;
      commits.set(sha, trees.get(body.tree)!);
      return response({ sha }, 201);
    }
    if (path === "/git/refs") {
      const branch = body.ref.replace("refs/heads/", "");
      if (refs.has(branch)) return response({}, 422);
      refs.set(branch, body.sha);
      return response({}, 201);
    }
    if (path === "/pulls" && init?.method === "POST") {
      if (failPR) { failPR = false; return response({}, 503); }
      if (prs.some(pr => pr.head === body.head)) return response({}, 422);
      prs.push({ head: body.head, body: body.body, state: "open", html_url: "https://github.com/test/pull/1" });
      return response(prs.at(-1), 201);
    }
    throw new Error(`Unexpected GitHub request ${init?.method} ${path}`);
  }) as unknown as typeof fetch;
  return { fetcher, commits, refs, prs, failNextPR: () => { failPR = true; } };
}

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("submission validation and directory changes", () => {
  it("normalizes a recommendation and retains only public fields", () => {
    const input = payload({ email: "private@example.com", ip: "127.0.0.1", "bot-field": "" });
    const submission = parseSubmission(input)!;
    const proposal = proposeChange(submission, data())!;
    expect(JSON.parse(proposal.contents[ROASTERS])).toContainEqual(expect.objectContaining({ Name: "New Coffee", Website: "https://new.coffee/", State: "SA", hasCafe: false, multiRoaster: false }));
    const receipt = proposal.contents[".github/form-submissions/submission-123.json"];
    expect(receipt).not.toContain("private@example.com");
    expect(receipt).not.toContain("127.0.0.1");
    expect(proposal.contents[MULTI]).toBeUndefined();
    expect(proposal.roaster.provenance).toEqual({
      source: "community-submission", receipt: ".github/form-submissions/submission-123.json",
      proposedAt: expect.any(String), verifiedAt: null,
    });
    if (proposal.roaster.provenance.source !== 'community-submission') throw new Error('Expected submission provenance');
    expect(Number.isFinite(Date.parse(proposal.roaster.provenance.proposedAt))).toBe(true);
  });

  it.each([
    [{ "roaster-website": "javascript:alert(1)" }],
    [{ "roaster-website": "https://user:password@example.com" }],
    [{ state: "NZ" }],
    [{ state: "all", "multi-roaster": "false" }],
    [{ "has-cafe": "on" }],
    [{ "has-cafe": "" }],
    [{ "submission-type": "other" }],
    [{ "roaster-name": "a\nb" }],
    [{ "roaster-name": "a".repeat(121) }],
    [{ "submission-type": "issue", details: "" }],
  ])("rejects invalid submission fields %j", (overrides) => {
    expect(() => parseSubmission(payload(overrides))).toThrow(SubmissionError);
  });

  it("rejects unsafe IDs and ignores other forms and honeypots", () => {
    expect(() => parseSubmission(payload({}, "../main"))).toThrow(SubmissionError);
    expect(parseSubmission({ ...payload(), form_name: "contact" })).toBeUndefined();
    expect(parseSubmission(payload({ "bot-field": "spam" }))).toBeUndefined();
  });

  it("detects existing recommendations despite www, scheme and trailing slash differences", () => {
    const submission = parseSubmission(payload({ "roaster-name": "Existing Coffee", "roaster-website": "http://www.existing.coffee" }))!;
    expect(proposeChange(submission, data())).toBeUndefined();
  });

  it("preserves unspecified correction flags and multiple states, and finds a changed website", () => {
    const submission = parseSubmission(payload({ "submission-type": "issue", "roaster-name": "Renamed Coffee", "roaster-website": "https://renamed.coffee", "original-website": existing.Website, state: "", "has-cafe": "", "multi-roaster": "", details: "Changed name and website" }))!;
    expect(proposeChange(submission, data())!.roaster).toMatchObject({ ...existing, provenance: expect.objectContaining({ source: "community-submission" }), Name: "Renamed Coffee", Website: "https://renamed.coffee/" });
  });

  it("moves a corrected listing between directory files without duplicating it", () => {
    const submission = parseSubmission(payload({ "submission-type": "issue", "roaster-name": multi.Name, "roaster-website": multi.Website, state: "WA", "multi-roaster": "false" }))!;
    const proposal = proposeChange(submission, data())!;
    expect(JSON.parse(proposal.contents[MULTI])).toEqual([]);
    expect(JSON.parse(proposal.contents[ROASTERS])).toContainEqual(expect.objectContaining({ ...multi, provenance: expect.objectContaining({ source: "community-submission" }), State: "WA", multiRoaster: false }));
  });

  it("rejects ambiguous and unmatched corrections rather than choosing a listing", () => {
    const correction = parseSubmission(payload({ "submission-type": "issue", "roaster-name": existing.Name, "roaster-website": multi.Website }))!;
    expect(() => proposeChange(correction, data())).toThrow("Multiple roasters match");
    expect(() => proposeChange(parseSubmission(payload({ "submission-type": "issue" }))!, data())).toThrow("No existing roaster");
    expect(() => proposeChange({ ...correction, originalWebsite: existing.Website }, data())).toThrow("belongs to another listing");
  });

  it("opens an explanation-only proposal when a correction needs manual editing", () => {
    const submission = parseSubmission(payload({ "submission-type": "issue", "roaster-name": existing.Name, "roaster-website": existing.Website, state: "", "has-cafe": "", "multi-roaster": "", details: "The cafe has moved to another address" }))!;
    const proposal = proposeChange(submission, data())!;
    expect(proposal.explanationOnly).toBe(true);
    expect(proposal.roaster.provenance).toEqual(existing.provenance);
    expect(Object.keys(proposal.contents)).toEqual([".github/form-submissions/submission-123.json"]);
  });

  it('keeps the business ID and previous website across corrections and retries', () => {
    const first = proposeChange(parseSubmission(payload({ 'submission-type': 'issue', 'roaster-name': 'Renamed', 'roaster-website': 'https://renamed.coffee/', 'original-website': existing.Website }))!, data())!;
    expect(first.roaster.businessId).toBe(existing.businessId);
    expect(first.roaster.websiteAliases).toEqual([existing.Website]);
    const files = { ...data(), ...first.contents };
    const second = proposeChange(parseSubmission(payload({ 'submission-type': 'issue', 'roaster-name': 'Another name', 'roaster-website': 'https://renamed.coffee/', 'original-website': existing.Website }))!, files)!;
    expect(second.roaster.businessId).toBe(existing.businessId);
    expect(second.roaster.websiteAliases).toEqual([existing.Website]);
    const restore = proposeChange(parseSubmission(payload({ 'submission-type': 'issue', 'roaster-name': 'Another name', 'roaster-website': existing.Website, 'original-website': 'https://renamed.coffee/' }))!, { ...files, ...second.contents })!;
    expect(restore.roaster.websiteAliases).toEqual(['https://renamed.coffee/']);
  });

  it('mints a stable ID from the submission and validates existing data before proposing', () => {
    const parsed = parseSubmission(payload())!;
    expect(proposeChange(parsed, data())!.roaster.businessId).toBe('biz-form-submission-123');
    expect(proposeChange(parsed, data())!.roaster.businessId).toBe('biz-form-submission-123');
    expect(() => proposeChange(parsed, { ...data(), [ROASTERS]: JSON.stringify([existing, existing]) })).toThrow('business ID');
  });

  it('requires review for distinct brands on the same domain', () => {
    expect(() => proposeChange(parseSubmission(payload({ 'roaster-website': 'https://existing.coffee/other-brand' }))!, data())).toThrow('Same-domain business requires manual review');
    const files = { ...data(), [ROASTERS]: JSON.stringify([{ ...existing, websiteAliases: ['https://old.coffee/'] }]) };
    expect(() => proposeChange(parseSubmission(payload({ 'roaster-website': 'https://old.coffee/other-brand' }))!, files)).toThrow('Same-domain business requires manual review');
    expect(() => proposeChange(parseSubmission(payload({ 'roaster-name': existing.Name }))!, data())).toThrow('Same-name business with a different website requires manual review');
  });

  it('clears seller-only options on reclassification while retaining identity', () => {
    const input = { ...data(), [MULTI]: JSON.stringify([{ ...multi, subscription: true, selection: ['choose'], brew: ['filter'] }]) };
    const proposal = proposeChange(parseSubmission(payload({ 'submission-type': 'issue', 'roaster-name': multi.Name, 'roaster-website': multi.Website, state: 'WA', 'multi-roaster': 'false' }))!, input)!;
    expect(proposal.roaster.businessId).toBe(multi.businessId);
    expect(proposal.roaster.subscription).toBeUndefined();
    expect(proposal.roaster.selection).toBeUndefined();
    expect(proposal.roaster.brew).toBeUndefined();
  });
});

describe("GitHub ingestion", () => {
  it("atomically creates a branch and review PR without modifying main or disclosing raw metadata", async () => {
    const gh = github();
    const result = await createSubmissionPR(payload({ email: "private@example.com", details: "<script>alert(1)</script> @reviewer" }), { token: "test-token", fetch: gh.fetcher });
    expect(result.status).toBe("created");
    expect(gh.refs.get("main")).toBe("main-sha");
    const files = gh.commits.get(gh.refs.get("forms/submission-123")!)!;
    expect(JSON.parse(files[ROASTERS])).toHaveLength(2);
    expect(JSON.parse(files[PACKAGE_PATH]).version).toBe("1.0.1");
    expect(JSON.parse(files[LOCK_PATH]).packages[""].version).toBe("1.0.1");
    expect(gh.prs[0].body).toContain("`v1.0.0` → `v1.0.1`");
    expect(gh.prs[0].body).toContain("&lt;script&gt;");
    expect(gh.prs[0].body).toContain("&#64;reviewer");
    expect(gh.prs[0].body).not.toContain("private@example.com");
  });

  it("reuses an existing open or closed PR on repeated delivery", async () => {
    const gh = github();
    const options = { token: "test-token", fetch: gh.fetcher };
    await createSubmissionPR(payload(), options);
    expect((await createSubmissionPR(payload(), options)).status).toBe("existing");
    gh.prs[0].state = "closed";
    expect((await createSubmissionPR(payload(), options)).status).toBe("existing");
    expect(gh.prs).toHaveLength(1);
    expect(gh.commits.size).toBe(2);
    expect(gh.prs[0].body).toContain("`v1.0.0` → `v1.0.1`");
  });

  it("recovers from failure after branch creation without overwriting reviewer edits", async () => {
    const gh = github();
    const options = { token: "test-token", fetch: gh.fetcher };
    gh.failNextPR();
    await expect(createSubmissionPR(payload(), options)).rejects.toThrow("HTTP 503");
    const branchSha = gh.refs.get("forms/submission-123");
    expect((await createSubmissionPR(payload(), options)).status).toBe("created");
    expect(gh.refs.get("forms/submission-123")).toBe(branchSha);
    expect(gh.commits.size).toBe(2);
  });

  it("refuses to reuse a branch whose receipt differs", async () => {
    const gh = github();
    gh.failNextPR();
    const options = { token: "test-token", fetch: gh.fetcher };
    await expect(createSubmissionPR(payload(), options)).rejects.toThrow();
    await expect(createSubmissionPR(payload({ "roaster-name": "Different" }), options)).rejects.toThrow("receipt differs");
    expect(gh.prs).toHaveLength(0);
  });

  it("handles concurrent duplicate deliveries and creates only one PR", async () => {
    const gh = github();
    const options = { token: "test-token", fetch: gh.fetcher };
    const results = await Promise.all([createSubmissionPR(payload(), options), createSubmissionPR(payload(), options)]);
    expect(results.map(result => result.status).sort()).toEqual(["created", "existing"]);
    expect(gh.prs).toHaveLength(1);
  });

  it("does not create a branch for an already listed recommendation", async () => {
    const gh = github();
    expect((await createSubmissionPR(payload({ "roaster-name": existing.Name, "roaster-website": existing.Website }), { token: "test-token", fetch: gh.fetcher })).status).toBe("duplicate");
    expect(gh.refs.size).toBe(1);
    expect(gh.prs).toHaveLength(0);
  });

  it("reads the main snapshot's current version rather than a deployed function's old version", async () => {
    const gh = github();
    const main = gh.commits.get("main-sha")!;
    main[PACKAGE_PATH] = JSON.stringify({ name: "test-site", version: "2.4.8" });
    main[LOCK_PATH] = JSON.stringify({ name: "test-site", version: "2.4.8", packages: { "": { name: "test-site", version: "2.4.8" } } });
    await createSubmissionPR(payload(), { token: "test-token", fetch: gh.fetcher });
    const files = gh.commits.get(gh.refs.get("forms/submission-123")!)!;
    expect(JSON.parse(files[PACKAGE_PATH]).version).toBe("2.4.9");
  });

  it("keeps explanation-only corrections unversioned", async () => {
    const gh = github();
    await createSubmissionPR(payload({ "submission-type": "issue", "roaster-name": existing.Name, "roaster-website": existing.Website, state: "", "has-cafe": "", "multi-roaster": "" }), { token: "test-token", fetch: gh.fetcher });
    const files = gh.commits.get(gh.refs.get("forms/submission-123")!)!;
    expect(files[PACKAGE_PATH]).toBe(data()[PACKAGE_PATH]);
    expect(files[LOCK_PATH]).toBe(data()[LOCK_PATH]);
    expect(gh.prs[0].body).not.toContain("Proposed patch version");
  });

  it("does not create a branch when release files are inconsistent", async () => {
    const gh = github();
    gh.commits.get("main-sha")![PACKAGE_PATH] = JSON.stringify({ name: "test-site", version: "1.0.2" });
    await expect(createSubmissionPR(payload(), { token: "test-token", fetch: gh.fetcher })).rejects.toThrow("must match");
    expect(gh.refs.size).toBe(1);
    expect(gh.prs).toHaveLength(0);
  });
});

describe("Netlify event boundary", () => {
  it("ignores preview events even when a token exists", async () => {
    vi.stubEnv("FORM_PR_GITHUB_TOKEN", "test-token");
    const fetcher = vi.spyOn(globalThis, "fetch");
    const response = await handler(new Request("https://example.com", { method: "POST", body: JSON.stringify({ payload: payload() }) }), { deploy: { context: "deploy-preview" } } as Context);
    expect(response.status).toBe(204);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails visibly when production credentials are missing", async () => {
    vi.stubEnv("FORM_PR_GITHUB_TOKEN", "");
    await expect(handler(new Request("https://example.com"), { deploy: { context: "production" } } as Context)).rejects.toThrow("FORM_PR_GITHUB_TOKEN");
  });
});
