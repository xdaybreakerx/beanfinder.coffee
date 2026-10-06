import type { Context } from "@netlify/functions";
import { createSubmissionPR, GitHubError, SubmissionError } from "../../src/server/form-submission-prs";

// The supported legacy event filename preserves Netlify's submission ID for retry deduplication.
// Netlify verifies the event signature before invoking this function.
export default async function submissionCreated(request: Request, context: Context) {
  if (context.deploy.context !== "production") return new Response(null, { status: 204 });
  const token = process.env.FORM_PR_GITHUB_TOKEN;
  try {
    if (!token) throw new Error("Missing production credential");
    let event;
    try { event = await request.json(); }
    catch { throw new SubmissionError("Invalid event JSON"); }
    const payload = event?.payload;
    const result = await createSubmissionPR(payload, { token });
    console.info("Form ingestion:", result.status, result.url ?? "");
    return new Response(null, { status: 204 });
  } catch (error) {
    // Do not log the raw payload, which may contain private submission metadata.
    if (error instanceof SubmissionError) {
      console.warn("Form ingestion rejected:", error.message);
      return new Response(null, { status: 422 });
    }
    const status = error instanceof GitHubError ? error.status : undefined;
    const credentialFailure = !token || status === 401 || status === 403;
    const reason = !token ? "missing-token" : status ? `github-${status}` : "request-or-proposal-failure";
    const recovery = credentialFailure
      ? "Check FORM_PR_GITHUB_TOKEN expiry, repository access and Contents/Pull requests write permissions; update the production Functions variable and redeploy, then replay the verified submission. HTTP 403 can also indicate a rate limit."
      : "Check GitHub availability/rate limits and the existing proposal branch; fix the cause, then replay the verified submission. Retries preserve existing branches and PRs.";
    // Fetch errors can include credentials or request details: log only this fixed summary.
    console.error("Form ingestion failed:", { reason, recovery });
    throw new Error(`Form ingestion failed: ${reason}. ${recovery}`);
  }
}
