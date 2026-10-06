import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useMapLoading } from "../hooks/useMapLoading";
import { useGeolocation } from "../hooks/useGeolocation";
import { useMarkers } from "../hooks/useMarkers";
import { usePoiCreation } from "../hooks/usePoiCreation";
import { useReviewedCoordinates } from "../hooks/useReviewedCoordinates";
import { mapPlaces } from "../utils/mapPlaces";
import { reviewedPlaces } from "../utils/reviewedPlaces";
import { MapPlaceholder, MapToolbar } from "./MapShell";
import { MAPS_CHANNEL } from "../utils/googleMapsLoader";
import { createDetailsBudget, isAustralianSelection, mapsPlaceLink } from "../utils/browserPlaces";

const PlaceOverviewComponent = lazy(() => import("./PlaceOverviewComponent"));
const australia = { lat: -24.670940951770845, lng: 134.52585021148653 };
type SearchPlace = Pick<google.maps.places.Place, "location" | "viewport">;
type Camera = { place: SearchPlace } | { location: google.maps.LatLngLiteral } | null;

const MonolithicGoogleMap = ({ apiKey }: { apiKey: string }) => {
  const { mapLoaded, error } = useMapLoading(apiKey);
  const legacyPois = usePoiCreation();
  const fresh = useReviewedCoordinates(Boolean(apiKey) && mapLoaded && !error);
  const [cafeOnly, setCafeOnly] = useState(true);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [camera, setCamera] = useState<Camera>(null);
  const location = useGeolocation();
  const cameraAction = useRef(0);
  const reserveDetails = useMemo(() => createDetailsBudget(), []);
  const pois = useMemo(() => {
    const freshIds = new Set(fresh.pois.map(place => place.place_id));
    return [...legacyPois.filter(poi => !freshIds.has(poi.place_id)), ...fresh.pois]
      .filter(poi => !cafeOnly || mapPlaces.find(place => place.placeId === poi.place_id)?.hasCafe === true);
  }, [legacyPois, fresh.pois, cafeOnly]);
  const selectedPlace = mapPlaces.find(place => place.placeId === selectedPlaceId);
  const handleMarkerClick = useCallback((placeId: string) => setSelectedPlaceId(placeId), []);
  const startSearch = useCallback(() => ++cameraAction.current, []);
  const selectSearch = useCallback((place: SearchPlace, action: number) => {
    if (action !== cameraAction.current) return false;
    setCamera({ place }); setSelectedPlaceId(null);
    return true;
  }, []);
  const locate = async () => {
    const action = ++cameraAction.current;
    const result = await location.requestLocation();
    if (result && action === cameraAction.current) { setCamera({ location: result }); setSelectedPlaceId(null); }
  };
  if (!apiKey || error) return <MapPlaceholder unavailable />;
  if (!mapLoaded) return <MapPlaceholder />;

  const missing = reviewedPlaces.filter(place => fresh.missingPlaceIds.includes(place.placeId) &&
    !legacyPois.some(poi => poi.place_id === place.placeId) && (!cafeOnly || place.hasCafe));
  return <APIProvider apiKey={apiKey} version={MAPS_CHANNEL}>
    <div className="map-shell">
      <MapToolbar count={pois.length} cafeOnly={cafeOnly} pending={location.pending} error={location.error}
        locate={() => void locate()} setCafeOnly={checked => { setCafeOnly(checked); setSelectedPlaceId(null); }}>
        <PlaceAutocomplete onPlaceSelect={selectSearch} onSearchStart={startSearch} reserveDetails={reserveDetails} />
      </MapToolbar>
      <Map className="map-canvas" defaultCenter={australia} defaultZoom={3} gestureHandling="cooperative"
        disableDefaultUI zoomControl fullscreenControl mapId="7b1c394057aa4afc">
        <PoiMarkers pois={pois} onMarkerClick={handleMarkerClick} />
      </Map>
      <MapHandler camera={camera} />
      {selectedPlace && <section className="map-overview" aria-label="Selected location">
        <button type="button" className="text-button" onClick={() => { setSelectedPlaceId(null); document.getElementById("map-location-search")?.focus(); }}>Close place details</button>
        <Suspense fallback={<p role="status">Loading place details…</p>}>
          <PlaceOverviewComponent key={selectedPlace.placeId} place={selectedPlace} reserveDetails={reserveDetails} />
        </Suspense>
      </section>}
    </div>
    <p className="map-note map-cache-status" role="status">{fresh.error}</p>
    {missing.length > 0 && <div className="map-note"><p>Some locations aren't on this map yet. Open them in Google Maps:</p>
      <ul>{missing.map(place => <li key={place.placeId}><a className="text-button" href={mapsPlaceLink(place.placeId, place.Name)}>Open {place.Name} ({place.state}) in Google Maps</a></li>)}</ul>
    </div>}
  </APIProvider>;
};

