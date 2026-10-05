import { readFile } from "node:fs/promises";
import { createSubmissionPR, parseSubmission, proposeChange } from "../server/form-submission-prs.ts";
import { LOCK_PATH, PACKAGE_PATH, patchReleaseFiles } from "../server/release-version.ts";

// Maintainer recovery command. Accepts either the event envelope or its payload.
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const files = args.filter(arg => arg !== "--dry-run");
if (files.length !== 1) throw new Error("Usage: node src/scripts/replay-form-submission.mjs <payload.json> [--dry-run]");
const input = JSON.parse(await readFile(files[0], "utf8"));
const payload = input.payload ?? input;
if (dryRun) {
  const submission = parseSubmission(payload);
  if (!submission) {
    console.info("Submission ignored (other form or honeypot).");
  } else {
    const roasters = await readFile(new URL("../data/coffee-roasters.json", import.meta.url), "utf8");
    const multi = await readFile(new URL("../data/coffee-roasters-multi.json", import.meta.url), "utf8");
    const proposal = proposeChange(submission, { "app/src/data/coffee-roasters.json": roasters, "app/src/data/coffee-roasters-multi.json": multi });
    if (proposal && !proposal.explanationOnly) {
      const pkg = await readFile(new URL("../../package.json", import.meta.url), "utf8");
      const lock = await readFile(new URL("../../package-lock.json", import.meta.url), "utf8");
      const patch = patchReleaseFiles({ [PACKAGE_PATH]: pkg, [LOCK_PATH]: lock });
      Object.assign(proposal.contents, patch.contents);
      console.info(`Proposed patch version: ${patch.previousVersion} -> ${patch.version}`);
    }
    console.info(proposal ? `Would propose changes to: ${Object.keys(proposal.contents).join(", ")}` : "Already listed; no PR needed.");
  }
} else {
  const result = await createSubmissionPR(payload, { token: process.env.FORM_PR_GITHUB_TOKEN ?? "" });
  console.info(result.status, result.url ?? "");
}
