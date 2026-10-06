// Bound explicit Place Details requests within a mounted map. Google Cloud
// quotas remain necessary for map loads and widget-managed predictions.
export const BROWSER_DETAILS_LIMIT = 20;
export function createDetailsBudget(limit = BROWSER_DETAILS_LIMIT) {
  let attempts = 0;
  return () => attempts < limit ? (++attempts, true) : false;
}

export function isAustralianSelection(place: Pick<google.maps.places.Place, "addressComponents" | "location">) {
  const country = place.addressComponents?.find(component => component.types.includes("country"));
  return country?.shortText === "AU" && Boolean(place.location &&
    Number.isFinite(place.location.lat()) && Number.isFinite(place.location.lng()) &&
    Math.abs(place.location.lat()) <= 90 && Math.abs(place.location.lng()) <= 180);
}

export function mapsPlaceLink(placeId: string, name: string, directions = false) {
  const query = new URLSearchParams(directions
    ? { api: "1", destination: `${name} Australia`, destination_place_id: placeId }
    : { api: "1", query: `${name} Australia`, query_place_id: placeId });
  return `https://www.google.com/maps/${directions ? "dir" : "search"}/?${query}`;
}
