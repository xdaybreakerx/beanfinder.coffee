import React from "react";
import { act, cleanup, fireEvent, render, type RenderResult } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MonolithicGoogleMap from "./ReactGoogleMap";
import { useMarkers } from "../hooks/useMarkers";
import { mapPlaces } from "../utils/mapPlaces";
import { COORDINATE_TTL } from "../utils/placeCoordinates";

const mocks = vi.hoisted(() => ({
  loadGoogleMaps: vi.fn(), useMap: vi.fn(), provider: vi.fn(),
  camera: { center: null as unknown, zoom: 0 },
  widget: null as HTMLInputElement | null, options: null as unknown,
  fetchFields: vi.fn(),
}));
vi.mock("../utils/googleMapsLoader.js", () => ({ loadGoogleMaps: mocks.loadGoogleMaps, MAPS_CHANNEL: "weekly", MAPS_AUTH_FAILURE_EVENT: "beanfinder:maps-auth-failure" }));
vi.mock("../hooks/useMarkers", () => ({ useMarkers: vi.fn() }));
vi.mock("./PlaceOverviewComponent", () => ({ default: () => null }));
vi.mock("@vis.gl/react-google-maps", async () => {
  const { useEffect } = await import("react");
  const places = {
    PlaceAutocompleteElement: class {
      constructor(options: unknown) {
        mocks.options = options;
        const widget = document.createElement("input");
        mocks.widget = widget;
        return widget;
      }
    },
  };
  return {
    APIProvider: ({ children, ...props }: { children: React.ReactNode }) => { mocks.provider(props); return children; },
    Map: ({ defaultCenter, defaultZoom, children }: {
      defaultCenter: google.maps.LatLngLiteral; defaultZoom: number; children: React.ReactNode;
    }) => {
      useEffect(() => { mocks.camera.center = defaultCenter; mocks.camera.zoom = defaultZoom; }, []);
      return children;
    },
    useMap: mocks.useMap, useMapsLibrary: () => places,
  };
});
const australia = { lat: -24.670940951770845, lng: 134.52585021148653 };
const melbourne = { lat: -37.8136, lng: 144.9631 };
const sydney = { lat: -33.8688, lng: 151.2093 };
let resolveMaps: () => void;
let renderer: RenderResult;
let getCurrentPosition: ReturnType<typeof vi.fn>;
let map: { panTo: ReturnType<typeof vi.fn<(center: unknown) => void>>; setZoom: ReturnType<typeof vi.fn<(zoom: number) => void>>; fitBounds: ReturnType<typeof vi.fn<(bounds: unknown) => void>> };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ coordinates: [], missingPlaceIds: [] })));
  mocks.camera = { center: null, zoom: 0 };
  mocks.widget = null;
  mocks.fetchFields.mockResolvedValue(undefined);
  mocks.loadGoogleMaps.mockReturnValue(new Promise<void>(resolve => { resolveMaps = resolve; }));
  map = {
    panTo: vi.fn(center => { mocks.camera.center = center; }),
    setZoom: vi.fn(zoom => { mocks.camera.zoom = zoom; }),
    fitBounds: vi.fn(),
  };
  mocks.useMap.mockReturnValue(map);
  getCurrentPosition = vi.fn();
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function mount(key = "test-key") { renderer = render(<MonolithicGoogleMap apiKey={key} />); }
async function loadMaps() { await act(async () => { resolveMaps(); }); }
function locate() { fireEvent.click(renderer.getByRole("button", { name: "Use my location" })); }
async function shareLocation(location = melbourne) {
  await act(async () => getCurrentPosition.mock.lastCall![0]({ coords: { latitude: location.lat, longitude: location.lng } }));
}
async function failLocation(code: number) {
  await act(async () => getCurrentPosition.mock.lastCall![1]({ code, message: "Location unavailable" }));
}
function place(location = sydney, country = "AU", viewport: google.maps.LatLngBounds | null = null) {
  return { location: { lat: () => location.lat, lng: () => location.lng } as google.maps.LatLng,
    viewport, addressComponents: [{ types: ["country"], shortText: country }], fetchFields: mocks.fetchFields };
}
async function selectPlace(selected = place()) {
  await act(async () => mocks.widget!.dispatchEvent(Object.assign(new Event("gmp-select"), {
    placePrediction: { toPlace: () => selected },
  })));
}

