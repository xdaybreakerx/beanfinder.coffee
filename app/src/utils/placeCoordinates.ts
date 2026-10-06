import { isAustralianPlace } from "./australianPlaces";

// 29 days leaves one day for the daily purge before the 30-day retention limit.
export const COORDINATE_TTL = 29 * 24 * 60 * 60 * 1000;
export type Coordinates = {
  placeId: string;
  latitude: number;
  longitude: number;
  countryCode: "AU";
  provider: "google-maps";
  retrievedAt: string;
  expiresAt: string;
};

export function validCoordinates(value: unknown, placeId: string, now: number): value is Coordinates {
  const entry = value as Coordinates | null;
  if (!entry || entry.placeId !== placeId || entry.provider !== "google-maps" || entry.countryCode !== "AU" || !isAustralianPlace(entry) ||
      Object.keys(entry).some(key => !["placeId", "latitude", "longitude", "countryCode", "provider", "retrievedAt", "expiresAt"].includes(key))) return false;
  const retrieved = Date.parse(entry.retrievedAt), expires = Date.parse(entry.expiresAt);
  return Number.isFinite(retrieved) && Number.isFinite(expires) && retrieved <= now &&
    expires > now && expires > retrieved && expires - retrieved <= COORDINATE_TTL;
}

