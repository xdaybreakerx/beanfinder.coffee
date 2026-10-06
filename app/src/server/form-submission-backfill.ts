import { websiteIdentity } from '../utils/directorySchema.ts';
import { parseSubmission, proposeChange, SubmissionError } from "./form-submission-prs.ts";
import { patchReleaseFiles } from "./release-version.ts";

type HistoricalPayload = Parameters<typeof parseSubmission>[0];
type Review = { action?: "skip"; reason?: string; fields?: Record<string, string>; sources?: string[] };
export type BackfillReviews = Record<string, Review>;
export const PROCESSED_SUBMISSIONS_PATH = ".github/processed-form-submissions.json";

export function readProcessedSubmissionIds(content?: string): Set<string> {
  const ids: unknown = JSON.parse(content ?? "[]");
  if (!Array.isArray(ids) || ids.some(id => typeof id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) || new Set(ids).size !== ids.length) {
    throw new SubmissionError("Invalid processed submission IDs");
  }
  return new Set(ids);
}

// Backfills are maintainer-reviewed batches. The live event parser remains strict.
export function planBackfill(payloads: HistoricalPayload[], reviews: BackfillReviews, files: Record<string, string>) {
  const processed = readProcessedSubmissionIds(files[PROCESSED_SUBMISSIONS_PATH]);
  const working = { ...files };
  const results: Array<{ id: string; status: string; reason?: string }> = [];
  let dataChanged = false;
  const seen = new Set<string>();
  const recommendations = new Map<string, string>();
  for (const payload of payloads) {
    const id = typeof payload.id === "string" ? payload.id : "";
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new SubmissionError("Invalid submission ID in backfill");
    if (seen.has(id)) continue;
    seen.add(id);
    const receipt = `.github/form-submissions/${id}.json`;
    if (processed.has(id) || working[receipt]) { results.push({ id, status: "processed" }); continue; }
    const review = reviews[id] ?? {};
    if (review.action === "skip") {
      results.push({ id, status: "skipped", reason: review.reason ?? "Skipped by maintainer review" });
      continue;
    }
    try {
      const raw = payload.data ?? {};
      // Never copy private metadata or historical free text into a public receipt.
      const keys = ["form-name", "bot-field", "submission-type", "roaster-name", "roaster-website", "original-website", "state", "has-cafe", "multi-roaster"];
      const data: Record<string, unknown> = Object.fromEntries(keys.filter(key => key in raw).map(key => [key, raw[key]]));
      const allowed = new Set([...keys.filter(key => key !== "bot-field" && key !== "form-name"), "details"]);
      for (const [key, value] of Object.entries(review.fields ?? {})) {
        if (!allowed.has(key) || typeof value !== "string") throw new SubmissionError("Invalid reviewed field");
        data[key] = value;
      }
      const checked = (value: unknown) => value === "on" || value === "true" || value === true;
      const legacyType = checked(raw.issue) !== checked(raw.recommendation) ? (checked(raw.issue) ? "issue" : "recommendation") : undefined;
      const type = data["submission-type"] ?? legacyType;
      if (type !== "issue" && type !== "recommendation") throw new SubmissionError("Submission type requires review");
      data.details ??= "Historical Netlify submission reviewed for backfill.";
      // Correction parsing validates public fields while leaving unavailable flags unset.
      const parsed = parseSubmission({ ...payload, data: { ...data, "submission-type": "issue" } });
      if (!parsed) { results.push({ id, status: "ignored" }); continue; }
      const submission: NonNullable<ReturnType<typeof parseSubmission>> = { ...parsed, type };
      if (type === "recommendation") {
        const identities = [`website:${websiteIdentity(submission.website)}`, `name:${submission.name.toLowerCase()}`];
        const prior = identities.map(key => recommendations.get(key)).find(Boolean);
        if (prior) {
          results.push({ id, status: "duplicate-backlog", reason: `Same recommendation as ${prior}` });
          continue;
        }
        for (const key of identities) recommendations.set(key, id);
      }
      const proposal = proposeChange(submission, working);
      if (!proposal) { results.push({ id, status: "duplicate" }); continue; }
      Object.assign(working, proposal.contents);
      working[receipt] = JSON.stringify({ submission, explanationOnly: proposal.explanationOnly, backfill: true, sources: review.sources ?? [] }, null, 2) + "\n";
      dataChanged ||= !proposal.explanationOnly;
      results.push({ id, status: proposal.explanationOnly ? "notes-only" : "proposed" });
    } catch (error) {
      if (!(error instanceof SubmissionError)) throw error;
      results.push({ id, status: "needs-review", reason: error.message });
    }
  }
  const release = dataChanged ? patchReleaseFiles(working) : undefined;
  if (release) Object.assign(working, release.contents);
  const contents = Object.fromEntries(Object.entries(working).filter(([path, value]) => files[path] !== value));
  return { contents, results, release: release ? { previousVersion: release.previousVersion, version: release.version } : undefined };
}
