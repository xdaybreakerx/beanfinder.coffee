// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createAustralianPois, isAustralianPlace } from "./australianPlaces";
import stored from "../data/coffee-roasters-updated-from-place_ids.json";
const local = { latitude: -37.81, longitude: 144.96, address: "Collins St, Melbourne VIC, Australia" };
const foreign = { latitude: 46.11, longitude: -60.17, address: "Reservoir Rd, Sydney, NS, Canada" };

describe("Australian map locations", () => {
  it("accepts country-verified Australian locations and legacy Australian addresses", () => {
    expect(isAustralianPlace(local)).toBe(true);
    expect(isAustralianPlace({ ...local, countryCode: "AU" })).toBe(true);
    expect(isAustralianPlace({ countryCode: "AU", latitude: -12.1, longitude: 96.9 })).toBe(true);
  });
  it("rejects international namesakes and treats a structured country as authoritative", () => {
    expect(isAustralianPlace(foreign)).toBe(false);
    expect(isAustralianPlace({ ...local, countryCode: "NZ" })).toBe(false);
    expect(isAustralianPlace({ ...local, address: "Australia Coffee, Portland, USA" })).toBe(false);
    expect(isAustralianPlace({ ...local, countryCode: null })).toBe(false);
  });
  it.each([undefined, NaN, Infinity, 91, "-37.8"])("rejects invalid latitude %s", latitude => {
    expect(isAustralianPlace({ ...local, latitude })).toBe(false);
  });
  it("filters and deduplicates marker data without dropping its directory listing", () => {
    const poi = { ...local, place_id: "australian-id", state: "VIC", rating: 0 };
    const markers = createAustralianPois([{ Name: "Australian roaster", place_ids: [poi, { ...foreign, place_id: "overseas" }, { place_id: "incomplete" }] }, { Name: "Same location", place_ids: [poi] }]);
    expect(markers).toHaveLength(1);
    expect(markers[0].rating).toBe(0);
    expect(markers[0].location).toEqual({ lat: local.latitude, lng: local.longitude });
  });
  it("keeps every current stored coordinate inside the Australian country filter", () => {
    for (const roaster of stored) for (const place of roaster.place_ids ?? []) if ('latitude' in place) expect(isAustralianPlace(place)).toBe(true);
  });
});
