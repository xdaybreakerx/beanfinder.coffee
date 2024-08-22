import React, { useEffect, useState, useRef, useCallback } from "react";

import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  Pin,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import type { Marker } from "@googlemaps/markerclusterer";

import roasters from "../data/coffee-roasters-updated-from-place_ids.json";
import PlaceOverviewComponent from "./PlaceOverviewComponent"; // Import the new component

// Define the Poi type for Points of Interest
type Poi = {
  key: string;
  location: google.maps.LatLngLiteral;
  name: string;
  address: string;
  rating: number | string;
  place_id: string;
};

// Create an array of POIs from the roasters' data using a for loop
const roastersPois: Poi[] = [];

for (let i = 0; i < roasters.length; i++) {
  const roaster = roasters[i];

  // Skip roasters with no place_ids
  if (!roaster.place_ids || roaster.place_ids.length === 0) {
    console.log(`Skipping roaster ${roaster.Name} due to missing place_ids.`);
    continue;
  }

  const tempPOI = [];

  // Iterate over each place_id
  for (const place of roaster.place_ids) {
    const poi: Poi = {
      key: place.place_id, // Use place_id as the unique key
      location: {
        lat: place.latitude,
        lng: place.longitude,
      },
      name: `${roaster.Name} (${place.state})`, // Include state in the name for clarity
      address: place.address,
      rating: place.rating || "N/A", // Use 'N/A' if no rating is available
      place_id: place.place_id, // Store the place_id for the Place Details request
    };
    tempPOI.push(poi);
  }

  roastersPois.push(...tempPOI);
}

const ReactGoogleMap = ({ apiKey }) => {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const handleMarkerClick = (placeId: string) => {
    setSelectedPlaceId(placeId);
  };

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        style={{ width: "100%", height: "500px" }}
        defaultCenter={{ lat: -24.670940951770845, lng: 134.52585021148653 }} // Australia
        defaultZoom={3}
        gestureHandling={"greedy"}
        disableDefaultUI={true}
        mapId="7b1c394057aa4afc"
      >
        <PoiMarkers pois={roastersPois} onMarkerClick={handleMarkerClick} />
      </Map>

      {/* Render the PlaceOverviewComponent if a place is selected */}
      {selectedPlaceId && (
        <PlaceOverviewComponent apiKey={apiKey} placeId={selectedPlaceId} />
      )}
    </APIProvider>
  );
};

const PoiMarkers = (props: { pois: Poi[], onMarkerClick: (placeId: string) => void }) => {
  const map = useMap();
  const [markers, setMarkers] = useState<{ [key: string]: Marker }>({});
  const clusterer = useRef<MarkerClusterer | null>(null);

  const handleClick = useCallback((poi: Poi) => {
    props.onMarkerClick(poi.place_id);
  }, [props]);

  // Initialize MarkerClusterer, if the map has changed
  useEffect(() => {
    if (!map) return;
    if (!clusterer.current) {
      clusterer.current = new MarkerClusterer({ map });
    }
  }, [map]);

  // Update markers, if the markers array has changed
  useEffect(() => {
    clusterer.current?.clearMarkers();
    clusterer.current?.addMarkers(Object.values(markers));
  }, [markers]);

  const setMarkerRef = (marker: Marker | null, key: string) => {
    if (marker && markers[key]) return;
    if (!marker && !markers[key]) return;

    setMarkers((prev) => {
      if (marker) {
        return { ...prev, [key]: marker };
      } else {
        const newMarkers = { ...prev };
        delete newMarkers[key];
        return newMarkers;
      }
    });
  };

  return (
    <>
      {props.pois.map((poi: Poi) => (
        <AdvancedMarker
          key={poi.key}
          position={poi.location}
          ref={(marker) => setMarkerRef(marker, poi.key)}
          clickable={true}
          onClick={() => handleClick(poi)} // Handle marker click
        >
          <Pin
            background={"#FBBC04"}
            glyphColor={"#000"}
            borderColor={"#000"}
          />
        </AdvancedMarker>
      ))}
    </>
  );
};

export default ReactGoogleMap;
