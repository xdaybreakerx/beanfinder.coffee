import React, { useEffect, useState } from "react";
import {
  APIProvider,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { loadGoogleMaps } from "../utils/googleMapsLoader.js";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
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

  useEffect(() => {
    if (!map) return;

    const infoWindow = new google.maps.InfoWindow();

    // Initialize MarkerClusterer with map instance
    const markerCluster = new MarkerClusterer({ map });

    const markers = props.pois.map((poi, i) => {
      const marker = new google.maps.Marker({
        position: poi.location,
        title: `${i + 1}. ${poi.name}`, // Accessible title
        // label: `${i + 1}`, // Optional label 
        optimized: false, // Ensures the marker is not optimized out of accessibility consideration
      });

      // Add a click listener for each marker to open an InfoWindow with accessible content
      marker.addListener("click", () => {
        // infoWindow.close();
        // infoWindow.setContent(marker.getTitle());
        // infoWindow.open(marker.getMap(), marker);
        props.onMarkerClick(poi.place_id); // Call the onMarkerClick handler
      });

      return marker;
    });

    // Add markers to the clusterer
    markerCluster.addMarkers(markers);

    return () => {
      // Cleanup: Remove markers and clusters when component unmounts or pois change
      markerCluster.clearMarkers();
    };
  }, [map, props.pois, props.onMarkerClick]);

  return null; // Returning null as markers are directly managed by Google Maps and MarkerClusterer
};

export default ReactGoogleMap;
