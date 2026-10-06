import stored from "../data/coffee-roasters-updated-from-place_ids.json";
import { getSavedLocations, type SavedListing } from "./savedLocations";

type Listing = { businessId?: string; websiteAliases?: string[]; Name: string; Website: string; State: string; hasCafe: boolean };
type CafeLink = { href: string; placeId?: string; locality?: string; address?: string };

export function getCafeMapLinks(listing: Listing, state?: string, locations: SavedListing[] = stored): CafeLink[] {
  if (!listing.hasCafe) return [];
  const seen = new Set<string>();
  const places = getSavedLocations(listing, locations);
  const links = places.flatMap(place => {
    if (!place.place_id || seen.has(place.place_id) || place.hasCafe === false ||
        (state && place.state !== state)) return [];
    seen.add(place.place_id);
    const address = typeof place.address === "string" ? place.address : "";
    const url = new URL("https://www.google.com/maps/search/");
    url.search = new URLSearchParams({ api: "1", query: `${listing.Name}, ${address || "Australia"}`, query_place_id: place.place_id }).toString();
    // Google's formatted addresses end with the country. Keep the preceding
    // locality/state/postcode text exactly as supplied, without guessing a suburb.
    const parts = address.split(",").map(part => part.trim()).filter(Boolean);
    const locality = parts.at(-1)?.toLowerCase() === "australia" ? parts.at(-2) : undefined;
    return [{ href: url.href, placeId: place.place_id, locality: locality || place.label || place.state, address }];
  });
  if (links.length) return links;
  const region = state || (listing.State.toLowerCase() === "all" ? "" : listing.State);
  const url = new URL("https://www.google.com/maps/search/");
  url.search = new URLSearchParams({ api: "1", query: `${listing.Name} ${region} Australia`.replace(/\s+/g, " ").trim() }).toString();
  return [{ href: url.href }];
}
