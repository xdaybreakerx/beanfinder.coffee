import { useState, useEffect } from "react";
import { loadGoogleMaps } from "../utils/googleMapsLoader.js";

export function useMapLoading(apiKey) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setMapLoaded(false);
    setError(false);

    const loadMaps = async () => {
      try {
        await loadGoogleMaps(apiKey);
        if (active) setMapLoaded(true);
      } catch (error) {
        if (active) setError(true);
      }
    };

    if (apiKey) {
      loadMaps();
    }
    return () => { active = false; };
  }, [apiKey]);

  return { mapLoaded, error };
}
