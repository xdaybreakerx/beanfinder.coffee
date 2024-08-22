import { useState, useEffect } from "react";
import { loadGoogleMaps } from "../utils/googleMapsLoader.js";

export function useMapLoading(apiKey) {
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    loadGoogleMaps(apiKey).then(() => {
      setMapLoaded(true);
    });
  }, [apiKey]);

  return mapLoaded;
}
