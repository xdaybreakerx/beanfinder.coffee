import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../utils/googleMapsLoader.js";

export const useSearchGoogleMap = (apiKey, map) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    loadGoogleMaps(apiKey).then(() => {
      setMapLoaded(true);

      if (inputRef.current) {
        autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "au" }, // Restrict search to Australia
        });

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current.getPlace();
          if (place.geometry && place.geometry.location) {
            const location = place.geometry.location;
            if (map) {
              map.panTo(location);
              map.setZoom(14);
            }
          }
        });
      }
    });
  }, [apiKey, map]);

  const handleMarkerClick = (placeId) => {
    setSelectedPlaceId(placeId);
  };

  return {
    mapLoaded,
    inputRef,
    handleMarkerClick,
    selectedPlaceId,
  };
};
