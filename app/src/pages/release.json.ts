import { version } from "../../package.json";

// Capture Netlify's build identity in the deployed artifact, rather than runtime env.
export const prerender = true;

export function GET() {
  return Response.json({
    version,
    commit: process.env.COMMIT_REF ?? null,
    context: process.env.CONTEXT ?? "development",
  });
}
