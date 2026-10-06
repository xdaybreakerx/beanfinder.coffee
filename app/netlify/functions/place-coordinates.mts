import { getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";
import { readCachedCoordinates } from "../../src/server/place-coordinates";
import { mapPlaces } from "../../src/utils/mapPlaces";

export default async function handler(request: Request, context: Context) {
  const headers = { "Cache-Control": "private, no-store", "Netlify-CDN-Cache-Control": "no-store" };
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { ...headers, Allow: "GET" } });
  if (context.deploy.context !== "production") return new Response(null, { status: 503, headers });
  const placeId = new URL(request.url).searchParams.get("place_id") ?? "";
  if (placeId && !mapPlaces.some(place => place.placeId === placeId)) return new Response(null, { status: 404, headers });
  try {
    const places = placeId ? mapPlaces.filter(place => place.placeId === placeId) : mapPlaces;
    const coordinates = await readCachedCoordinates(getStore({ name: "place-coordinates-v1", consistency: "strong" }), places);
    const cached = new Set(coordinates.map(place => place.placeId));
    return Response.json({ coordinates, missingPlaceIds: places.filter(place => !cached.has(place.placeId)).map(place => place.placeId) }, { headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
