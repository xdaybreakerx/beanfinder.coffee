import { useEffect } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";

export function useMarkers(map, pois, onMarkerClick) {
  useEffect(() => {
    if (!map) return;

    const markerCluster = new MarkerClusterer({ map });

    const markers = pois.map((poi, i) => {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: poi.location,
        title: `${i + 1}. ${poi.name}`,
        gmpClickable: true,
      });

      let lastActivation = -Infinity;
      const activate = () => {
        const now = performance.now();
        // Some engines also emit gmp-click for the same keyboard gesture.
        if (now - lastActivation < 100) return;
        lastActivation = now;
        onMarkerClick(poi.place_id);
      };
      marker.addEventListener("gmp-click", activate);
      // Keep explicit keyboard activation for clustered markers across engines.
      marker.addEventListener("keydown", event => {
        if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
          event.preventDefault();
          event.stopPropagation();
          activate();
        }
      });

      return marker;
    });

    markerCluster.addMarkers(markers);

    return () => {
      markerCluster.clearMarkers();
      markerCluster.setMap(null);
    };
  }, [map, pois, onMarkerClick]);
}
