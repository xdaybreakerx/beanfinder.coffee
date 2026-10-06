import legacy from "../data/coffee-roasters-updated-from-place_ids.json";
import { isAustralianPlace, type PlaceLocation } from "./australianPlaces";
import { legacyIdentities, reviewedPlaces, type ReviewedPlace } from "./reviewedPlaces";
import { businesses } from './directory';
import type { Business } from './directorySchema';
import type { LegacyIdentity } from './locationSchema';

export type MapPlace = Pick<ReviewedPlace, "placeId" | "Name" | "Website" | "state"> & { locationId?: string; businessId?: string | null; hasCafe: boolean | null };
type LegacyListing = { Name: string; Website: string; place_ids?: Array<PlaceLocation & { place_id?: string; state?: string }> };

// Reuse the accepted snapshot's known Australian IDs without migrating its provider data.
// Explicitly reviewed matches override its labels/identity when the same ID is supplied.
export function createMapPlaces(snapshot: LegacyListing[], reviewed: ReviewedPlace[], identities: LegacyIdentity[] = [], directory: Business[] = []): MapPlace[] {
  const places = new Map<string, MapPlace>();
  for (const listing of snapshot) for (const place of listing.place_ids ?? []) {
    if (!place.place_id || places.has(place.place_id) || !isAustralianPlace(place)) continue;
    const identity = identities.find(item => item.placeId === place.place_id);
    const business = directory.find(item => item.businessId === identity?.businessId);
    places.set(place.place_id, { placeId: place.place_id, Name: business?.Name ?? listing.Name, Website: business?.Website ?? listing.Website, state: place.state ?? "", hasCafe: business?.hasCafe ?? null,
      ...(identity ? { locationId: identity.locationId, businessId: identity.businessId } : {}) });
  }
  for (const place of reviewed) {
    places.set(place.placeId, { placeId: place.placeId, Name: place.Name, Website: place.Website, state: place.state, locationId: place.locationId, businessId: place.businessId, hasCafe: place.hasCafe });
  }
  return [...places.values()];
}

export const mapPlaces = createMapPlaces(legacy, reviewedPlaces, legacyIdentities, businesses);
