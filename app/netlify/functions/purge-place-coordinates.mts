import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import { purgeExpiredCoordinates } from "../../src/server/place-coordinates";

export default async function handler(_request: Request, context: Context) {
  if (context.deploy.context !== "production") return new Response(null, { status: 204 });
  const deleted = await purgeExpiredCoordinates(getStore({ name: "place-coordinates-v1", consistency: "strong" }));
  console.info("Expired coordinate entries deleted:", deleted);
  return new Response(null, { status: 204 });
}

// Cleanup only. Never discovers places, refreshes coordinates or calls Google.
export const config: Config = { schedule: "0 3 * * *" };
