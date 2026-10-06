import { COORDINATE_TTL, validCoordinates, type Coordinates } from "../utils/placeCoordinates";
export { COORDINATE_TTL, validCoordinates } from "../utils/placeCoordinates";
export type { Coordinates } from "../utils/placeCoordinates";
import type { MapPlace } from "../utils/mapPlaces";

const COOLDOWN = 60_000;
const DAY = 24 * 60 * 60 * 1000;
export const REFRESH_AHEAD = 2 * DAY;
export const REFRESH_BATCH_SIZE = 4;
const MISSING_RETRY_DELAY = 10 * DAY;

function validBudget(data: any): boolean {
  const timestamps = (value: any) => value && typeof value === "object" && !Array.isArray(value) &&
    Object.values(value).every(time => typeof time === "number" && Number.isFinite(time) && time >= 0);
  return data && typeof data.month === "string" && Number.isInteger(data.count) && data.count >= 0 &&
    timestamps(data.leases) && (data.attemptedAt === undefined || timestamps(data.attemptedAt));
}

// Implementations must provide strong reads and atomic conditional writes.
export interface CoordinateStore {
  list(options: { prefix: string }): Promise<{ blobs: { key: string }[] }>;
  get(key: string, options: { type: "json" }): Promise<any>;
  getWithMetadata(key: string, options: { type: "json" }): Promise<{ data: any; etag?: string } | null>;
  setJSON(key: string, data: unknown, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }): Promise<{ modified: boolean }>;
  delete(key: string): Promise<void>;
}

export function monthlyLimit(raw?: string): number {
  return raw && /^\d+$/.test(raw) ? Math.min(Number(raw), 1000) : 0;
}

export async function purgeExpiredCoordinates(store: CoordinateStore, now = Date.now()) {
  const { blobs } = await store.list({ prefix: "coordinates/" });
  const expired = blobs.filter(({ key }) => {
    const retrieved = Number(key.split("/")[2]);
    return !Number.isFinite(retrieved) || retrieved + COORDINATE_TTL <= now;
  });
  for (let offset = 0; offset < expired.length; offset += 8) {
    // Keys are immutable retrievals: deletion cannot remove a concurrent refresh.
    await Promise.all(expired.slice(offset, offset + 8).map(({ key }) => store.delete(key)));
  }
  return expired.length;
}

async function reserveRequest(store: CoordinateStore, placeId: string, now: number, limit: number) {
  const month = new Date(now).toISOString().slice(0, 7);
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await store.getWithMetadata("request-budget", { type: "json" });
    if (current && !current.etag) return false;
    const data = current?.data;
    if (current && !validBudget(data)) return false;
    const count = data?.month === month ? data.count : 0;
    const leases = Object.fromEntries(Object.entries(data?.leases ?? {}).filter(([, expiry]) => typeof expiry === "number" && expiry > now));
    const attemptedAt = data?.attemptedAt ?? {};
    if (count >= limit || leases[placeId] || Object.keys(leases).length >= 2 || (attemptedAt[placeId] && attemptedAt[placeId] + COOLDOWN > now)) return false;
    const written = await store.setJSON("request-budget", { month, count: count + 1, leases: { ...leases, [placeId]: now + COOLDOWN }, attemptedAt: { ...attemptedAt, [placeId]: now } },
      current ? { onlyIfMatch: current.etag! } : { onlyIfNew: true });
    if (written.modified) return now + COOLDOWN;
  }
  return false;
}

async function releaseRequest(store: CoordinateStore, placeId: string, reservation: number) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await store.getWithMetadata("request-budget", { type: "json" });
    if (!current?.etag || current.data?.leases?.[placeId] !== reservation) return;
    const leases = { ...current.data.leases };
    delete leases[placeId];
    if ((await store.setJSON("request-budget", { ...current.data, leases }, { onlyIfMatch: current.etag })).modified) return;
  }
}

// Map traffic only reads this cache. It cannot trigger Google lookups or spend the budget.
export async function readCachedCoordinates(store: CoordinateStore, places: MapPlace[], now = Date.now()) {
  const allowed = new Set(places.map(place => place.placeId));
  const { blobs } = await store.list({ prefix: "coordinates/" });
  const latest = new Map<string, Coordinates>();
  const candidates = blobs.filter(({ key }) => allowed.has(key.split("/")[1]));
  for (let offset = 0; offset < candidates.length; offset += 8) {
    const results = await Promise.all(candidates.slice(offset, offset + 8).map(async ({ key }) => ({
      placeId: key.split("/")[1], value: await store.get(key, { type: "json" }),
    })));
    for (const { placeId, value } of results) {
      if (validCoordinates(value, placeId, now) && (!latest.has(placeId) || value.retrievedAt > latest.get(placeId)!.retrievedAt)) latest.set(placeId, value);
    }
  }
  return [...latest.values()];
}

