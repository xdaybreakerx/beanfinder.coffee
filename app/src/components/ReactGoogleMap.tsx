import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

import PlaceOverviewComponent from "./PlaceOverviewComponent";
import { useMapLoading } from "../hooks/useMapLoading";
import { useGeolocation } from "../hooks/useGeolocation";
import { useMarkers } from "../hooks/useMarkers";
import { usePoiCreation } from "../hooks/usePoiCreation";

const MonolithicGoogleMap = ({ apiKey }: { apiKey: string }) => {
  const { mapLoaded, error } = useMapLoading(apiKey);
  const roastersPois = usePoiCreation();
  const { location: userLocation } = useGeolocation();

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] =
    useState<google.maps.places.PlaceResult | null>(null);

  const handleMarkerClick = useCallback((placeId: string) => setSelectedPlaceId(placeId), []);
  if (!apiKey || error) return <p role="status">The map is unavailable right now. <a className="text-button" href="/roasters/">Explore the directory</a></p>;
  if (!mapLoaded) return <p role="status">Loading the Australian roaster map…</p>;

  return (
    <APIProvider apiKey={apiKey}>
      <div className="map-shell">
        {/* Custom Search Input with Australia Restriction */}
        <PlaceAutocomplete onPlaceSelect={setSelectedPlace} />

        {/* Map Configuration */}
        <Map
          className="flex-grow h-[60vh]"
          defaultCenter={
            userLocation || {
              lat: -24.670940951770845,
              lng: 134.52585021148653,
            }
          }
          defaultZoom={userLocation ? 10 : 3}
          gestureHandling={"cooperative"}
          disableDefaultUI={true}
          zoomControl={true}
          fullscreenControl={true}
          mapId="7b1c394057aa4afc"
        >
          <PoiMarkers pois={roastersPois} onMarkerClick={handleMarkerClick} />
        </Map>
        <MapHandler place={selectedPlace} userLocation={userLocation} />
        {selectedPlaceId && (
          <div className="map-overview">
            <button type="button" className="text-button" onClick={() => { setSelectedPlaceId(null); document.getElementById('map-location-search')?.focus(); }}>Close place details</button>
            <PlaceOverviewComponent apiKey={apiKey} placeId={selectedPlaceId} />
          </div>
        )}
      </div>
    </APIProvider>
  );
};

interface MapHandlerProps {
  place: google.maps.places.PlaceResult | null;
  userLocation: google.maps.LatLngLiteral | null;
}

const MapHandler = ({ place, userLocation }: MapHandlerProps) => {
  const map = useMap();

  useEffect(() => {
    // defaultCenter/defaultZoom only apply at creation. Geolocation can arrive
    // later, so update the live map once both are ready. Keep searches in control.
    if (!map || !userLocation || place) return;

    map.panTo(userLocation);
    map.setZoom(10);
  }, [map, userLocation, place]);

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

    const listener = placeAutocomplete.addListener("place_changed", () => {
      onPlaceSelect(placeAutocomplete.getPlace());
    });
    return () => listener?.remove();
  }, [onPlaceSelect, placeAutocomplete]);

  return (
    <div className="map-search">
    <label htmlFor="map-location-search">Search an Australian location</label>
    <input
      id="map-location-search"
      ref={inputRef}
      type="text"
      placeholder="Search for a location"
      aria-describedby="map-search-hint"
    />
    <p id="map-search-hint">Search a suburb or town, then select a roaster on the map.</p>
    </div>
  );
};

const PoiMarkers = ({ pois, onMarkerClick }: {
  pois: ReturnType<typeof usePoiCreation>;
  onMarkerClick: (placeId: string) => void;
}) => {
  const map = useMap();

  useMarkers(map, pois, onMarkerClick);

  return null;
};

export default MonolithicGoogleMap;
