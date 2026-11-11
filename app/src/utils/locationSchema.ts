import { AU_STATES, validId, validPastDate, websiteIdentity, type Business } from './directorySchema.ts';
import { isAustralianPlace } from './australianPlaces.ts';
import { googleReviewUrl } from './googleReviewUrl.ts';

export type LegacyIdentity = { locationId: string; placeId: string; businessId: string | null; candidateBusinessIds?: string[] };
export type ReviewedLocation = {
  locationId: string; businessId: string; placeId?: string; address?: string; Name: string; state: string;
  countryCode: 'AU'; hasCafe: boolean;
  rating?: number | null;
  latitude?: number;
  longitude?: number;
  source: { url: string; reviewedAt: string };
};

export function validateLocations(legacy: unknown, reviewed: unknown, businesses: Pick<Business, 'businessId'>[]) {
  if (!Array.isArray(legacy) || !Array.isArray(reviewed)) throw new Error('Location registries must be arrays');
  const businessIds = new Set(businesses.map(business => business.businessId));
  const ids = new Map<string, string>();
  const places = new Map<string, string>();
  const validPlace = (id: unknown) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(id);
  for (const location of legacy) {
    if (!location || !validId(location.locationId, 'loc') || !validPlace(location.placeId) || ids.has(location.locationId) || places.has(location.placeId) ||
        Object.keys(location).some(key => !['locationId', 'placeId', 'businessId', 'candidateBusinessIds'].includes(key))) throw new Error('Invalid legacy location identity');
    if (location.businessId === null) {
      if (!Array.isArray(location.candidateBusinessIds) || location.candidateBusinessIds.length < 2 || new Set(location.candidateBusinessIds).size !== location.candidateBusinessIds.length ||
          !location.candidateBusinessIds.every((id: string) => businessIds.has(id))) throw new Error('Invalid unresolved location references');
    } else if (!businessIds.has(location.businessId) || location.candidateBusinessIds !== undefined) throw new Error('Invalid location business reference');
    ids.set(location.locationId, location.placeId); places.set(location.placeId, location.locationId);
  }
  const seen = new Set<string>();
  const normalized: ReviewedLocation[] = [];
  const reviewLinks = new Set<string>();
  for (const input of reviewed) {
    const location = input && typeof input === 'object' && !Array.isArray(input) ? { ...input } : null;
    // A review form can leave optional identity/coordinate fields blank.
    for (const key of ['address', 'placeId', 'latitude', 'longitude']) if (location?.[key] === null) delete location[key];
    const ratingOnlyLink = location && typeof location.rating === 'number' && !location.placeId && !location.address
      ? googleReviewUrl(location.source?.url) : undefined;
    if (!location || !validId(location.locationId, 'loc') ||
        (location.placeId !== undefined && !validPlace(location.placeId)) || (!location.placeId && !location.address && !ratingOnlyLink) ||
        (location.address !== undefined && (typeof location.address !== 'string' || location.address !== location.address.trim() || location.address.length > 300 ||
          /[\x00-\x1f\x7f]/.test(location.address) || !/\d/.test(location.address.split(',')[0]) ||
          !new RegExp(`,\\s*[^,]+ ${location.state}(?: \\d{4})?, Australia$`).test(location.address))) ||
        seen.has(location.locationId) || !businessIds.has(location.businessId) ||
        (ids.has(location.locationId) && ids.get(location.locationId) !== location.placeId) || (location.placeId && places.has(location.placeId) && places.get(location.placeId) !== location.locationId) ||
        typeof location.Name !== 'string' || !location.Name.trim() || /[\x00-\x1f\x7f]/.test(location.Name) || !AU_STATES.has(location.state) || location.countryCode !== 'AU' || typeof location.hasCafe !== 'boolean' ||
        !location.source || !validPastDate(location.source.reviewedAt) || Object.keys(location.source).some(key => !['url', 'reviewedAt'].includes(key)) ||
        Object.keys(location).some(key => !['locationId', 'businessId', 'placeId', 'address', 'Name', 'state', 'countryCode', 'hasCafe', 'source', 'rating', 'latitude', 'longitude'].includes(key))) throw new Error('Invalid reviewed location identity, source or business reference');
    if (location.rating !== undefined && location.rating !== null &&
        (typeof location.rating !== 'number' || !Number.isFinite(location.rating) || location.rating < 1 || location.rating > 5)) throw new Error('Reviewed rating must be null or a number from 1 to 5');
    if ((location.latitude !== undefined || location.longitude !== undefined) && (!location.placeId || !isAustralianPlace(location))) {
      throw new Error('Reviewed map markers require a confirmed placeId and valid latitude/longitude');
    }
    websiteIdentity(location.source.url);
    if (ratingOnlyLink) {
      const reviewIdentity = new URL(ratingOnlyLink).hash.replace(/,+$/, '').toLowerCase() || ratingOnlyLink;
      if (reviewLinks.has(reviewIdentity)) throw new Error('Duplicate rating-only review link');
      reviewLinks.add(reviewIdentity);
    }
    const previous = legacy.find(item => item.locationId === location.locationId);
    if (previous?.businessId && previous.businessId !== location.businessId) throw new Error('Reviewed location belongs to another business');
    if (location.placeId) { ids.set(location.locationId, location.placeId); places.set(location.placeId, location.locationId); }
    seen.add(location.locationId);
    normalized.push(location as ReviewedLocation);
  }
  return { legacy: legacy as LegacyIdentity[], reviewed: normalized };
}
