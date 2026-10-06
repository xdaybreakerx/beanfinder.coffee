import { useEffect, useMemo, useState } from "react";
import { mapPlaces } from "../utils/mapPlaces";
import { validCoordinates, type Coordinates } from "../utils/placeCoordinates";

// Automatically display all valid cached locations. This endpoint never calls Google.
// Recheck hourly and on returning to the tab; retain existing valid markers on errors.
export function useReviewedCoordinates(enabled = true) {
  const [coordinates, setCoordinates] = useState<Coordinates[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || !mapPlaces.length) return;
    let controller: AbortController | undefined;
    let active = true;
    const allowed = new Set(mapPlaces.map(place => place.placeId));
    const update = async () => {
      if (controller) return;
      controller = new AbortController();
      setPending(true);
      try {
        const response = await fetch("/.netlify/functions/place-coordinates", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unavailable");
        const result = await response.json();
        if (!Array.isArray(result.coordinates) || !Array.isArray(result.missingPlaceIds)) throw new Error("Invalid response");
        const seen = new Set<string>();
        const valid = result.coordinates.filter((entry: Coordinates) => {
          if (!allowed.has(entry?.placeId) || seen.has(entry.placeId) || !validCoordinates(entry, entry.placeId, Date.now())) return false;
          seen.add(entry.placeId);
          return true;
        });
        if (active) {
          setCoordinates(valid);
          setLoaded(true);
          setError(null);
        }
      } catch {
        if (active && !controller.signal.aborted) setError("Some locations could not be updated. The directory and Google Maps links are still available.");
      } finally {
        controller = undefined;
        if (active) setPending(false);
      }
    };
    const onVisibility = () => { if (document.visibilityState === "visible") void update(); };
    void update();
    const interval = setInterval(() => { if (document.visibilityState === "visible") void update(); }, 60 * 60 * 1000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { active = false; controller?.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, [enabled]);

  useEffect(() => {
    if (!coordinates.length) return;
    const remaining = Math.min(...coordinates.map(item => Date.parse(item.expiresAt) - Date.now()));
    const timer = setTimeout(() => setCoordinates(current => current.filter(item => validCoordinates(item, item.placeId, Date.now()))), Math.max(0, Math.min(remaining, 2_147_483_647)));
    return () => clearTimeout(timer);
  }, [coordinates]);

  const pois = useMemo(() => coordinates.filter(item => validCoordinates(item, item.placeId, Date.now())).map(item => {
    const place = mapPlaces.find(place => place.placeId === item.placeId)!;
    return { key: item.placeId, place_id: item.placeId, location: { lat: item.latitude, lng: item.longitude },
      name: place.state ? `${place.Name} (${place.state})` : place.Name, address: "", rating: "N/A" };
  }), [coordinates]);
  const missingPlaceIds = loaded ? mapPlaces.filter(place => !pois.some(poi => poi.place_id === place.placeId)).map(place => place.placeId) : [];
  return { pois, pending, error, missingPlaceIds };
}
