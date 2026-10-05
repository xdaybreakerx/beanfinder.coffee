const REPOSITORY = "xdaybreakerx/beanfinder.coffee";
const MAIN = "main";
const ROASTERS = "app/src/data/coffee-roasters.json";
const MULTI = "app/src/data/coffee-roasters-multi.json";
const STATES = new Set(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]);

type Roaster = { Name: string; Website: string; State: string; hasCafe: boolean; multiRoaster: boolean };
type Submission = {
  id: string;
  type: "recommendation" | "issue";
  name: string;
  website: string;
  originalWebsite?: string;
  state?: string;
  hasCafe?: boolean;
  multiRoaster?: boolean;
  details: string;
};
type Payload = { id?: unknown; form_name?: unknown; data?: Record<string, unknown> };

export class SubmissionError extends Error {}

function text(value: unknown, field: string, max: number, required = false): string {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string" || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) {
    throw new SubmissionError(`Invalid ${field}`);
  }
  const result = value.trim();
  if (required && !result) throw new SubmissionError(`Missing ${field}`);
  return result;
}

function website(value: unknown, field: string, required = false): string | undefined {
  const raw = text(value, field, 2048, required);
  if (!raw) return undefined;
  let url: URL;
  try { url = new URL(raw); } catch { throw new SubmissionError(`Invalid ${field}`); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new SubmissionError(`Invalid ${field}`);
  }
  url.hash = "";
  return url.href;
}

function flag(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new SubmissionError(`Invalid ${field}`);
}

export function parseSubmission(payload: Payload): Submission | undefined {
  const data = payload?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new SubmissionError("Missing form data");
  if ((payload.form_name ?? data["form-name"]) !== "roaster-form") return undefined;
  if (data["bot-field"]) return undefined;
  const id = text(payload.id, "submission ID", 80, true);
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new SubmissionError("Invalid submission ID");
  const type = data["submission-type"];
  if (type !== "recommendation" && type !== "issue") throw new SubmissionError("Invalid submission type");
  const name = text(data["roaster-name"], "roaster name", 120, true);
  if (/[\r\n]/.test(name)) throw new SubmissionError("Invalid roaster name");
  const state = text(data.state, "state", 80).toUpperCase();
  const states = state.split(",").map(s => s.trim());
  if (state && state !== "ALL" && (!states.every(s => STATES.has(s)) || new Set(states).size !== states.length)) {
    throw new SubmissionError("Invalid state");
  }
  const submission: Submission = {
    id, type, name,
    website: website(data["roaster-website"], "roaster website", true)!,
    originalWebsite: website(data["original-website"], "original website"),
    state: state ? (state === "ALL" ? "all" : states.join(", ")) : undefined,
    hasCafe: flag(data["has-cafe"], "cafe status"),
    multiRoaster: flag(data["multi-roaster"], "multi-roaster status"),
    details: text(data.details, "details", 2000, type === "issue"),
  };
  if (type === "recommendation" && (!submission.state || submission.hasCafe === undefined || submission.multiRoaster === undefined)) {
    throw new SubmissionError("Recommendations require state, cafe and multi-roaster status");
  }
  if (submission.state === "all" && submission.multiRoaster === false) {
    throw new SubmissionError("Select a state for an individual roaster");
  }
  return submission;
}

function identity(raw: string): string {
  const url = new URL(raw);
  return `${url.hostname.replace(/^www\./, "")}${url.port ? `:${url.port}` : ""}${url.pathname.replace(/\/+$/, "")}${url.search}`;
}

