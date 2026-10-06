import roasters from "../data/coffee-roasters-updated-from-place_ids.json";
import { useMemo } from "react";
import { createAustralianPois } from "../utils/australianPlaces";
import { mapPlaces } from '../utils/mapPlaces';

// Retained historical snapshot with unknown freshness; new coordinates use the runtime path.
export function usePoiCreation() {
  return useMemo(() => createAustralianPois(roasters).map(poi => {
    const identity = mapPlaces.find(place => place.placeId === poi.place_id);
    return { ...poi, name: identity ? `${identity.Name}${identity.state ? ` (${identity.state})` : ''}` : poi.name };
  }), []);
}
