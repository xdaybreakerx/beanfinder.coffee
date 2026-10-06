import { describe, expect, it } from "vitest";
import legacy from "../data/coffee-roasters-updated-from-place_ids.json";
import { createMapPlaces, mapPlaces } from "./mapPlaces";
import { createAustralianPois } from "./australianPlaces";
import type { ReviewedPlace } from "./reviewedPlaces";

describe("known map identities", () => {
  it('keeps address-only reviews out of the provider coordinate refresh allowlist', () => {
    const review: ReviewedPlace = { locationId: 'loc-address-only', businessId: 'biz-reviewed', Name: 'Coffee', Website: 'https://coffee.example/', state: 'VIC', countryCode: 'AU', hasCafe: true,
      address: '10 High Street, Northcote VIC 3070, Australia', source: { url: 'https://coffee.example/locations', reviewedAt: '2026-10-01T00:00:00Z' } };
    expect(createMapPlaces([], [review])).toEqual([]);
  });
  it("covers every accepted legacy marker without carrying provider fields into the registry", () => {
    expect(mapPlaces.map(place => place.placeId)).toEqual(createAustralianPois(legacy).map(poi => poi.place_id));
    expect(mapPlaces).toHaveLength(218);
    expect(mapPlaces.every(place => Object.keys(place).sort().join(",") === "Name,Website,businessId,hasCafe,locationId,placeId,state")).toBe(true);
  });

  it("excludes foreign and invalid locations, deduplicates IDs and applies reviewed labels", () => {
    const reviewed: ReviewedPlace = { locationId: "loc-reviewed", businessId: "biz-reviewed", hasCafe: true, placeId: "branch", Name: "Reviewed branch", Website: "https://coffee.example", state: "VIC", countryCode: "AU", source: { url: "https://coffee.example/locations", reviewedAt: "2026-10-01T00:00:00Z" } };
    const au = { latitude: -37.8, longitude: 145, address: "Melbourne, Australia" };
    const snapshot = [{ Name: "Legacy", Website: reviewed.Website, place_ids: [
      { ...au, place_id: "branch" }, { ...au, place_id: "branch" }, { ...au, place_id: "second" },
      { ...au, place_id: "foreign", address: "Sydney Road, Canada" },
      { ...au, place_id: "broken", latitude: NaN },
    ] }];
    const places = createMapPlaces(snapshot, [reviewed, { ...reviewed, placeId: "new", locationId: "loc-new" }]);
    expect(places.map(place => place.placeId)).toEqual(["branch", "second", "new"]);
    expect(places[0].Name).toBe("Reviewed branch");
    expect(places[0].hasCafe).toBe(true);
    expect(places[1].hasCafe).toBeNull();
  });

  it("uses reviewed branch cafe access before a business-wide cafe flag", () => {
    const business = { businessId: "biz-coffee", Name: "Coffee", Website: "https://coffee.example", hasCafe: true };
    const snapshot = [{ Name: business.Name, Website: business.Website, place_ids: [
      { place_id: "factory", latitude: -37.8, longitude: 145, address: "Melbourne, Australia" },
    ] }];
    const identity = { locationId: "loc-factory", placeId: "factory", businessId: business.businessId };
    const reviewed: ReviewedPlace = { ...identity, Name: "Coffee factory", Website: business.Website, state: "VIC", hasCafe: false,
      countryCode: "AU", source: { url: business.Website, reviewedAt: "2026-10-01T00:00:00Z" } };
    const directory = [business] as Parameters<typeof createMapPlaces>[3];
    expect(createMapPlaces(snapshot, [], [identity], directory)[0].hasCafe).toBe(true);
    expect(createMapPlaces(snapshot, [reviewed], [identity], directory)[0].hasCafe).toBe(false);
  });
});
