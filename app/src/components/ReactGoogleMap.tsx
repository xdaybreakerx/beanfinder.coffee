import React, { useState } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useGeolocation } from "../hooks/useGeolocation";
import { usePoiCreation } from "../hooks/usePoiCreation";
import { useMarkers } from "../hooks/useMarkers";
import { useMapLoading } from "../hooks/useMapLoading";
import PlaceOverviewComponent from "./PlaceOverviewComponent";

const ReactGoogleMap = ({ apiKey, searchLocation }) => {
  const mapLoaded = useMapLoading(apiKey);
  const roastersPois = usePoiCreation();
  const { location: userLocation } = useGeolocation();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  if (!mapLoaded) {
    return <div>Loading map...</div>;
  }

  const handleMarkerClick = (placeId: string) => {
    setSelectedPlaceId(placeId);
  };

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        style={{ width: "100%", height: "500px" }}
        defaultCenter={searchLocation || userLocation || { lat: -24.670940951770845, lng: 134.52585021148653 }}
        defaultZoom={searchLocation || userLocation ? 10 : 3}
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

const PoiMarkers = ({ pois, onMarkerClick }) => {
  const map = useMap();
  useMarkers(map, pois, onMarkerClick);
  return null;
};

export default ReactGoogleMap;
