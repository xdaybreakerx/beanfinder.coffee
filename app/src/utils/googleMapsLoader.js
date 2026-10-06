import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

// Promise to load the Google Maps API
let googleMapsLoadedPromise;
export const MAPS_CHANNEL = "weekly";
export const MAPS_AUTH_FAILURE_EVENT = "beanfinder:maps-auth-failure";

/**
 * Loads the Google Maps API asynchronously using a provided API key.
 * Initializes the loader once and waits for all libraries used by the map.
 * @param {*} apiKey The API key required to load the Google Maps API
 * @returns {*} A promise that resolves when the Google Maps API is successfully loaded.
 */
export function loadGoogleMaps(apiKey) {
  if (!googleMapsLoadedPromise) {
    // Authentication can fail after the loader promise has resolved.
    if (typeof window !== "undefined") {
      window.gm_authFailure = () => window.dispatchEvent(new Event(MAPS_AUTH_FAILURE_EVENT));
    }
    setOptions({ key: apiKey, v: MAPS_CHANNEL });
    googleMapsLoadedPromise = Promise.all(
      ["maps", "marker"].map((library) =>
        importLibrary(library)
      )
    );
  }

  return googleMapsLoadedPromise;
}
