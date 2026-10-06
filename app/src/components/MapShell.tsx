import React from "react";
import { mapPlaces } from "../utils/mapPlaces";

export function MapPlaceholder({ unavailable = false }: { unavailable?: boolean }) {
  return <><div className="map-shell">
    <MapToolbar disabled cafeOnly count={mapPlaces.filter(place => place.hasCafe === true).length}>
      <div className="map-search">
        <label htmlFor="map-location-search">Search an Australian location</label>
        <div className="map-autocomplete"><input id="map-location-search" type="text" disabled placeholder="Search an Australian suburb or town" /></div>
        <p>Search a suburb or town, then select a cafe or roaster on the map.</p>
        <p className="map-search-status" />
      </div>
    </MapToolbar>
    <div className="map-canvas map-placeholder"><div><p role="status">{unavailable ? "The map is unavailable right now." : "Loading the Australian roaster map…"}</p>
      <a className="text-button" href="/roasters/">Explore the directory</a></div></div>
  </div><p className="map-note map-cache-status" /></>;
}

export function MapToolbar({ children, disabled = false, pending = false, error, cafeOnly, count, locate, setCafeOnly }: {
  children: React.ReactNode; disabled?: boolean; pending?: boolean; error?: string | null; cafeOnly: boolean; count: number;
  locate?: () => void; setCafeOnly?: (checked: boolean) => void;
}) {
  return <div className="map-toolbar">
    {children}
    <div className="map-actions">
      <button type="button" className="btn btn-outline" onClick={locate} disabled={disabled || pending}>
        {pending ? "Finding your location…" : "Use my location"}
      </button>
      <label className="cafe-filter"><input type="checkbox" className="checkbox checkbox-sm" checked={cafeOnly} disabled={disabled}
        onChange={event => setCafeOnly?.(event.target.checked)} />Cafe locations only</label>
    </div>
    <p role={disabled ? undefined : "status"} className="map-location-status">{pending ? "Waiting for your location. You can also search above." : error ?? "Your location is used only to center this map."}</p>
    <p role={disabled ? undefined : "status"}>Showing {count} {cafeOnly ? "cafe" : "Australian"} {count === 1 ? "location" : "locations"}.</p>
  </div>;
}
