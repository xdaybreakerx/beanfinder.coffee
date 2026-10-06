import records from '../data/reviewed-places.json';
import manifest from '../data/legacy-place-identities.json';
import { businesses } from './directory';
import { validateLocations, type ReviewedLocation } from './locationSchema';
import type { Business } from './directorySchema';

export type ReviewedPlace = ReviewedLocation & { Website: string };
export function validateReviewedPlaces(input: unknown, listings: Pick<Business, 'businessId' | 'Website'>[], legacy: unknown = []): ReviewedPlace[] {
  return validateLocations(legacy, input, listings).reviewed.map(place => ({
    ...place, Website: listings.find(listing => listing.businessId === place.businessId)!.Website,
  }));
}
export const legacyIdentities = validateLocations(manifest.locations, records, businesses).legacy;
export const reviewedPlaces = validateReviewedPlaces(records, businesses, legacyIdentities);
