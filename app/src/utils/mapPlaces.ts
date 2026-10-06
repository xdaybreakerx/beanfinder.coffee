import legacy from "../data/coffee-roasters-updated-from-place_ids.json";
import { isAustralianPlace, type PlaceLocation } from "./australianPlaces";
import { reviewedPlaces, type ReviewedPlace } from "./reviewedPlaces";

export type MapPlace = Pick<ReviewedPlace, "placeId" | "Name" | "Website" | "state">;
type LegacyListing = { Name: string; Website: string; place_ids?: Array<PlaceLocation & { place_id?: string; state?: string }> };

// Reuse the accepted snapshot's known Australian IDs without migrating its provider data.
// Explicitly reviewed matches override its labels/identity when the same ID is supplied.
export function createMapPlaces(snapshot: LegacyListing[], reviewed: ReviewedPlace[]): MapPlace[] {
  const places = new Map<string, MapPlace>();
  for (const listing of snapshot) for (const place of listing.place_ids ?? []) {
    if (!place.place_id || places.has(place.place_id) || !isAustralianPlace(place)) continue;
    places.set(place.place_id, { placeId: place.place_id, Name: listing.Name, Website: listing.Website, state: place.state ?? "" });
  }
  for (const place of reviewed) {
    places.set(place.placeId, { placeId: place.placeId, Name: place.Name, Website: place.Website, state: place.state });
  }
  return [...places.values()];
}

export const mapPlaces = createMapPlaces(legacy, reviewedPlaces);
