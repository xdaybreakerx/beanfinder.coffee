// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { COORDINATE_TTL, getCoordinates, monthlyLimit, purgeExpiredCoordinates, readCachedCoordinates, refreshCoordinates, REFRESH_AHEAD, validCoordinates, type CoordinateStore } from "./place-coordinates";
import { validateReviewedPlaces, type ReviewedPlace } from "../utils/reviewedPlaces";

const place: ReviewedPlace = { locationId: "loc-reviewed", businessId: "biz-reviewed", hasCafe: true, placeId: "reviewed-id", Name: "Reviewed Coffee", Website: "https://coffee.example/", state: "VIC", countryCode: "AU", source: { url: "https://coffee.example/locations", reviewedAt: "2026-10-01T00:00:00Z" } };
const start = Date.parse("2026-10-06T00:00:00Z");
const provider = () => ({ id: place.placeId, location: { latitude: -37.8, longitude: 145 }, addressComponents: [{ shortText: "AU", types: ["country"] }], rating: 4.9, formattedAddress: "Never persist", userRatingCount: 10 });

// Models atomic compare-and-swap across independently executing requests.
function store() {
  const entries = new Map<string, { data: any; etag: string }>();
  let version = 0;
  const storage: CoordinateStore = {
    list: async ({ prefix }) => ({ blobs: [...entries.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }),
    get: async key => structuredClone(entries.get(key)?.data ?? null),
    getWithMetadata: async key => structuredClone(entries.get(key) ?? null),
    setJSON: async (key, data, condition = {}) => {
      const previous = entries.get(key);
      if ((condition.onlyIfNew && previous) || (condition.onlyIfMatch && previous?.etag !== condition.onlyIfMatch)) return { modified: false };
      entries.set(key, { data: structuredClone(data), etag: String(++version) });
      return { modified: true };
    },
    delete: async key => { entries.delete(key); },
  };
  return { storage, entries };
}

function setup() {
  const { storage, entries } = store();
  let time = start;
  const fetcher = vi.fn(async () => Response.json(provider())) as unknown as typeof fetch;
  const options = { places: [place], store: storage, apiKey: "test-key", limit: 10, now: () => time, fetch: fetcher };
  return { options, entries, fetcher, advance: (ms: number) => { time += ms; } };
}

describe("forward-looking coordinates", () => {
  it("retrieves only reviewed places with a minimal mask and real expiry, excluding scores and addresses", async () => {
    const { options, entries, fetcher } = setup();
    expect(await getCoordinates("unknown", options)).toEqual({ status: 404 });
    expect(entries.size).toBe(0);
    const result = await getCoordinates(place.placeId, options);
    expect(result.status).toBe(200);
    expect(result.coordinates).toEqual({ placeId: place.placeId, latitude: -37.8, longitude: 145, countryCode: "AU", provider: "google-maps", retrievedAt: new Date(start).toISOString(), expiresAt: new Date(start + COORDINATE_TTL).toISOString() });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(`https://places.googleapis.com/v1/places/${place.placeId}`, expect.objectContaining({ headers: { "X-Goog-Api-Key": "test-key", "X-Goog-FieldMask": "id,location,addressComponents" } }));
    expect(JSON.stringify([...entries.values()])).not.toMatch(/rating|formattedAddress|test-key/);
  });

  it("reuses unexpired coordinates and removes expired entries before a failed refresh", async () => {
    const { options, entries, fetcher, advance } = setup();
    await getCoordinates(place.placeId, options);
    expect((await getCoordinates(place.placeId, options)).status).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
    advance(COORDINATE_TTL);
    vi.mocked(fetcher).mockRejectedValue(new Error("Provider error with secret"));
    expect(await getCoordinates(place.placeId, options)).toEqual({ status: 503 });
    expect([...entries.keys()].filter(key => key.startsWith("coordinates/"))).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("purges without making API calls and leaves newer immutable refreshes alone", async () => {
    const { options, entries, fetcher, advance } = setup();
    await getCoordinates(place.placeId, options);
    const older = [...entries.keys()].find(key => key.startsWith("coordinates/"))!;
    advance(COORDINATE_TTL);
    await getCoordinates(place.placeId, options);
    // Emulate an old entry still present when cleanup runs concurrently with refresh.
    entries.set(older, { data: {}, etag: "old" });
    expect(await purgeExpiredCoordinates(options.store, start + COORDINATE_TTL)).toBe(1);
    expect([...entries.keys()].filter(key => key.startsWith("coordinates/"))).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("fails closed for missing configuration, quota denial, storage errors and malformed budgets", async () => {
    const { options, fetcher, entries } = setup();
    expect(await getCoordinates(place.placeId, { ...options, apiKey: undefined })).toEqual({ status: 503 });
    expect(await getCoordinates(place.placeId, { ...options, limit: 0 })).toEqual({ status: 503 });
    entries.set("request-budget", { data: { month: "2026-10", count: 10, leases: {} }, etag: "10" });
    expect(await getCoordinates(place.placeId, options)).toEqual({ status: 429 });
    entries.set("request-budget", { data: { month: "2026-10", count: "bad", leases: {} }, etag: "11" });
    expect(await getCoordinates(place.placeId, options)).toEqual({ status: 429 });
    options.store.list = async () => { throw new Error("Storage down"); };
    expect(await getCoordinates(place.placeId, options)).toEqual({ status: 503 });
    expect(fetcher).not.toHaveBeenCalled();
    expect([undefined, "", "-1", "NaN", "1.5"].map(monthlyLimit)).toEqual([0, 0, 0, 0, 0]);
    expect(monthlyLimit("5000")).toBe(1000);
  });

  it("atomically limits concurrent requests and duplicate refreshes, including failed attempts", async () => {
    const { options, fetcher, advance } = setup();
    const places = [place, { ...place, placeId: "second" }, { ...place, placeId: "third" }];
    const failingFetch = vi.fn(async () => Response.json({}, { status: 429 })) as unknown as typeof fetch;
    const bounded = { ...options, places, limit: 1, fetch: failingFetch };
    const responses = await Promise.all(places.map(p => getCoordinates(p.placeId, bounded)));
    expect(responses.every(result => result.status === 429)).toBe(true);
    expect(failingFetch).toHaveBeenCalledOnce();
    advance(60_001);
    expect((await getCoordinates(place.placeId, bounded)).status).toBe(429);
    expect(failingFetch).toHaveBeenCalledOnce();
    expect(fetcher).not.toHaveBeenCalled();

    const duplicate = setup();
    await Promise.all([getCoordinates(place.placeId, duplicate.options), getCoordinates(place.placeId, duplicate.options)]);
    expect(duplicate.fetcher).toHaveBeenCalledOnce();
  });

  it("rolls the monthly budget over while preserving active request leases", async () => {
    const { options, fetcher, entries } = setup();
    entries.set("request-budget", { data: { month: "2026-09", count: 1000, leases: { [place.placeId]: start + 1000 } }, etag: "1" });
    expect((await getCoordinates(place.placeId, options)).status).toBe(429);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await getCoordinates(place.placeId, { ...options, now: () => start + 1001 })).status).toBe(200);
    expect(entries.get("request-budget")?.data.count).toBe(1);
  });

  it.each([
    { ...provider(), id: "different" },
    { ...provider(), location: { latitude: NaN, longitude: 145 } },
    { ...provider(), addressComponents: [{ shortText: "NZ", types: ["country"] }] },
    { ...provider(), addressComponents: [] },
  ])("rejects unmatched, invalid or non-Australian responses", async result => {
    const { options, entries } = setup();
    options.fetch = vi.fn(async () => Response.json(result)) as unknown as typeof fetch;
    expect((await getCoordinates(place.placeId, options)).status).toBe(503);
    expect([...entries.keys()].some(key => key.startsWith("coordinates/"))).toBe(false);
  });

  it("rejects stale, future, overlong and polluted cached responses", async () => {
    const { options } = setup();
    const good = (await getCoordinates(place.placeId, options)).coordinates!;
    expect(validCoordinates(good, place.placeId, start)).toBe(true);
    expect(validCoordinates(good, place.placeId, start - 1)).toBe(false);
    expect(validCoordinates(good, place.placeId, start + COORDINATE_TTL)).toBe(false);
    expect(validCoordinates({ ...good, expiresAt: new Date(start + COORDINATE_TTL + 1).toISOString() }, place.placeId, start)).toBe(false);
    expect(validCoordinates({ ...good, rating: 4.9 }, place.placeId, start)).toBe(false);
  });
});

describe("independently reviewed registry", () => {
  it("requires valid unique place IDs, a listing reference and a source, and rejects provider fields", () => {
    const listings = [{ businessId: place.businessId, Website: place.Website }];
    const { Website, ...record } = place;
    expect(validateReviewedPlaces([record], listings)).toEqual([place]);
    for (const input of [[record, record], [{ ...record, latitude: -37.8 }], [{ ...record, rating: 5 }], [{ ...record, countryCode: "NZ" }], [{ ...record, source: null }]]) {
      expect(() => validateReviewedPlaces(input, listings)).toThrow();
    }
    expect(() => validateReviewedPlaces([record], [])).toThrow();
  });
});

const DAY = 24 * 60 * 60 * 1000;
describe("rolling coordinate refresh", () => {
  it("renews at day 27, deletes superseded copies and leaves fresh locations alone", async () => {
    const { options, entries, fetcher, advance } = setup();
    expect(await refreshCoordinates(options)).toMatchObject({ processed: 1, refreshed: 1 });
    expect(await refreshCoordinates(options)).toMatchObject({ processed: 0 });
    advance(COORDINATE_TTL - REFRESH_AHEAD - 1);
    expect(await refreshCoordinates(options)).toMatchObject({ processed: 0 });
    advance(1);
    expect(await refreshCoordinates(options)).toMatchObject({ processed: 1, refreshed: 1 });
    const cached = await readCachedCoordinates(options.store, options.places, options.now());
    expect(cached).toHaveLength(1);
    expect(Date.parse(cached[0].retrievedAt)).toBe(start + 27 * DAY);
    expect([...entries.keys()].filter(key => key.startsWith("coordinates/"))).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("retains valid coordinates after failed renewal, backs off, then deletes them at expiry", async () => {
    const { options, fetcher, advance } = setup();
    await refreshCoordinates(options);
    advance(27 * DAY);
    vi.mocked(fetcher).mockRejectedValue(new Error("Provider down"));
    expect(await refreshCoordinates(options)).toMatchObject({ processed: 1, failed: 1 });
    expect(await readCachedCoordinates(options.store, options.places, options.now())).toHaveLength(1);
    advance(DAY - 1);
    expect(await refreshCoordinates(options)).toMatchObject({ processed: 0 });
    advance(1);
    expect(await refreshCoordinates(options)).toMatchObject({ processed: 1, failed: 1 });
    advance(DAY);
    await refreshCoordinates(options);
    expect(await readCachedCoordinates(options.store, options.places, options.now())).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("processes at most four locations with two simultaneous lookups and a shared cap", async () => {
    const { options, entries } = setup();
    const places = Array.from({ length: 9 }, (_, i) => ({ ...place, placeId: `place-${i}` }));
    let active = 0, peak = 0;
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
      return Response.json({ ...provider(), id: String(url).split("/").pop() });
    }) as unknown as typeof fetch;
    const bounded = { ...options, places, fetch: fetcher, limit: 5 };
    expect(await refreshCoordinates(bounded)).toMatchObject({ processed: 4, refreshed: 4 });
    expect(peak).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(await refreshCoordinates(bounded)).toMatchObject({ processed: 4, refreshed: 1 });
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(entries.get("request-budget")?.data.count).toBe(5);
    expect(entries.get("request-budget")?.data.leases).toEqual({});
  });

  it("keeps failed IDs from starving other locations and retains backoff across months", async () => {
    const { options, advance, fetcher } = setup();
    options.places = Array.from({ length: 6 }, (_, i) => ({ ...place, placeId: `place-${i}` }));
    vi.mocked(fetcher).mockImplementation(async url => Response.json({ ...provider(), id: String(url).split("/").pop() }, { status: 503 }));
    expect(await refreshCoordinates(options)).toMatchObject({ processed: 4, failed: 4 });
    advance(60 * 60 * 1000);
    expect(await refreshCoordinates(options)).toMatchObject({ processed: 2, failed: 2 });
    advance(DAY);
    expect(await refreshCoordinates(options)).toMatchObject({ processed: 0 });
    advance(9 * DAY);
    expect(await refreshCoordinates(options)).toMatchObject({ processed: 4, failed: 4 });
    // A month rollover resets the count, but not a failure's retry delay.
    const later = { ...options, now: () => Date.parse("2026-11-01T00:00:00Z") };
    await refreshCoordinates({ ...later, limit: 1000 });
    expect(await refreshCoordinates({ ...later, now: () => Date.parse("2026-11-02T00:00:00Z"), limit: 1000 })).toMatchObject({ processed: 2 });
    expect(await refreshCoordinates({ ...later, now: () => Date.parse("2026-11-03T00:00:00Z"), limit: 1000 })).toMatchObject({ processed: 0 });
  });

  it("serves only the latest valid allowed coordinates without spending a request", async () => {
    const { options, entries, fetcher, advance } = setup();
    const first = (await getCoordinates(place.placeId, options)).coordinates!;
    advance(DAY);
    entries.set(`coordinates/${place.placeId}/${start + DAY}`, { data: { ...first, retrievedAt: new Date(start + DAY).toISOString(), expiresAt: new Date(start + DAY + COORDINATE_TTL).toISOString() }, etag: "newer" });
    entries.set(`coordinates/unknown/${start}`, { data: { ...first, placeId: "unknown" }, etag: "unknown" });
    entries.set(`coordinates/${place.placeId}/${start + 2 * DAY}`, { data: { ...first, rating: 5 }, etag: "polluted" });
    const cached = await readCachedCoordinates(options.store, options.places, options.now());
    expect(cached).toHaveLength(1);
    expect(Date.parse(cached[0].retrievedAt)).toBe(start + DAY);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(entries.get("request-budget")?.data.count).toBe(1);
  });

  it("cleans up when disabled and rejects corrupt retry metadata before any lookup", async () => {
    const { options, entries, fetcher, advance } = setup();
    await refreshCoordinates(options);
    advance(COORDINATE_TTL);
    expect(await refreshCoordinates({ ...options, apiKey: undefined })).toMatchObject({ disabled: true, processed: 0 });
    expect([...entries.keys()].some(key => key.startsWith("coordinates/"))).toBe(false);
    entries.set("request-budget", { data: { month: "2026-11", count: 0, leases: {}, attemptedAt: { bad: "invalid" } }, etag: "bad" });
    expect(await refreshCoordinates(options)).toMatchObject({ disabled: true, processed: 0 });
    expect((await getCoordinates(place.placeId, options)).status).toBe(429);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