export async function getCoordinates(placeId: string, options: {
  places: MapPlace[]; store: CoordinateStore; apiKey?: string; limit: number;
  now?: () => number; fetch?: typeof fetch; refreshAhead?: number;
}): Promise<{ status: number; coordinates?: Coordinates }> {
  if (!options.places.some(place => place.placeId === placeId)) return { status: 404 };
  const now = options.now ?? Date.now;
  let reservation: number | false = false;
  try {
    const { blobs } = await options.store.list({ prefix: `coordinates/${placeId}/` });
    for (const { key } of blobs.sort((a, b) => b.key.localeCompare(a.key))) {
      const value = await options.store.get(key, { type: "json" });
      if (validCoordinates(value, placeId, now())) {
        if (Date.parse(value.expiresAt) - now() > (options.refreshAhead ?? 0)) return { status: 200, coordinates: value };
        continue;
      }
      await options.store.delete(key);
    }
    if (!options.apiKey || options.limit <= 0) return { status: 503 };
    const limit = Math.min(Math.floor(options.limit), 1000);
    if (!Number.isFinite(limit)) return { status: 429 };
    reservation = await reserveRequest(options.store, placeId, now(), limit);
    if (reservation === false) return { status: 429 };
    const response = await (options.fetch ?? fetch)(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { "X-Goog-Api-Key": options.apiKey, "X-Goog-FieldMask": "id,location,addressComponents" },
      redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { status: response.status === 429 ? 429 : 503 };
    const result = await response.json();
    const countryCode = result.addressComponents?.find((component: { types?: string[] }) => component.types?.includes("country"))?.shortText;
    const retrieved = now();
    const coordinates: Coordinates = {
      placeId: result.id, latitude: result.location?.latitude, longitude: result.location?.longitude,
      countryCode, provider: "google-maps", retrievedAt: new Date(retrieved).toISOString(),
      expiresAt: new Date(retrieved + COORDINATE_TTL).toISOString(),
    };
    if (!validCoordinates(coordinates, placeId, retrieved)) return { status: 503 };
    // Only coordinates and real retrieval/expiry timestamps survive the request.
    const saved = await options.store.setJSON(`coordinates/${placeId}/${retrieved}`, coordinates, { onlyIfNew: true });
    if (!saved.modified) return { status: 503 };
    // Delete superseded copies after the replacement has been saved successfully.
    await Promise.all(blobs.filter(({ key }) => key !== `coordinates/${placeId}/${retrieved}`).map(({ key }) => options.store.delete(key)));
    return { status: 200, coordinates };
  } catch {
    // Do not log provider bodies, request URLs or credentials.
    return { status: 503 };
  } finally {
    if (reservation !== false) {
      try { await releaseRequest(options.store, placeId, reservation); } catch { /* Lease expires if storage is unavailable. */ }
    }
  }
}

export async function refreshCoordinates(options: Parameters<typeof getCoordinates>[1]) {
  const now = options.now ?? Date.now;
  await purgeExpiredCoordinates(options.store, now());
  if (!options.apiKey || options.limit <= 0) return { processed: 0, refreshed: 0, failed: 0, disabled: true };
  const cached = new Map((await readCachedCoordinates(options.store, options.places, now())).map(place => [place.placeId, place]));
  const budget = await options.store.getWithMetadata("request-budget", { type: "json" });
  if (budget && !validBudget(budget.data)) return { processed: 0, refreshed: 0, failed: 0, disabled: true };
  const attemptedAt = budget?.data?.attemptedAt ?? {};
  // Retry failed renewals daily while still valid, and missing/invalid IDs every
  // ten days so they cannot exhaust the allowance before valid places renew.
  // Prioritize near-expiry records,
  // then the least-recently-attempted missing IDs so failures cannot starve others.
  const due = options.places.filter(place => {
    const entry = cached.get(place.placeId);
    return (!entry || Date.parse(entry.expiresAt) - now() <= REFRESH_AHEAD) &&
      (!attemptedAt[place.placeId] || now() - attemptedAt[place.placeId] >= (entry ? DAY : MISSING_RETRY_DELAY));
  }).sort((a, b) => {
    const aExpiry = cached.has(a.placeId) ? Date.parse(cached.get(a.placeId)!.expiresAt) : Infinity;
    const bExpiry = cached.has(b.placeId) ? Date.parse(cached.get(b.placeId)!.expiresAt) : Infinity;
    return (aExpiry === bExpiry ? 0 : aExpiry - bExpiry) || (attemptedAt[a.placeId] ?? 0) - (attemptedAt[b.placeId] ?? 0);
  }).slice(0, REFRESH_BATCH_SIZE);
  const results: Array<Awaited<ReturnType<typeof getCoordinates>>> = [];
  for (let offset = 0; offset < due.length; offset += 2) {
    results.push(...await Promise.all(due.slice(offset, offset + 2).map(place => getCoordinates(place.placeId, { ...options, refreshAhead: REFRESH_AHEAD }))));
  }
  return { processed: due.length, refreshed: results.filter(result => result.status === 200).length,
    failed: results.filter(result => result.status !== 200).length, disabled: false };
}