function MapHandler({ camera }: { camera: Camera }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !camera) return;
    if ("location" in camera) { map.panTo(camera.location); map.setZoom(10); }
    else if (camera.place.viewport) map.fitBounds(camera.place.viewport);
    else if (camera.place.location) { map.panTo(camera.place.location); map.setZoom(14); }
  }, [map, camera]);
  return null;
}

function PlaceAutocomplete({ onPlaceSelect, onSearchStart, reserveDetails }: {
  onPlaceSelect: (place: SearchPlace, action: number) => boolean;
  onSearchStart: () => number;
  reserveDetails: () => boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const places = useMapsLibrary("places");
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!places || !host.current) return;
    let active = true;
    let selection = 0;
    let widget: google.maps.places.PlaceAutocompleteElement;
    try {
      widget = new places.PlaceAutocompleteElement({ includedRegionCodes: ["au"],
        includedPrimaryTypes: ["(regions)"], requestedRegion: "au" });
      widget.id = "map-location-search";
      widget.placeholder = "Search an Australian suburb or town";
      widget.setAttribute("aria-label", "Search an Australian location");
      widget.description = "Search a suburb or town, choose a suggestion, then select a cafe or roaster on the map.";
      host.current.append(widget);
    } catch { setStatus("Location search is unavailable. You can still browse the map."); return; }
    const start = () => { selection++; onSearchStart(); setStatus(""); };
    const select = async (event: google.maps.places.PlacePredictionSelectEvent) => {
      const current = ++selection;
      const action = onSearchStart();
      if (!reserveDetails()) {
        widget.disabled = true;
        setStatus("Location search has reached its limit for this visit. You can still browse the map or open Google Maps.");
        return;
      }
      setStatus("Finding that location…");
      try {
        const place = event.placePrediction.toPlace();
        await place.fetchFields({ fields: ["location", "viewport", "addressComponents"] });
        if (!active || current !== selection) return;
        if (!isAustralianSelection(place)) { setStatus("Choose an Australian suburb or town with an available location."); return; }
        setStatus(onPlaceSelect(place, action) ? "Map moved to your selected location." : "");
      } catch { if (active && current === selection) setStatus("That location couldn't be loaded. Try another suggestion or browse the map."); }
    };
    const fail = () => { selection++; onSearchStart(); setStatus("Location search is unavailable. You can still browse the map."); };
    widget.addEventListener("input", start);
    widget.addEventListener("gmp-select", select);
    widget.addEventListener("gmp-error", fail);
    return () => {
      active = false;
      widget.removeEventListener("input", start);
      widget.removeEventListener("gmp-select", select);
      widget.removeEventListener("gmp-error", fail);
      widget.remove();
    };
  }, [places, onPlaceSelect, onSearchStart, reserveDetails]);
  return <div className="map-search">
    <label htmlFor="map-location-search">Search an Australian location</label>
    <div ref={host} className="map-autocomplete">{!places && <input id="map-location-search" type="text" disabled placeholder="Search an Australian suburb or town" />}</div>
    <p>Search a suburb or town, then select a cafe or roaster on the map.</p>
    <p role="status" className="map-search-status">{status}</p>
  </div>;
}

function PoiMarkers({ pois, onMarkerClick }: { pois: ReturnType<typeof usePoiCreation>; onMarkerClick: (placeId: string) => void }) {
  useMarkers(useMap(), pois, onMarkerClick);
  return null;
}
export default MonolithicGoogleMap;