export function proposeChange(submission: Submission, files: Record<string, string>) {
  const datasets = [ROASTERS, MULTI].map(path => ({ path, records: JSON.parse(files[path]) as Roaster[] }));
  const entries = datasets.flatMap(dataset => dataset.records.map((roaster, index) => ({ dataset, roaster, index })));
  const url = identity(submission.originalWebsite ?? submission.website);
  const byWebsite = entries.filter(entry => identity(entry.roaster.Website) === url);
  const byName = entries.filter(entry => entry.roaster.Name.trim().toLowerCase() === submission.name.toLowerCase());
  const matches = submission.originalWebsite ? byWebsite : [...new Set([...byWebsite, ...byName])];
  if (matches.length > 1) throw new SubmissionError("Multiple roasters match; supply the original website");
  if (submission.type === "recommendation" && matches.length) return undefined;
  if (submission.type === "issue" && !matches.length) throw new SubmissionError("No existing roaster matches this correction");
  const match = matches[0];
  if (submission.type === "issue" && entries.some(entry => entry !== match && identity(entry.roaster.Website) === identity(submission.website))) {
    throw new SubmissionError("The proposed website belongs to another listing");
  }
  const roaster: Roaster = {
    ...match?.roaster,
    Name: submission.name,
    Website: submission.website,
    State: submission.state ?? match?.roaster.State!,
    hasCafe: submission.hasCafe ?? match?.roaster.hasCafe!,
    multiRoaster: submission.multiRoaster ?? match?.roaster.multiRoaster!,
  };
  if (roaster.State.toLowerCase() === "all" && !roaster.multiRoaster) throw new SubmissionError("Select a state for an individual roaster");
  const target = datasets.find(dataset => dataset.path === (roaster.multiRoaster ? MULTI : ROASTERS))!;
  const changed = new Set<string>();
  if (match && match.dataset === target) {
    target.records[match.index] = roaster;
    if (JSON.stringify(roaster) !== JSON.stringify(match.roaster)) changed.add(target.path);
  } else {
    if (match) {
      match.dataset.records.splice(match.index, 1);
      changed.add(match.dataset.path);
    }
    const index = target.records.findIndex(existing => existing.Name.localeCompare(roaster.Name, "en") > 0);
    target.records.splice(index === -1 ? target.records.length : index, 0, roaster);
    changed.add(target.path);
  }
  // Keep a correction's explanation reviewable even when its structured fields did not change.
  if (!changed.size && submission.type === "recommendation") return undefined;
  const contents: Record<string, string> = {};
  for (const path of changed) {
    const indent = files[path].match(/\n( +)\{/)?.[1].length ?? 2;
    contents[path] = JSON.stringify(datasets.find(dataset => dataset.path === path)!.records, null, indent) + (files[path].endsWith("\n") ? "\n" : "");
  }
  contents[receiptPath(submission.id)] = JSON.stringify({ submission, explanationOnly: !changed.size }, null, 2) + "\n";
  return { contents, roaster, explanationOnly: !changed.size };
}

function receiptPath(id: string) { return `.github/form-submissions/${id}.json`; }
function escapeMarkdown(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/@/g, "&#64;").replace(/[\\`*_{}\[\]()!|~]/g, "\\$&");
}

class GitHubError extends Error {
  status: number;
  constructor(status: number) {
    super(`GitHub API returned HTTP ${status}`);
    this.status = status;
  }
}

export async function createSubmissionPR(payload: Payload, options: { token: string; fetch?: typeof fetch }) {
  const submission = parseSubmission(payload);
  if (!submission) return { status: "ignored" };
  if (!options.token) throw new Error("FORM_PR_GITHUB_TOKEN is not configured");
  const fetcher = options.fetch ?? fetch;
  const branch = `forms/${submission.id}`;
  const root = `https://api.github.com/repos/${REPOSITORY}`;
  async function api(path: string, method = "GET", body?: unknown): Promise<any> {
    const response = await fetcher(`${root}${path}`, {
      method, redirect: "error", signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: `Bearer ${options.token}`, Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10", "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new GitHubError(response.status);
    return response.status === 204 ? undefined : response.json();
  }
  async function existingPR() {
    const prs = await api(`/pulls?state=all&head=${encodeURIComponent(`${REPOSITORY.split("/")[0]}:${branch}`)}&per_page=1`);
    return prs[0];
  }
  async function readFile(path: string, ref: string) {
    const file = await api(`/contents/${path}?ref=${encodeURIComponent(ref)}`);
    if (file.encoding !== "base64") throw new Error("Unsupported GitHub file encoding");
    return Buffer.from(file.content, "base64").toString("utf8");
  }
  const existing = await existingPR();
  if (existing) return { status: "existing", url: existing.html_url };
  let branchExists = false;
  try { await api(`/git/ref/heads/${branch}`); branchExists = true; }
  catch (error) { if (!(error instanceof GitHubError) || error.status !== 404) throw error; }
  let explanationOnly = false;
  if (!branchExists) {
    const base = await api(`/git/ref/heads/${MAIN}`);
    const sha = base.object.sha;
    const contents = await Promise.all([ROASTERS, MULTI].map(path => readFile(path, sha)));
    const proposal = proposeChange(submission, { [ROASTERS]: contents[0], [MULTI]: contents[1] });
    if (!proposal) return { status: "duplicate" };
    explanationOnly = proposal.explanationOnly;
    const commit = await api(`/git/commits/${sha}`);
    const tree = await api("/git/trees", "POST", {
      base_tree: commit.tree.sha,
      tree: Object.entries(proposal.contents).map(([path, content]) => ({ path, mode: "100644", type: "blob", content })),
    });
    const created = await api("/git/commits", "POST", {
      message: `chore(data): ${submission.type === "issue" ? "review" : "add"} ${submission.name}`,
      tree: tree.sha, parents: [sha],
    });
    try { await api("/git/refs", "POST", { ref: `refs/heads/${branch}`, sha: created.sha }); }
    catch (error) {
      if (!(error instanceof GitHubError) || error.status !== 422) throw error;
      // Another delivery may have created this branch. Confirm its receipt before reusing it.
      branchExists = true;
    }
  }
  if (branchExists) {
    const receipt = JSON.parse(await readFile(receiptPath(submission.id), branch));
    if (JSON.stringify(receipt.submission) !== JSON.stringify(submission)) throw new Error("Submission branch receipt differs; refusing to overwrite it");
    explanationOnly = receipt.explanationOnly;
  }
  const body = [
    "Proposed directory update from a verified Netlify form submission.",
    `Submission: \`${submission.id}\` · Type: ${submission.type}`,
    `Roaster: ${escapeMarkdown(submission.name)}`,
    `Website: ${escapeMarkdown(submission.website)}`,
    submission.originalWebsite ? `Original website: ${escapeMarkdown(submission.originalWebsite)}` : "",
    submission.details ? `Submitter's notes:\n\n${submission.details.split("\n").map(line => `> ${escapeMarkdown(line)}`).join("\n")}` : "",
    explanationOnly ? "The structured fields are unchanged. Review the notes and edit the directory in this branch if necessary." : "Review the proposed data before merging. Cafe locations are enriched by the existing weekly Maps workflow after merge.",
    "Only directory data and the whitelisted submission receipt are committed. No contact details or raw Netlify payload are copied.",
  ].filter(Boolean).join("\n\n");
  try {
    const pr = await api("/pulls", "POST", {
      head: branch, base: MAIN,
      title: `${submission.type === "issue" ? "Review correction for" : "Add"} ${submission.name}`,
      body,
    });
    return { status: "created", url: pr.html_url };
  } catch (error) {
    if (!(error instanceof GitHubError) || error.status !== 422) throw error;
    const raced = await existingPR();
    if (!raced) throw error;
    return { status: "existing", url: raced.html_url };
  }
}
