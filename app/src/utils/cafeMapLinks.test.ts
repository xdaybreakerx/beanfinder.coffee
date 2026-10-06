import { describe, expect, it } from "vitest";
import { getCafeMapLinks } from "./cafeMapLinks";
import { businesses } from './directory';
import { getListingRatings } from './listingRatings';

const listing = { Name: "Test & Coffee", Website: "https://test.coffee/", State: "VIC, NSW", hasCafe: true };
const melbourne = { place_id: "melbourne-id", state: "VIC", latitude: -37.8, longitude: 145, address: "10 High St, Northcote VIC 3070, Australia" };
const sydney = { place_id: "sydney-id", state: "NSW", latitude: -33.8, longitude: 151, address: "10 King St, Newtown NSW 2042, Australia" };

describe("cafe map links", () => {
  it('links all five operator-listed BENCH branches by address without assigning scores or provider IDs', () => {
    const bench = businesses.find(business => business.businessId === 'biz-bench-coffee-co')!;
    const links = getCafeMapLinks(bench, 'VIC');
    expect(links).toHaveLength(5);
    expect(links.every(link => link.locationId && link.address && !link.placeId)).toBe(true);
    expect(new Set(links.map(link => link.locationId)).size).toBe(5);
    const saintDreux = new URL(links[4].href);
    expect(saintDreux.searchParams.get('query')).toContain('SAINT DREUX, LG-30 Emporium Melbourne 287 Lonsdale Street');
    expect(saintDreux.searchParams.has('query_place_id')).toBe(false);
    expect(getListingRatings(bench)).toEqual([]);
    expect(getCafeMapLinks(bench, 'NSW')[0].locationId).toBeUndefined();
  });
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
