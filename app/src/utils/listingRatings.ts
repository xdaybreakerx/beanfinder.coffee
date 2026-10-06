import snapshot from '../data/coffee-roasters-updated-from-place_ids.json';
import { isAustralianPlace, type PlaceLocation } from './australianPlaces';
import { roundRating } from './ratings';

type Listing = { Name: string; Website: string };
type SavedListing = { Website: string; place_ids?: Array<PlaceLocation & { place_id?: string; state?: string; rating?: unknown }> };
export type ListingRating = { placeId: string; rating: number | null; locality: string; href: string };

// Each score belongs to a location. Rank by the highest rated matched location,
// and expose that location in the UI rather than averaging branch scores.
export function getListingRatings(listing: Listing, state?: string, saved: SavedListing[] = snapshot): ListingRating[] {
  const seen = new Set<string>();
  return saved.filter(record => record.Website === listing.Website).flatMap(record => (record.place_ids ?? []).flatMap(place => {
    if (!place.place_id || seen.has(place.place_id) || !isAustralianPlace(place) || (state && place.state !== state)) return [];
    seen.add(place.place_id);
    const address = typeof place.address === 'string' ? place.address : '';
    const parts = address.split(',').map(part => part.trim()).filter(Boolean);
    const locality = parts.at(-1)?.toLowerCase() === 'australia' ? parts.at(-2) : undefined;
    const url = new URL('https://www.google.com/maps/search/');
    url.search = new URLSearchParams({ api: '1', query: `${listing.Name}, ${address || 'Australia'}`, query_place_id: place.place_id }).toString();
    return [{ placeId: place.place_id, rating: typeof place.rating === 'number' && place.rating > 0 && roundRating(place.rating) !== null ? place.rating : null, locality: locality || place.state || 'Location', href: url.href }];
  })).sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.locality.localeCompare(b.locality) || a.placeId.localeCompare(b.placeId));
}
