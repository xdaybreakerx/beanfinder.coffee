import { AU_STATES, validId, validPastDate, websiteIdentity, type Business } from './directorySchema.ts';

export type LegacyIdentity = { locationId: string; placeId: string; businessId: string | null; candidateBusinessIds?: string[] };
export type ReviewedLocation = {
  locationId: string; businessId: string; placeId: string; Name: string; state: string;
  countryCode: 'AU'; hasCafe: boolean;
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
  for (const location of reviewed) {
    if (!location || !validId(location.locationId, 'loc') || !validPlace(location.placeId) || seen.has(location.locationId) || !businessIds.has(location.businessId) ||
        (ids.has(location.locationId) && ids.get(location.locationId) !== location.placeId) || (places.has(location.placeId) && places.get(location.placeId) !== location.locationId) ||
        typeof location.Name !== 'string' || !location.Name.trim() || /[\x00-\x1f\x7f]/.test(location.Name) || !AU_STATES.has(location.state) || location.countryCode !== 'AU' || typeof location.hasCafe !== 'boolean' ||
        !location.source || !validPastDate(location.source.reviewedAt) || Object.keys(location.source).some(key => !['url', 'reviewedAt'].includes(key)) ||
        Object.keys(location).some(key => !['locationId', 'businessId', 'placeId', 'Name', 'state', 'countryCode', 'hasCafe', 'source'].includes(key))) throw new Error('Invalid reviewed location identity, source or business reference');
    websiteIdentity(location.source.url);
    const previous = legacy.find(item => item.locationId === location.locationId);
    if (previous?.businessId && previous.businessId !== location.businessId) throw new Error('Reviewed location belongs to another business');
    ids.set(location.locationId, location.placeId); places.set(location.placeId, location.locationId); seen.add(location.locationId);
  }
  return { legacy: legacy as LegacyIdentity[], reviewed: reviewed as ReviewedLocation[] };
}
