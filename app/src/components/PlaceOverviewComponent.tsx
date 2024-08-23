import React, { useState, useEffect } from "react";
import {
  PlaceOverview,
  PlaceDirectionsButton,
} from "@googlemaps/extended-component-library/react";
import { loadGoogleMaps } from "../utils/googleMapsLoader";

const PlaceOverviewComponent = ({ apiKey, placeId }) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [size, setSize] = useState<
    "medium" | "small" | "x-small" | "large" | "x-large"
  >("medium");

  useEffect(() => {
    const updateSize = () => {
      // Check if screen width is greater than 768px (md)
      if (window.innerWidth > 768) {
        setSize("large");
      } else {
        setSize("medium");
      }
    };

    loadGoogleMaps(apiKey).then(() => {
      setMapLoaded(true); // Set the map as loaded when the API is ready
    });

    // Set the initial size
    updateSize();

    // Add event listener for window resize
    window.addEventListener("resize", updateSize);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener("resize", updateSize);
    };
  }, [apiKey]);

  if (!mapLoaded) {
    return <div>Loading Place Overview...</div>; 
  }

  return (
    <div className="pt-4">
      <PlaceOverview place={placeId} size={size}>
        <PlaceDirectionsButton slot="action">Directions</PlaceDirectionsButton>
      </PlaceOverview>
    </div>
  );
};

export default PlaceOverviewComponent;
