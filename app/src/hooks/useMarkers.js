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

      marker.addEventListener("gmp-click", () => {
        onMarkerClick(poi.place_id);
      });
      // Also handle keyboard activation directly: the beta Maps API does not
      // consistently emit gmp-click for keyboard input on clustered markers.
      marker.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onMarkerClick(poi.place_id);
        }
      });

      return marker;
    });

    markerCluster.addMarkers(markers);

    return () => {
      markerCluster.clearMarkers();
    };
  }, [map, pois, onMarkerClick]);
}
