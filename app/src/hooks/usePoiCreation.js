import roasters from "../data/coffee-roasters-updated-from-place_ids.json";
import { useMemo } from "react";
import { createAustralianPois } from "../utils/australianPlaces";
import { createReviewedPois, mapPlaces } from '../utils/mapPlaces';
import { reviewedPlaces } from '../utils/reviewedPlaces';

// Reviewed static coordinates override the historical snapshot without API calls.
export function usePoiCreation() {
  return useMemo(() => {
    const pois = new Map(createAustralianPois(roasters).map(poi => [poi.place_id, poi]));
    for (const poi of createReviewedPois(reviewedPlaces)) pois.set(poi.place_id, poi);
    return [...pois.values()].map(poi => {
      const identity = mapPlaces.find(place => place.placeId === poi.place_id);
      return { ...poi, name: identity ? `${identity.Name}${identity.state ? ` (${identity.state})` : ''}` : poi.name };
    });
  }, []);
}
