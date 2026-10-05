import type { Context } from "@netlify/functions";
import { createSubmissionPR, SubmissionError } from "../../src/server/form-submission-prs";

// The supported legacy event filename preserves Netlify's submission ID for retry deduplication.
// Netlify verifies the event signature before invoking this function.
export default async function submissionCreated(request: Request, context: Context) {
  if (context.deploy.context !== "production") return new Response(null, { status: 204 });
  const token = process.env.FORM_PR_GITHUB_TOKEN;
  if (!token) throw new Error("Set FORM_PR_GITHUB_TOKEN in the production Functions environment");
  try {
    const { payload } = await request.json();
    const result = await createSubmissionPR(payload, { token });
    console.info("Form ingestion:", result.status, result.url ?? "");
    return new Response(null, { status: 204 });
  } catch (error) {
    if (!(error instanceof SubmissionError)) throw error;
    // Do not log the raw payload, which may contain private submission metadata.
    console.warn("Form ingestion rejected:", error.message);
    return new Response(null, { status: 422 });
  }
}
