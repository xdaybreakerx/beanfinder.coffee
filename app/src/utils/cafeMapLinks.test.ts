import { describe, expect, it } from "vitest";
import { getCafeMapLinks } from "./cafeMapLinks";

const listing = { Name: "Test & Coffee", Website: "https://test.coffee/", State: "VIC, NSW", hasCafe: true };
const melbourne = { place_id: "melbourne-id", state: "VIC", latitude: -37.8, longitude: 145, address: "10 High St, Northcote VIC 3070, Australia" };
const sydney = { place_id: "sydney-id", state: "NSW", latitude: -33.8, longitude: 151, address: "10 King St, Newtown NSW 2042, Australia" };

describe("cafe map links", () => {
  it("links each saved Australian location precisely and exposes its locality", () => {
    const links = getCafeMapLinks(listing, undefined, [{ Website: listing.Website, place_ids: [melbourne, sydney, melbourne] }]);
    expect(links.map(link => link.locality)).toEqual(["Northcote VIC 3070", "Newtown NSW 2042"]);
    const url = new URL(links[0].href);
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query_place_id")).toBe("melbourne-id");
    expect(url.searchParams.get("query")).toBe(`${listing.Name}, ${melbourne.address}`);
  });

  it("keeps state pages focused on locations in that state", () => {
    const links = getCafeMapLinks(listing, "NSW", [{ Website: listing.Website, place_ids: [melbourne, sydney] }]);
    expect(links).toHaveLength(1);
    expect(new URL(links[0].href).searchParams.get("query_place_id")).toBe("sydney-id");
  });

  it("uses a labelled search fallback for missing or overseas location data", () => {
    for (const places of [[], [{ ...melbourne, countryCode: "CA" }]]) {
      const [link] = getCafeMapLinks(listing, "NSW", [{ Website: listing.Website, place_ids: places }]);
      expect(link.locality).toBeUndefined();
      const url = new URL(link.href);
      expect(url.searchParams.has("query_place_id")).toBe(false);
      expect(url.searchParams.get("query")).toBe("Test & Coffee NSW Australia");
    }
  });

  it("does not associate another business's website or add cafe links to online-only listings", () => {
    const links = getCafeMapLinks(listing, undefined, [{ Website: "https://unrelated.coffee/", place_ids: [melbourne] }]);
    expect(new URL(links[0].href).searchParams.has("query_place_id")).toBe(false);
    expect(getCafeMapLinks({ ...listing, hasCafe: false })).toEqual([]);
  });
});
