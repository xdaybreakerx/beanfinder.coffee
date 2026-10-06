import { describe, expect, it } from "vitest";
import legacy from "../data/coffee-roasters-updated-from-place_ids.json";
import { createMapPlaces, mapPlaces } from "./mapPlaces";
import { createAustralianPois } from "./australianPlaces";
import type { ReviewedPlace } from "./reviewedPlaces";

describe("known map identities", () => {
  it("covers every accepted legacy marker without carrying provider fields into the registry", () => {
    expect(mapPlaces.map(place => place.placeId)).toEqual(createAustralianPois(legacy).map(poi => poi.place_id));
    expect(mapPlaces).toHaveLength(218);
    expect(mapPlaces.every(place => Object.keys(place).sort().join(",") === "Name,Website,placeId,state")).toBe(true);
  });

  it("excludes foreign and invalid locations, deduplicates IDs and applies reviewed labels", () => {
    const reviewed: ReviewedPlace = { placeId: "branch", Name: "Reviewed branch", Website: "https://coffee.example", state: "VIC", countryCode: "AU", source: { url: "https://coffee.example/locations", reviewedAt: "2026-10-01T00:00:00Z" } };
    const au = { latitude: -37.8, longitude: 145, address: "Melbourne, Australia" };
    const snapshot = [{ Name: "Legacy", Website: reviewed.Website, place_ids: [
      { ...au, place_id: "branch" }, { ...au, place_id: "branch" }, { ...au, place_id: "second" },
      { ...au, place_id: "foreign", address: "Sydney Road, Canada" },
      { ...au, place_id: "broken", latitude: NaN },
    ] }];
    const places = createMapPlaces(snapshot, [reviewed, { ...reviewed, placeId: "new" }]);
    expect(places.map(place => place.placeId)).toEqual(["branch", "second", "new"]);
    expect(places[0].Name).toBe("Reviewed branch");
  });
});
