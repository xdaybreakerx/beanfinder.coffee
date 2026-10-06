import { describe, expect, it } from 'vitest';
import { validateDirectory, websiteIdentity, type Business } from './directorySchema';
import { validateLocations } from './locationSchema';
import { businesses, roasters, sellers } from './directory';
import { legacyIdentities, reviewedPlaces } from './reviewedPlaces';
import { getSavedLocations, indexSavedLocations } from './savedLocations';
import { getCafeMapLinks } from './cafeMapLinks';
import { getListingRatings } from './listingRatings';
import { mapPlaces } from './mapPlaces';

const business: Business = { businessId: 'biz-example', Name: 'Example', Website: 'https://example.coffee/', State: 'VIC, NSW', hasCafe: true, multiRoaster: false, provenance: { source: 'legacy-directory', verifiedAt: null } };
const identity = { locationId: 'loc-example', placeId: 'google-example', businessId: business.businessId };
const reviewed = { ...identity, Name: 'Example branch', state: 'VIC', countryCode: 'AU', hasCafe: true, source: { url: 'https://example.coffee/locations', reviewedAt: '2026-10-01T00:00:00Z' } };

describe('shared business schema', () => {
  it('normalizes URL variants while keeping distinct paths, ports and queries', () => {
    expect(websiteIdentity('http://WWW.EXAMPLE.coffee/#contact')).toBe(websiteIdentity(business.Website));
    expect(websiteIdentity('https://example.coffee/brand/')).not.toBe(websiteIdentity(business.Website));
    expect(websiteIdentity('https://example.coffee:8443/')).not.toBe(websiteIdentity(business.Website));
    expect(websiteIdentity('https://example.coffee/?brand=other')).not.toBe(websiteIdentity(business.Website));
  });
  it.each(['javascript:alert(1)', 'ftp://example.coffee/', 'https://user:password@example.coffee/', 'not a website'])('rejects unsafe websites %s', url => {
    expect(() => websiteIdentity(url)).toThrow();
  });
  it('rejects duplicates across classifications and aliases', () => {
    expect(() => validateDirectory([business, { ...business, businessId: 'biz-second', Website: 'http://www.example.coffee' }], [])).toThrow('Duplicate normalized website');
    expect(() => validateDirectory([business], [{ ...business, businessId: 'biz-seller', multiRoaster: true, State: 'all' }])).toThrow('Duplicate normalized website');
    expect(() => validateDirectory([{ ...business, websiteAliases: ['http://www.example.coffee'] }], [])).toThrow('Duplicate normalized website');
    expect(() => validateDirectory([business, { ...business, Website: 'https://other.coffee/' }], [])).toThrow('business ID');
  });
  it.each([
    { businessId: '../unsafe' }, { State: 'VIC, VIC' }, { State: 'all' }, { State: 'NZ' },
    { hasCafe: 'true' }, { multiRoaster: true }, { latitude: -37 }, { provenance: null },
    { provenance: { source: 'operator-website', url: business.Website, reviewedAt: '2999-01-01T00:00:00Z' } },
  ])('rejects invalid directory data %j', fields => {
    expect(() => validateDirectory([{ ...business, ...fields }], [])).toThrow();
  });
  it('keeps seller options constrained and optional', () => {
    const seller = { ...business, multiRoaster: true, State: 'all', subscription: false, selection: ['choose'], brew: ['filter', 'decaf'] };
    expect(validateDirectory([], [seller])).toEqual([seller]);
    expect(() => validateDirectory([], [{ ...seller, brew: ['tea'] }])).toThrow('seller options');
    expect(() => validateDirectory([{ ...business, subscription: true }], [])).toThrow('seller options');
  });
});

