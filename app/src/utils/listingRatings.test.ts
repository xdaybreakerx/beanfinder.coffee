import { describe, expect, it } from 'vitest';
import { getListingRatings } from './listingRatings';
import { compareListingRatings } from './ratings';

const listing = { Name: 'Example Coffee', Website: 'https://coffee.example/' };
const place = (placeId: string, rating: unknown, state = 'VIC', address = '1 Main St, Melbourne VIC 3000, Australia') => ({ place_id: placeId, rating, state, latitude: -37.8, longitude: 145, address });

describe('listing rating identities and ranking', () => {
  it('selects the highest rated Australian branch and retains other branches instead of averaging', () => {
    const saved = [{ Website: listing.Website, place_ids: [place('first', 4.2), place('best', 4.7), place('unrated', 'N/A'), place('foreign', 5, 'VIC', '1 Main St, Melbourne, United States')] }];
    const ratings = getListingRatings(listing, undefined, saved);
    expect(ratings.map(rating => [rating.placeId, rating.rating])).toEqual([['best', 4.7], ['first', 4.2], ['unrated', null]]);
    expect(ratings[0].locality).toBe('Melbourne VIC 3000');
    expect(new URL(ratings[0].href).searchParams.get('query_place_id')).toBe('best');
  });
  it('matches the exact website, covers split records, deduplicates place IDs and respects the state page', () => {
    const saved = [
      { Website: listing.Website, place_ids: [place('victoria', 4.6), place('nsw', 4.9, 'NSW')] },
      { Website: listing.Website, place_ids: [place('victoria', 4.6), place('second', 4.8)] },
      { Website: 'https://different.example/', place_ids: [place('wrong-business', 5)] },
    ];
    expect(getListingRatings(listing, 'VIC', saved).map(rating => rating.placeId)).toEqual(['second', 'victoria']);
    expect(getListingRatings(listing, 'NSW', saved).map(rating => rating.placeId)).toEqual(['nsw']);
    expect(getListingRatings(listing, 'WA', saved)).toEqual([]);
  });
  it('leaves unmatched and invalid scores missing, rather than converting them to zero stars', () => {
    expect(getListingRatings(listing, undefined, [])).toEqual([]);
    const saved = [{ Website: listing.Website, place_ids: [place('invalid', 0), place('missing', undefined)] }];
    expect(getListingRatings(listing, undefined, saved).every(rating => rating.rating === null)).toBe(true);
  });
  it('keeps missing ratings last in both sort directions and sorts by the precise score', () => {
    const scores = [null, 4.6, 4.7, 3.2, null];
    expect([...scores].sort((a, b) => compareListingRatings(a, b, 'desc'))).toEqual([4.7, 4.6, 3.2, null, null]);
    expect([...scores].sort((a, b) => compareListingRatings(a, b, 'asc'))).toEqual([3.2, 4.6, 4.7, null, null]);
  });
});
