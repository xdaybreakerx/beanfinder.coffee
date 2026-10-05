// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createAustralianPois, isAustralianPlace } from "./australianPlaces";
import { findAustralianPlace, getAustralianPlaceDetails } from "../scripts/google-places.mjs";
import stored from "../data/coffee-roasters-updated-from-place_ids.json";
const local = { latitude: -37.81, longitude: 144.96, address: "Collins St, Melbourne VIC, Australia" };
const foreign = { latitude: 46.11, longitude: -60.17, address: "Reservoir Rd, Sydney, NS, Canada" };
const response = (data: unknown) => vi.fn(async () => Response.json(data)) as unknown as typeof fetch;

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

describe("Google Places enrichment", () => {
  it("skips a foreign first candidate and selects an Australian candidate", async () => {
    const fetcher = response({ status: "OK", candidates: [
      { place_id: "canadian-sydney", formatted_address: foreign.address, geometry: { location: { lat: foreign.latitude, lng: foreign.longitude } } },
      { place_id: "australian-sydney", formatted_address: local.address, geometry: { location: { lat: local.latitude, lng: local.longitude } } },
    ] });
    expect(await findAustralianPlace("121 Coffee", "NSW", { apiKey: "test-key", fetch: fetcher })).toBe("australian-sydney");
    const url = vi.mocked(fetcher).mock.calls[0][0] as URL;
    expect(url.searchParams.get("fields")).toContain("formatted_address");
    expect(url.searchParams.get("locationbias")).toContain("rectangle:");
  });
  it("drops a non-Australian or missing country component even when its address says Australia", async () => {
    for (const country of ["CA", undefined]) {
      const fetcher = response({ status: "OK", result: { formatted_address: local.address, geometry: { location: { lat: local.latitude, lng: local.longitude } }, address_components: country ? [{ short_name: country, types: ["country", "political"] }] : [] } });
      expect(await getAustralianPlaceDetails("id", { apiKey: "test-key", fetch: fetcher })).toBeUndefined();
    }
  });
  it("persists the verified country alongside valid geometry and a zero rating", async () => {
    const fetcher = response({ status: "OK", result: { formatted_address: local.address, geometry: { location: { lat: local.latitude, lng: local.longitude } }, rating: 0, address_components: [{ short_name: "AU", types: ["country", "political"] }] } });
    expect(await getAustralianPlaceDetails("id", { apiKey: "test-key", fetch: fetcher })).toEqual({ ...local, countryCode: "AU", rating: 0 });
  });
  it("handles zero results and fails API errors without echoing credentials", async () => {
    expect(await findAustralianPlace("Coffee", "VIC", { apiKey: "test-key", fetch: response({ status: "ZERO_RESULTS" }) })).toBeUndefined();
    await expect(getAustralianPlaceDetails("id", { apiKey: "secret", fetch: response({ status: "REQUEST_DENIED", error_message: "secret" }) })).rejects.toThrow("Google Places returned REQUEST_DENIED");
    await expect(getAustralianPlaceDetails("id", { apiKey: "", fetch: response({}) })).rejects.toThrow("GOOGLE_MAPS_API_KEY");
  });
});
