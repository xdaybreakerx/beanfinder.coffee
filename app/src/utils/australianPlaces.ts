export type PlaceLocation = {
  latitude?: unknown;
  longitude?: unknown;
  address?: unknown;
  countryCode?: unknown;
};

export function isAustralianPlace(place: PlaceLocation): boolean {
  if (typeof place.latitude !== "number" || typeof place.longitude !== "number" ||
      !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude) ||
      Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180) return false;
  // New enrichment uses Google's country component. Older checked-in records
  // have only a formatted address; accept its final country token, not substrings.
  if (place.countryCode !== undefined) return typeof place.countryCode === "string" && place.countryCode.toUpperCase() === "AU";
  return typeof place.address === "string" && /(?:^|,)\s*Australia\s*$/i.test(place.address);
}

type Roaster = { Name: string; place_ids?: Array<PlaceLocation & { place_id?: string; state?: string; rating?: number | string }> };
export function createAustralianPois(roasters: Roaster[]) {
  const seen = new Set<string>();
  return roasters.flatMap(roaster => (roaster.place_ids ?? []).flatMap(place => {
    if (!place.place_id || seen.has(place.place_id) || !isAustralianPlace(place)) return [];
    seen.add(place.place_id);
    return [{
      key: place.place_id, place_id: place.place_id,
      location: { lat: place.latitude as number, lng: place.longitude as number },
      name: place.state ? `${roaster.Name} (${place.state})` : roaster.Name,
      address: typeof place.address === "string" ? place.address : "",
      rating: place.rating ?? "N/A",
    }];
  }));
}
