import { isAustralianPlace } from "../utils/australianPlaces.ts";

async function request(endpoint, params, { apiKey, fetch: fetcher = fetch }) {
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  const url = new URL(`https://maps.googleapis.com/maps/api/place/${endpoint}/json`);
  url.search = new URLSearchParams({ language: "en", ...params, key: apiKey }).toString();
  const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Google Places returned HTTP ${response.status}`);
  const data = await response.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS" && data.status !== "NOT_FOUND") {
    throw new Error(`Google Places returned ${data.status ?? "an invalid response"}`);
  }
  return data;
}

export async function findAustralianPlace(name, state, options) {
  const data = await request("findplacefromtext", {
    input: `${name} ${state} Australia`, inputtype: "textquery",
    fields: "place_id,formatted_address,geometry",
    locationbias: "rectangle:-44.5,112|-9,154.5",
  }, options);
  return (data.candidates ?? []).find(candidate => candidate.place_id && isAustralianPlace({
    latitude: candidate.geometry?.location?.lat,
    longitude: candidate.geometry?.location?.lng,
    address: candidate.formatted_address,
  }))?.place_id;
}

export async function getAustralianPlaceDetails(placeId, options) {
  const data = await request("details", {
    place_id: placeId, fields: "geometry,formatted_address,address_components,rating",
  }, options);
  if (!data.result) return undefined;
  const result = data.result;
  const place = {
    latitude: result.geometry?.location?.lat,
    longitude: result.geometry?.location?.lng,
    address: result.formatted_address,
    countryCode: result.address_components?.find(component => component.types?.includes("country"))?.short_name ?? null,
    rating: result.rating ?? "N/A",
  };
  return isAustralianPlace(place) ? place : undefined;
}
