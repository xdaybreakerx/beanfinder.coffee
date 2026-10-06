import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import { monthlyLimit, refreshCoordinates } from "../../src/server/place-coordinates";
import { mapPlaces } from "../../src/utils/mapPlaces";

export default async function handler(_request: Request, context: Context) {
  if (context.deploy.context !== "production") return new Response(null, { status: 204 });
  const result = await refreshCoordinates({
    places: mapPlaces, store: getStore({ name: "place-coordinates-v1", consistency: "strong" }),
    apiKey: process.env.GOOGLE_PLACES_SERVER_API_KEY,
    limit: monthlyLimit(process.env.PLACE_COORDINATES_MONTHLY_LIMIT),
  });
  console.info("Coordinate refresh:", result);
  return new Response(null, { status: 204 });
}

// Hourly small batches replenish missing coordinates and renew them from day 27.
// Reuses known IDs; never rediscovers the directory, fetches ratings or writes Git.
export const config: Config = { schedule: "17 * * * *" };
