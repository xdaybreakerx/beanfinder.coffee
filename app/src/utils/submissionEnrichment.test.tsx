import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSavedLocations, indexSavedLocations } from './savedLocations';
import { getListingRatings } from './listingRatings';
import { getCafeMapLinks } from './cafeMapLinks';
import { mapPlaces, createReviewedPois } from './mapPlaces';
import { reviewedPlaces } from './reviewedPlaces';
import { usePoiCreation } from '../hooks/usePoiCreation';

vi.mock('./reviewedPlaces', async original => {
  const actual = await original<typeof import('./reviewedPlaces')>();
  const { default: template } = await import('../../../PR-submission-template.json');
  const fixture = { ...template, businessId: 'biz-template-fixture', locationId: 'loc-template-fixture',
    Name: 'Template Coffee', state: 'VIC', hasCafe: false,
    address: '10 Coffee Street, Melbourne VIC 3000, Australia',
    placeId: 'template-fixture-place', latitude: -37.81, longitude: 144.96, rating: 4.7,
    source: { url: 'https://coffee.example/locations', reviewedAt: '2026-10-01T00:00:00Z' },
  };
  const filled = actual.validateReviewedPlaces([
    fixture,
    { ...fixture, locationId: 'loc-template-address', placeId: null, latitude: null, longitude: null,
      address: '20 Coffee Street, Melbourne VIC 3000, Australia', hasCafe: true, rating: 4.4 },
    { ...fixture, locationId: 'loc-template-unrated', placeId: null, latitude: null, longitude: null,
      address: '30 Coffee Street, Melbourne VIC 3000, Australia', hasCafe: true, rating: null },
  ], [{ businessId: fixture.businessId, Website: 'https://coffee.example/' }]);
  return { ...actual, reviewedPlaces: [...actual.reviewedPlaces, ...filled] };
});

const business = { businessId: 'biz-template-fixture', Name: 'Template Coffee', Website: 'https://coffee.example/', State: 'VIC', hasCafe: false };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('filled submission template in the app', () => {
  it('joins the filled form by business ID and displays a non-cafe rating without coordinates or extra dataset edits', () => {
    expect(getSavedLocations(business)).toHaveLength(3);
    const ratings = getListingRatings(business);
    expect(ratings.map(item => [item.locationId, item.rating])).toEqual([
      ['loc-template-fixture', 4.7], ['loc-template-address', 4.4], ['loc-template-unrated', null],
    ]);
    expect(new URL(ratings[1].href).searchParams.has('query_place_id')).toBe(false);
    expect(new URL(ratings[1].href).searchParams.get('query')).toContain('20 Coffee Street');
    expect(getListingRatings({ ...business, Name: 'Renamed', Website: 'https://renamed.example/' })).toEqual(ratings);
    expect(getListingRatings(business, 'WA')).toEqual([]);
  });

  it('keeps separate cafe address links, including unrated branches', () => {
    expect(getCafeMapLinks({ ...business, hasCafe: true }).map(item => item.locationId))
      .toEqual(['loc-template-address', 'loc-template-unrated']);
  });

  it('creates a static marker from the filled form without calling Places or the coordinate cache', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => usePoiCreation());
    const pois = result.current.filter(poi => poi.place_id === 'template-fixture-place');
    expect(pois).toHaveLength(1);
    expect(pois[0]).toMatchObject({ location: { lat: -37.81, lng: 144.96 }, rating: 4.7 });
    expect(mapPlaces.find(place => place.placeId === 'template-fixture-place'))
      .toMatchObject({ manualCoordinates: true, address: '10 Coffee Street, Melbourne VIC 3000, Australia', rating: 4.7, hasCafe: false });
    expect(fetcher).not.toHaveBeenCalled();
    expect(createReviewedPois(reviewedPlaces).filter(poi => poi.place_id === 'template-fixture-place')).toHaveLength(1);
  });

  it('overrides a historical score and coordinates once, and supports explicitly clearing a score', () => {
    const review = reviewedPlaces.find(place => place.locationId === 'loc-template-fixture')!;
    const snapshot = [{ Website: business.Website, place_ids: [{ place_id: review.placeId, latitude: -37, longitude: 145,
      address: 'Old address, Australia', rating: 3 }] }];
    const identity = { locationId: review.locationId, placeId: review.placeId!, businessId: review.businessId };
    const indexed = indexSavedLocations(snapshot, [identity], [review]).get(business.businessId)!;
    expect(indexed).toHaveLength(1);
    expect(indexed[0]).toMatchObject({ rating: 4.7, latitude: -37.81, longitude: 144.96, address: review.address });
    expect(indexSavedLocations(snapshot, [identity], [{ ...review, rating: null }]).get(business.businessId)![0].rating).toBeNull();
  });
});
