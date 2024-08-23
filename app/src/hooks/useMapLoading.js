import { useState, useEffect } from "react";
import { loadGoogleMaps } from "../utils/googleMapsLoader.js";

export function useMapLoading(apiKey) {
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    console.log("useMapLoading: Attempting to load Google Maps API");

    const loadMaps = async () => {
      try {
        await loadGoogleMaps(apiKey);
        console.log("useMapLoading: Google Maps API successfully loaded");
        setMapLoaded(true);
      } catch (error) {
        console.error("useMapLoading: Error loading Google Maps API", error);
        setMapLoaded(false);  // handle the error by setting mapLoaded to false
      }
    };

    if (apiKey) {
      loadMaps();
    } else {
      console.error("useMapLoading: API key is missing");
    }
  }, [apiKey]);

  return mapLoaded;
}