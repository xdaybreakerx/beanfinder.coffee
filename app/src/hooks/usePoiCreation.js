import roasters from "../data/coffee-roasters-updated-from-place_ids.json";
import { useMemo } from "react";
import { createAustralianPois } from "../utils/australianPlaces";

export function usePoiCreation() {
  return useMemo(() => createAustralianPois(roasters), []);
}