describe('location schema and durable associations', () => {
  it('accepts sourced street addresses without inventing Google IDs and preserves mixed branches', () => {
    const addressOnly = { ...reviewed, locationId: 'loc-address-only', placeId: undefined, address: '10 High Street, Northcote VIC 3070, Australia', countryCode: 'AU' as const };
    expect(validateLocations([], [addressOnly], [business]).reviewed).toEqual([addressOnly]);
    const saved = [{ Website: business.Website, place_ids: [{ place_id: identity.placeId, latitude: -37.8, longitude: 145, address: 'Melbourne, Australia', rating: 4.5 }] }];
    const indexed = indexSavedLocations(saved, [identity], [addressOnly]).get(business.businessId)!;
    expect(indexed).toHaveLength(2);
    expect(indexed[0]).toMatchObject({ place_id: identity.placeId, rating: 4.5 });
    expect(indexed[1]).toMatchObject({ locationId: addressOnly.locationId, address: addressOnly.address });
    expect(indexed[1]).not.toHaveProperty('place_id');
    expect(indexed[1]).not.toHaveProperty('rating');
    for (const address of [undefined, '', 'Northcote VIC, Australia', '10 High Street, Northcote NSW 3070, Australia', '10 High Street, Northcote VIC 3070, Canada', '10 High Street\n, Northcote VIC 3070, Australia']) {
      expect(() => validateLocations([], [{ ...addressOnly, address }], [business])).toThrow();
    }
    expect(() => validateLocations([identity], [{ ...addressOnly, locationId: identity.locationId }], [business])).toThrow();
    expect(() => validateLocations([], [addressOnly, addressOnly], [business])).toThrow();
  });
  it('uses an independently reviewed address in preference to the accepted snapshot', () => {
    const address = '10 High Street, Northcote VIC 3070, Australia';
    const saved = [{ Website: business.Website, place_ids: [{ place_id: identity.placeId, latitude: -37.8, longitude: 145, address: 'Old address, Australia' }] }];
    expect(indexSavedLocations(saved, [identity], [{ ...reviewed, countryCode: 'AU', address }]).get(business.businessId)![0].address).toBe(address);
  });
  it('requires source-backed business references and location-level cafe status', () => {
    expect(validateLocations([identity], [reviewed], [business]).reviewed).toEqual([reviewed]);
    for (const fields of [{ businessId: 'biz-missing' }, { locationId: 'loc-other' }, { placeId: 'different' }, { hasCafe: undefined }, { rating: 5 }, { source: null }]) {
      expect(() => validateLocations([identity], [{ ...reviewed, ...fields }], [business])).toThrow();
    }
    expect(() => validateLocations([identity, identity], [], [business])).toThrow();
    expect(() => validateLocations([], [reviewed, { ...reviewed, locationId: 'loc-second' }], [business])).toThrow();
  });
  it('does not let a reviewed location change another business reference', () => {
    expect(() => validateLocations([identity], [{ ...reviewed, businessId: 'biz-other' }], [business, { businessId: 'biz-other' }])).toThrow('another business');
  });
  it('preserves renamed businesses and locations across website and classification changes', () => {
    const original = roasters.find(item => item.businessId === 'biz-coffee-in-common')!;
    const changed = { ...original, Name: 'New name', Website: 'https://new.example/', multiRoaster: true, State: 'all' };
    expect(getSavedLocations(changed).map(item => item.place_id)).toEqual(getSavedLocations(original).map(item => item.place_id));
    expect(getListingRatings(changed)[0].rating).toBe(getListingRatings(original)[0].rating);
    expect(getCafeMapLinks(changed)[0].placeId).toBe(getCafeMapLinks(original)[0].placeId);
  });
  it('consolidates Coffee in Common under its independently sourced SA branch', () => {
    const listing = roasters.find(item => item.businessId === 'biz-coffee-in-common')!;
    expect(listing.State).toBe('SA');
    expect(getSavedLocations(listing)).toHaveLength(1);
    expect(getSavedLocations(listing)[0].state).toBe('SA');
    expect(getListingRatings(listing, 'VIC')).toEqual([]);
    expect(reviewedPlaces[0].businessId).toBe(listing.businessId);
  });
  it('preserves all markers and resolves the shared legacy ID using operator evidence', () => {
    expect(businesses).toHaveLength(239);
    expect(sellers).toHaveLength(8);
    expect(legacyIdentities).toHaveLength(218);
    expect(mapPlaces).toHaveLength(218);
    const conflict = legacyIdentities.find(item => item.businessId === null)!;
    expect(mapPlaces.some(item => item.placeId === conflict.placeId)).toBe(true);
    const ac = businesses.find(item => item.businessId === 'biz-acoffee')!;
    const aka = businesses.find(item => item.businessId === 'biz-a-k-a-coffee')!;
    expect(getSavedLocations(ac).some(item => item.place_id === conflict.placeId)).toBe(true);
    expect(getSavedLocations(aka)).toEqual([]);
    expect(aka.State).toBe('NSW');
    expect(mapPlaces.find(item => item.placeId === conflict.placeId)!.businessId).toBe(ac.businessId);
  });
  it('links reviewed branches before coordinates exist and keeps cafe access at location level', () => {
    const places = indexSavedLocations([], [], [{ ...reviewed, countryCode: 'AU', hasCafe: false }]);
    expect(places.get(business.businessId)).toEqual([expect.objectContaining({ place_id: reviewed.placeId, locationId: reviewed.locationId, hasCafe: false })]);
    const unresolved = { ...identity, businessId: null, candidateBusinessIds: ['biz-example', 'biz-other'] };
    const saved = [{ Website: business.Website, place_ids: [{ place_id: identity.placeId, latitude: -37.8, longitude: 145, address: 'Melbourne, Australia' }] }];
    expect(indexSavedLocations(saved, [unresolved], []).size).toBe(0);
    expect(indexSavedLocations(saved, [unresolved], [{ ...reviewed, countryCode: 'AU' }]).get(business.businessId)).toHaveLength(1);
  });
  it('joins all normalized URL matches and aliases without confusing shared domains', () => {
    const place = (place_id: string) => ({ place_id, latitude: -37.8, longitude: 145, address: 'Melbourne, Australia' });
    const saved = [{ Website: 'http://www.example.coffee', place_ids: [place('first')] }, { Website: 'https://example.coffee/', place_ids: [place('second')] }, { Website: 'https://example.coffee/brand', place_ids: [place('third')] }];
    expect(getSavedLocations({ ...business, Website: 'https://new.coffee/', websiteAliases: [business.Website] }, saved).map(item => item.place_id)).toEqual(['first', 'second']);
    expect(getCafeMapLinks(business, undefined, saved).map(link => link.placeId)).toEqual(['first', 'second']);
    expect(getListingRatings(business, undefined, saved).map(link => link.placeId)).toEqual(['first', 'second']);
    expect(getSavedLocations(business, [...saved, { Website: 'https://other.coffee/', place_ids: [place('first')] }]).map(item => item.place_id)).toEqual(['second']);
  });
});
