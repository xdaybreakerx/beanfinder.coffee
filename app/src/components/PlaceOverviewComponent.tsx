import React, { useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import type { MapPlace } from "../utils/mapPlaces";
import { mapsPlaceLink } from "../utils/browserPlaces";

// Current address data exists only while this selected-place panel is mounted.
// Names, cafe status and operator links come from the curated directory.
export default function PlaceOverviewComponent({ place, reserveDetails }: { place: MapPlace; reserveDetails: () => boolean }) {
  const places = useMapsLibrary("places");
  const heading = useRef<HTMLHeadingElement>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading current address…");
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (!places) return;
    let active = true;
    if (!reserveDetails()) { setStatus("Current details have reached their limit for this visit. Open Google Maps for more information."); return; }
    const load = async () => {
      try {
        const current = new places.Place({ id: place.placeId });
        await current.fetchFields({ fields: ["formattedAddress", "addressComponents"] });
        if (!active) return;
        if (current.addressComponents?.find(component => component.types.includes("country"))?.shortText !== "AU" || !current.formattedAddress) {
          setStatus("A current Australian address isn't available. Check the location in Google Maps.");
          return;
        }
        setAddress(current.formattedAddress);
        setStatus("");
      } catch { if (active) setStatus("Current details couldn't be loaded. You can still open Google Maps for details and directions."); }
    };
    void load();
    return () => { active = false; };
  }, [places, place.placeId, reserveDetails]);
  return <>
    <h2 ref={heading} tabIndex={-1}>{place.Name}</h2>
    <p>{place.hasCafe === true ? "Cafe listed in the directory" : place.hasCafe === false ? "Roastery or store — public cafe access isn't listed" : "Cafe access hasn't been confirmed"}{place.state ? ` · ${place.state}` : ""}</p>
    <div className="map-current-details">
      {address && <p>{address}</p>}
      <p role="status">{status}</p>
      <div className="google-maps-attribution">
        <img className="google-maps-light" src="/google-maps-light.svg" alt="Google Maps" />
        <img className="google-maps-dark" src="/google-maps-dark.svg" alt="Google Maps" />
      </div>
    </div>
    <div className="map-actions">
      <a className="text-button" href={mapsPlaceLink(place.placeId, place.Name)}>View on Google Maps</a>
      <a className="text-button" href={mapsPlaceLink(place.placeId, place.Name, true)}>Directions</a>
      <a className="text-button" href={place.Website} target="_blank" rel="noopener noreferrer">Visit website<span className="sr-only"> (opens in a new tab)</span></a>
    </div>
  </>;
}
