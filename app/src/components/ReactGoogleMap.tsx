import React, { useEffect, useRef, useState } from "react";
import {
  APIProvider,
  ControlPosition,
  MapControl,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

import PlaceOverviewComponent from "./PlaceOverviewComponent";
import { useMapLoading } from "../hooks/useMapLoading";
import { useGeolocation } from "../hooks/useGeolocation";
import { useMarkers } from "../hooks/useMarkers";
import { usePoiCreation } from "../hooks/usePoiCreation";

const MonolithicGoogleMap = ({ apiKey }) => {
  const mapLoaded = useMapLoading(apiKey);
  const roastersPois = usePoiCreation();
  const { location: userLocation } = useGeolocation();

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] =
    useState<google.maps.places.PlaceResult | null>(null);

  if (!mapLoaded) {
    return <div>Loading...</div>;
  }

  const handleMarkerClick = (placeId: string) => {
    console.log("ReactGoogleMap: Marker clicked, placeId:", placeId);
    setSelectedPlaceId(placeId);
  };

  return (
    <APIProvider apiKey={apiKey}>
      <div className="relative">
        {/* Custom Search Input with Australia Restriction */}
        <PlaceAutocomplete onPlaceSelect={setSelectedPlace} />

        {/* Map Configuration */}
        <Map
          style={{ width: "100%", height: "500px" }}
          defaultCenter={
            userLocation || {
              lat: -24.670940951770845,
              lng: 134.52585021148653,
            }
          }
          defaultZoom={userLocation ? 10 : 3}
          gestureHandling={"greedy"}
          disableDefaultUI={true}
          mapId="7b1c394057aa4afc"
        >
          <PoiMarkers pois={roastersPois} onMarkerClick={handleMarkerClick} />
        </Map>
        <MapHandler place={selectedPlace} />
        {selectedPlaceId && (
          <PlaceOverviewComponent apiKey={apiKey} placeId={selectedPlaceId} />
        )}
      </div>
    </APIProvider>
  );
};

interface MapHandlerProps {
  place: google.maps.places.PlaceResult | null;
}

const MapHandler = ({ place }: MapHandlerProps) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !place) return;

    if (place.geometry?.viewport) {
      map.fitBounds(place.geometry?.viewport);
    } else if (place.geometry?.location) {
      map.panTo(place.geometry.location);
      map.setZoom(14); 
    }
  }, [map, place]);

  return null;
};

interface PlaceAutocompleteProps {
  onPlaceSelect: (place: google.maps.places.PlaceResult | null) => void;
}

const PlaceAutocomplete = ({ onPlaceSelect }: PlaceAutocompleteProps) => {
  const [placeAutocomplete, setPlaceAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary("places");

  useEffect(() => {
    if (!places || !inputRef.current) return;

    const options = {
      fields: ["geometry", "name", "formatted_address"],
      componentRestrictions: { country: "au" }, // Restrict search to Australia
    };

    setPlaceAutocomplete(new places.Autocomplete(inputRef.current, options));
  }, [places]);

  useEffect(() => {
    if (!placeAutocomplete) return;

    placeAutocomplete.addListener("place_changed", () => {
      onPlaceSelect(placeAutocomplete.getPlace());
    });
  }, [onPlaceSelect, placeAutocomplete]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="Search for a location"
      className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-white p-2 rounded-lg shadow-lg w-3/4"
      onFocus={() => console.log("ReactGoogleMap: Search input focused")}
    />
  );
};

const PoiMarkers = ({ pois, onMarkerClick }) => {
  const map = useMap();

  console.log("PoiMarkers: useMap result map =", map);

  useMarkers(map, pois, onMarkerClick);

  return null;
};

export default MonolithicGoogleMap;
