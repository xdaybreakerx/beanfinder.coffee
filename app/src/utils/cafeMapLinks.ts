import stored from "../data/coffee-roasters-updated-from-place_ids.json";
import { getSavedLocations, type SavedListing } from "./savedLocations";

type Listing = { businessId?: string; websiteAliases?: string[]; Name: string; Website: string; State: string; hasCafe: boolean };
type CafeLink = { href: string; placeId?: string; locationId?: string; locality?: string; address?: string };

export function getCafeMapLinks(listing: Listing, state?: string, locations: SavedListing[] = stored): CafeLink[] {
  if (!listing.hasCafe) return [];
  const seen = new Set<string>();
  const places = getSavedLocations(listing, locations);
  const links = places.flatMap(place => {
    const identity = place.place_id ?? place.locationId;
    if (!identity || seen.has(identity) || place.hasCafe === false ||
        (state && place.state !== state)) return [];
    seen.add(identity);
    const address = typeof place.address === "string" ? place.address : "";
    const url = new URL("https://www.google.com/maps/search/");
    url.search = new URLSearchParams({ api: "1", query: `${place.label ?? listing.Name}, ${address || "Australia"}`,
      ...(place.place_id ? { query_place_id: place.place_id } : {}) }).toString();
    // Saved and independently reviewed addresses end with the country. Keep
    // their locality/state/postcode text without guessing a suburb.
    const parts = address.split(",").map(part => part.trim()).filter(Boolean);
    const locality = parts.at(-1)?.toLowerCase() === "australia" ? parts.at(-2) : undefined;
    return [{ href: url.href, placeId: place.place_id, locationId: place.locationId, locality: locality || place.label || place.state, address }];
  });
  if (links.length) return links;
  const region = state || (listing.State.toLowerCase() === "all" ? "" : listing.State);
  const url = new URL("https://www.google.com/maps/search/");
  url.search = new URLSearchParams({ api: "1", query: `${listing.Name} ${region} Australia`.replace(/\s+/g, " ").trim() }).toString();
  return [{ href: url.href }];
}
