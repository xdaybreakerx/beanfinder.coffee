import snapshot from '../data/coffee-roasters-updated-from-place_ids.json';
import { legacyIdentities, reviewedPlaces } from './reviewedPlaces';
import { businessWebsites, websiteIdentity } from './directorySchema';
import { isAustralianPlace, type PlaceLocation } from './australianPlaces';
import type { LegacyIdentity, ReviewedLocation } from './locationSchema';

type Listing = { businessId?: string; Website: string; websiteAliases?: string[] };
export type SavedLocation = PlaceLocation & { place_id?: string; state?: string; rating?: unknown; locationId?: string; hasCafe?: boolean; label?: string };
export type SavedListing = { Website: string; place_ids?: SavedLocation[] };

// Index once for rendering. Keep every branch, deduplicate by place ID, and let
// independently reviewed associations resolve ambiguous legacy matches.
export function indexSavedLocations(saved: SavedListing[], identities: LegacyIdentity[], reviewed: ReviewedLocation[]) {
  const byPlace = new Map(identities.map(item => [item.placeId, item]));
  const reviewedByPlace = new Map(reviewed.map(item => [item.placeId, item]));
  const byBusiness = new Map<string, Map<string, SavedLocation>>();
  const add = (businessId: string, placeId: string, place: SavedLocation) => {
    const branches = byBusiness.get(businessId) ?? new Map<string, SavedLocation>();
    if (!branches.has(placeId)) branches.set(placeId, place);
    byBusiness.set(businessId, branches);
  };
  for (const record of saved) for (const place of record.place_ids ?? []) {
    if (!place.place_id || !isAustralianPlace(place)) continue;
    const identity = byPlace.get(place.place_id);
    const review = reviewedByPlace.get(place.place_id);
    const businessId = review?.businessId ?? identity?.businessId;
    if (businessId) add(businessId, place.place_id, { ...place,
      ...(identity ? { locationId: identity.locationId } : {}),
      ...(review ? { locationId: review.locationId, state: review.state, hasCafe: review.hasCafe, label: review.Name } : {}),
    });
  }
  // A confirmed branch still has a precise Maps link before coordinates exist.
  for (const place of reviewed) add(place.businessId, place.placeId, {
    place_id: place.placeId, locationId: place.locationId, state: place.state, hasCafe: place.hasCafe, label: place.Name,
  });
  return new Map([...byBusiness].map(([id, places]) => [id, [...places.values()]]));
}
const savedByBusiness = indexSavedLocations(snapshot, legacyIdentities, reviewedPlaces);

export function getSavedLocations(listing: Listing, saved: SavedListing[] = snapshot): SavedLocation[] {
  if (saved === snapshot && listing.businessId) return savedByBusiness.get(listing.businessId) ?? [];
  // URL normalization also supports imported fixtures and audit tools. Conflicting
  // provider IDs are withheld rather than silently assigning another brand's data.
  const websites = new Set(businessWebsites(listing));
  const candidates = new Map<string, Set<string>>();
  for (const record of saved) for (const place of record.place_ids ?? []) {
    if (!place.place_id || !isAustralianPlace(place)) continue;
    const owners = candidates.get(place.place_id) ?? new Set<string>();
    owners.add(websiteIdentity(record.Website)); candidates.set(place.place_id, owners);
  }
  const result = new Map<string, SavedLocation>();
  for (const record of saved) {
    if (!websites.has(websiteIdentity(record.Website))) continue;
    for (const place of record.place_ids ?? []) {
      if (place.place_id && isAustralianPlace(place) && candidates.get(place.place_id)?.size === 1 && !result.has(place.place_id)) result.set(place.place_id, place);
    }
  }
  return [...result.values()];
}
