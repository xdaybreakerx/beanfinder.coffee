import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

// Promise to load the Google Maps API
let googleMapsLoadedPromise;

/**
 * Loads the Google Maps API asynchronously using a provided API key.
 * Initializes the loader once and waits for all libraries used by the map.
 * @param {*} apiKey The API key required to load the Google Maps API
 * @returns {*} A promise that resolves when the Google Maps API is successfully loaded.
 */
export function loadGoogleMaps(apiKey) {
  if (!googleMapsLoadedPromise) {
    setOptions({ key: apiKey, v: "beta" });
    googleMapsLoadedPromise = Promise.all(
      ["maps", "places", "geometry", "marker"].map((library) =>
        importLibrary(library)
      )
    );
  }

  return googleMapsLoadedPromise;
}
