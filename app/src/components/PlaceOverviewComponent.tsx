import React, { useState, useEffect } from "react";
import {
  PlaceOverview,
  PlaceDirectionsButton,
} from "@googlemaps/extended-component-library/react";
import { loadGoogleMaps } from "../utils/googleMapsLoader"; // Import the utility function

const PlaceOverviewComponent = ({ apiKey, placeId }) => {
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    loadGoogleMaps(apiKey).then(() => {
      setMapLoaded(true); // Set the map as loaded when the API is ready
    });
  }, [apiKey]);

  if (!mapLoaded) {
    return <div>Loading Place Overview...</div>; // You can display a loading spinner here
  }

  return (
    <div className="container">
      <PlaceOverview place={placeId} size="medium">
        <PlaceDirectionsButton slot="action">Directions</PlaceDirectionsButton>
      </PlaceOverview>
    </div>
  );
};

export default PlaceOverviewComponent;
