import { useState, useEffect } from "react";
import { loadGoogleMaps, MAPS_AUTH_FAILURE_EVENT } from "../utils/googleMapsLoader.js";

export function useMapLoading(apiKey) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setMapLoaded(false);
    setError(false);
    const authFailure = () => { if (active) setError(true); };
    window.addEventListener(MAPS_AUTH_FAILURE_EVENT, authFailure);

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
    return () => { active = false; window.removeEventListener(MAPS_AUTH_FAILURE_EVENT, authFailure); };
  }, [apiKey]);

  return { mapLoaded, error };
}
