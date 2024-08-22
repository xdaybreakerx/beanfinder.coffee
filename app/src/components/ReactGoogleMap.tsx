import React, { useEffect, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  Pin,
} from "@vis.gl/react-google-maps";
import { loadGoogleMaps } from "../utils/googleMapsLoader.js";
import roasters from "../data/coffee-roasters-updated-from-place_ids.json";
import PlaceOverviewComponent from "./PlaceOverviewComponent";

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
    roastersPois.push(poi);
  }
}

const ReactGoogleMap = ({ apiKey }) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null); // State to keep track of the selected marker

  useEffect(() => {
    loadGoogleMaps(apiKey).then(() => {
      setMapLoaded(true); // Set the map as loaded when the API is ready
    });
  }, [apiKey]);

  if (!mapLoaded) {
    return <div>Loading map...</div>; // You can display a loading spinner here
  }

  const handleMarkerClick = (placeId: string) => {
    setSelectedPlaceId(placeId); // Update the selected marker when clicked
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
      {selectedPlaceId && (
        <PlaceOverviewComponent apiKey={apiKey} placeId={selectedPlaceId} />
      )}
    </APIProvider>
  );
};

const PoiMarkers = (props: {
  pois: Poi[];
  onMarkerClick: (placeId: string) => void;
}) => {
  const map = useMap();

  return (
    <>
      {props.pois.map((poi: Poi) => (
        <AdvancedMarker
          key={poi.key}
          position={poi.location}
          clickable={true}
          onClick={() => props.onMarkerClick(poi.place_id)} // Pass the placeId to the onMarkerClick handler
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
