import roasters from "../data/coffee-roasters-updated-from-place_ids.json";
import { useMemo } from "react";
import { createAustralianPois } from "../utils/australianPlaces";

// Retained historical snapshot with unknown freshness; new coordinates use the runtime path.
export function usePoiCreation() {
  return useMemo(() => createAustralianPois(roasters), []);
}