describe("map loading and explicit location sharing", () => {
  it("reserves the shell and never requests permission on arrival", async () => {
    mount();
    expect(renderer.container.querySelector(".map-canvas")).toBeTruthy();
    expect(renderer.getByRole("status").textContent).toContain("Loading");
    expect(getCurrentPosition).not.toHaveBeenCalled();
    await loadMaps();
    expect(mocks.provider).toHaveBeenCalledWith({ apiKey: "test-key", version: "weekly" });
    expect(mocks.camera).toEqual({ center: australia, zoom: 3 });
    expect(getCurrentPosition).not.toHaveBeenCalled();
    locate();
    expect(getCurrentPosition.mock.lastCall![2]).toEqual({ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    expect(renderer.getByRole("button", { name: "Finding your location…" })).toHaveProperty("disabled", true);
    await shareLocation();
    expect(mocks.camera).toEqual({ center: melbourne, zoom: 10 });
  });
  it("offers the directory on an API error or absent key", async () => {
    mocks.loadGoogleMaps.mockRejectedValue(new Error("Unavailable"));
    mount();
    await act(async () => {});
    expect(renderer.getByRole("status").textContent).toContain("unavailable");
    expect(renderer.getByRole("link", { name: "Explore the directory" }).getAttribute("href")).toBe("/roasters/");
    renderer.unmount();
    vi.clearAllMocks();
    mount("");
    expect(mocks.loadGoogleMaps).not.toHaveBeenCalled();
  });
  it("falls back after a late Google authentication failure", async () => {
    mount(); await loadMaps();
    act(() => window.dispatchEvent(new Event("beanfinder:maps-auth-failure")));
    expect(renderer.getByRole("status").textContent).toContain("unavailable");
    expect(renderer.getByRole("link", { name: "Explore the directory" })).toBeTruthy();
    expect(renderer.getByRole("button", { name: "Use my location" }).getAttribute("disabled")).not.toBeNull();
  });
  it.each([1, 2, 3])("keeps search and retry available after location error %s", async code => {
    mount(); await loadMaps(); locate(); await failLocation(code);
    expect(mocks.camera).toEqual({ center: australia, zoom: 3 });
    expect((renderer.getByRole("button", { name: "Use my location" }) as HTMLButtonElement).disabled).toBe(false);
    expect(renderer.container.textContent).toContain(code === 1 ? "denied" : code === 3 ? "too long" : "couldn't be found");
    await selectPlace();
    expect(mocks.camera.zoom).toBe(14);
  });
  it("reports an unsupported browser without requesting a location", async () => {
    vi.stubGlobal("navigator", {});
    mount(); await loadMaps(); locate();
    expect(renderer.container.textContent).toContain("doesn't support");
    expect(map.panTo).not.toHaveBeenCalled();
  });
  it("bounds a permission prompt and ignores callbacks arriving after timeout", async () => {
    vi.useFakeTimers();
    mount(); await loadMaps(); locate();
    await act(async () => { vi.advanceTimersByTime(12000); });
    expect(renderer.container.textContent).toContain("too long");
    await shareLocation();
    expect(map.panTo).not.toHaveBeenCalled();
  });
  it("can recenter again after manual panning and clears a pending request on unmount", async () => {
    mount(); await loadMaps(); locate(); await shareLocation();
    map.panTo(sydney); map.setZoom(12);
    locate(); await shareLocation();
    expect(mocks.camera).toEqual({ center: melbourne, zoom: 10 });
    locate(); renderer.unmount();
    await shareLocation(sydney);
    expect(mocks.camera.center).toEqual(melbourne);
  });
  it("centers once useMap becomes available", async () => {
    mocks.useMap.mockReturnValue(null);
    mount(); await loadMaps(); locate(); await shareLocation();
    expect(mocks.camera.center).toEqual(australia);
    mocks.useMap.mockReturnValue(map);
    renderer.rerender(<MonolithicGoogleMap apiKey="test-key" />);
    expect(mocks.camera.center).toEqual(melbourne);
  });
});

describe("Australian autocomplete", () => {
  it("restricts the new widget and requests only map geometry and country", async () => {
    mount(); await loadMaps(); await selectPlace();
    expect(mocks.options).toEqual({ includedRegionCodes: ["au"], includedPrimaryTypes: ["(regions)"], requestedRegion: "au" });
    expect(mocks.fetchFields).toHaveBeenCalledExactlyOnceWith({ fields: ["location", "viewport", "addressComponents"] });
    expect(mocks.widget?.getAttribute("aria-label")).toBe("Search an Australian location");
    expect(mocks.camera.zoom).toBe(14);
  });
  it("uses a viewport when supplied", async () => {
    mount(); await loadMaps();
    const viewport = {} as google.maps.LatLngBounds;
    await selectPlace(place(sydney, "AU", viewport));
    expect(map.fitBounds).toHaveBeenCalledExactlyOnceWith(viewport);
  });
  it("rejects foreign locations and missing geometry", async () => {
    mount(); await loadMaps();
    await selectPlace(place(sydney, "NZ"));
    expect(map.panTo).not.toHaveBeenCalled();
    const missing = { ...place(), location: null } as unknown as ReturnType<typeof place>;
    await selectPlace(missing);
    expect(renderer.container.textContent).toContain("Choose an Australian");
    expect(map.panTo).not.toHaveBeenCalled();
  });
  it("handles request denial and selection failure without disabling the map", async () => {
    mount(); await loadMaps();
    act(() => mocks.widget!.dispatchEvent(new Event("gmp-error")));
    expect(renderer.container.textContent).toContain("search is unavailable");
    mocks.fetchFields.mockRejectedValue(new Error("Denied"));
    await selectPlace();
    expect(renderer.container.textContent).toContain("couldn't be loaded");
    expect(renderer.getByLabelText("Cafe locations only")).toBeTruthy();
  });
  it("keeps the most recent user action in control when requests arrive out of order", async () => {
    mount(); await loadMaps(); locate(); await selectPlace(); await shareLocation();
    expect(mocks.camera.zoom).toBe(14);
    let finish: () => void;
    mocks.fetchFields.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    await selectPlace();
    locate(); await shareLocation();
    await act(async () => finish!());
    expect(mocks.camera).toEqual({ center: melbourne, zoom: 10 });
  });
  it("ignores a selection if the visitor has started typing another search", async () => {
    mount(); await loadMaps();
    let finish: () => void;
    mocks.fetchFields.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    await selectPlace();
    fireEvent.input(mocks.widget!);
    await act(async () => finish!());
    expect(map.panTo).not.toHaveBeenCalled();
  });
  it("bounds failed details attempts and preserves map browsing when exhausted", async () => {
    mount(); await loadMaps();
    mocks.fetchFields.mockRejectedValue(new Error("Denied"));
    for (let i = 0; i < 21; i++) await selectPlace();
    expect(mocks.fetchFields).toHaveBeenCalledTimes(20);
    expect(mocks.widget!.disabled).toBe(true);
    expect(renderer.container.textContent).toContain("limit for this visit");
  });
});

describe("cafe identities and cached markers", () => {
  it("defaults to cafes and preserves every legacy marker in all-location browsing", async () => {
    mount(); await loadMaps();
    let markers = vi.mocked(useMarkers).mock.lastCall![1] as Array<{ place_id: string }>;
    expect(markers.length).toBeGreaterThan(100);
    expect(markers.every(poi => mapPlaces.find(place => place.placeId === poi.place_id)?.hasCafe === true)).toBe(true);
    fireEvent.click(renderer.getByLabelText("Cafe locations only"));
    markers = vi.mocked(useMarkers).mock.lastCall![1];
    expect(markers).toHaveLength(218);
  });
  it("replaces a known location with fresh coordinates without duplicates", async () => {
    const now = Date.now(); const known = mapPlaces.find(place => place.hasCafe === true)!;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ coordinates: [{ placeId: known.placeId, latitude: -37.8, longitude: 145,
      countryCode: "AU", provider: "google-maps", retrievedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + COORDINATE_TTL).toISOString() }], missingPlaceIds: [] })));
    mount(); expect(fetch).not.toHaveBeenCalled(); await loadMaps();
    const markers = vi.mocked(useMarkers).mock.lastCall![1] as Array<{ place_id: string; location: google.maps.LatLngLiteral }>;
    expect(markers.filter(poi => poi.place_id === known.placeId)).toHaveLength(1);
    expect(markers.find(poi => poi.place_id === known.placeId)?.location).toEqual({ lat: -37.8, lng: 145 });
  });
});
