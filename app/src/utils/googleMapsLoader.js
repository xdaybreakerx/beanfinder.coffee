import { Loader } from "@googlemaps/js-api-loader";

// Promise to load the Google Maps API
let googleMapsLoadedPromise;

/**
 * Loads the Google Maps API asynchronously using a provided API key.
 * This function creates a Loader instance and returns a promise that resolves when the API is loaded.
 * @param {*} apiKey The API key required to load the Google Maps API
 * @returns {*} A promise that resolves when the Google Maps API is successfully loaded.
 */
export function loadGoogleMaps(apiKey) {
  if (!googleMapsLoadedPromise) {
    const loader = new Loader({
      apiKey: apiKey,
      version: "weekly",
      libraries: ["places", "geometry", "marker"],
    });

    googleMapsLoadedPromise = loader.load();
  }

  return googleMapsLoadedPromise;
}
