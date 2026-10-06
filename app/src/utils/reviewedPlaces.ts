import records from "../data/reviewed-places.json";
import roasters from "../data/coffee-roasters.json";
import sellers from "../data/coffee-roasters-multi.json";

export type ReviewedPlace = {
  placeId: string;
  Name: string;
  Website: string;
  state: string;
  countryCode: "AU";
  source: { url: string; reviewedAt: string };
};

// Place IDs and independently reviewed facts may live in Git. Google responses may not.
export function validateReviewedPlaces(input: unknown, listings: { Website: string }[]): ReviewedPlace[] {
  if (!Array.isArray(input)) throw new Error("Reviewed places must be an array");
  const seen = new Set<string>();
  for (const place of input) {
    if (!place || typeof place.placeId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(place.placeId) || seen.has(place.placeId) ||
        typeof place.Name !== "string" || !place.Name.trim() || place.countryCode !== "AU" ||
        !/^(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)$/.test(place.state) ||
        !listings.some(listing => listing.Website === place.Website) ||
        typeof place.source?.url !== "string" || typeof place.source?.reviewedAt !== "string" || !Number.isFinite(Date.parse(place.source.reviewedAt)) ||
        Date.parse(place.source.reviewedAt) > Date.now() || Object.keys(place.source).some(key => !["url", "reviewedAt"].includes(key)) ||
        Object.keys(place).some(key => !["placeId", "Name", "Website", "state", "countryCode", "source"].includes(key))) {
      throw new Error("Invalid reviewed place identity, source or listing reference");
    }
    const url = new URL(place.source.url);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid reviewed source URL");
    seen.add(place.placeId);
  }
  return input;
}

export const reviewedPlaces = validateReviewedPlaces(records, [...roasters, ...sellers]);
