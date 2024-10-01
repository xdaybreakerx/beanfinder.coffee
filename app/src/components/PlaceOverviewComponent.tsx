import React, { useState, useEffect } from "react";
import {
  PlaceOverview,
  PlaceDirectionsButton,
} from "@googlemaps/extended-component-library/react";
import { loadGoogleMaps } from "../utils/googleMapsLoader";

const PlaceOverviewComponent = ({ apiKey, placeId }) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  // Logic in place to change PlaceOverview size depending on device - currently hardcoded value, however may change in future
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
    <div>
      <PlaceOverview place={placeId} size={"medium"}>
        <PlaceDirectionsButton slot="action">Directions</PlaceDirectionsButton>
      </PlaceOverview>
    </div>
  );
};

export default PlaceOverviewComponent;
