import React from "react";
import { act, cleanup, render, type RenderResult } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MonolithicGoogleMap from "./ReactGoogleMap";

const mocks = vi.hoisted(() => ({
  loadGoogleMaps: vi.fn(),
  useMap: vi.fn(),
  camera: { center: null as unknown, zoom: 0 },
  selectedPlace: null as google.maps.places.PlaceResult | null,
  onPlaceChanged: null as (() => void) | null,
}));

vi.mock("../utils/googleMapsLoader.js", () => ({
  loadGoogleMaps: mocks.loadGoogleMaps,
}));
vi.mock("../hooks/useMarkers", () => ({ useMarkers: vi.fn() }));
vi.mock("./PlaceOverviewComponent", () => ({ default: () => null }));
vi.mock("@vis.gl/react-google-maps", async () => {
  const { useEffect } = await import("react");
  const places = {
    Autocomplete: class {
      addListener(_event: string, callback: () => void) {
        mocks.onPlaceChanged = callback;
      }
      getPlace() {
        return mocks.selectedPlace;
      }
    },
  };

  return {
    APIProvider: ({ children }: { children: React.ReactNode }) => children,
    Map: ({ defaultCenter, defaultZoom, children }: {
      defaultCenter: google.maps.LatLngLiteral;
      defaultZoom: number;
      children: React.ReactNode;
    }) => {
      // Match the library's uncontrolled map: defaults apply only at mount.
      useEffect(() => {
        mocks.camera.center = defaultCenter;
        mocks.camera.zoom = defaultZoom;
      }, []);
      return children;
    },
    useMap: mocks.useMap,
    useMapsLibrary: () => places,
  };
});

const australia = { lat: -24.670940951770845, lng: 134.52585021148653 };
const melbourne = { lat: -37.8136, lng: 144.9631 };
const sydney = { lat: -33.8688, lng: 151.2093 };
let resolveMaps: () => void;
let renderer: RenderResult | undefined;
let getCurrentPosition: ReturnType<typeof vi.fn>;
let map: {
  panTo: ReturnType<typeof vi.fn<(center: unknown) => void>>;
  setZoom: ReturnType<typeof vi.fn<(zoom: number) => void>>;
  fitBounds: ReturnType<typeof vi.fn<(bounds: google.maps.LatLngBounds) => void>>;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  mocks.camera.center = null;
  mocks.camera.zoom = 0;
  mocks.selectedPlace = null;
  mocks.onPlaceChanged = null;
  mocks.loadGoogleMaps.mockReturnValue(
    new Promise<void>((resolve) => {
      resolveMaps = resolve;
    }),
  );
  map = {
    panTo: vi.fn((center: unknown) => {
      mocks.camera.center = center;
    }),
    setZoom: vi.fn((zoom: number) => {
      mocks.camera.zoom = zoom;
    }),
    fitBounds: vi.fn<(bounds: google.maps.LatLngBounds) => void>(),
  };
  mocks.useMap.mockReturnValue(map);
  getCurrentPosition = vi.fn();
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
});

afterEach(() => {
  cleanup();
  renderer = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount() {
  act(() => {
    renderer = render(<MonolithicGoogleMap apiKey="test-key" />);
  });
}

async function loadMaps() {
  await act(async () => {
    resolveMaps();
  });
}

function shareLocation(location = melbourne) {
  const success = getCurrentPosition.mock.lastCall![0];
  act(() => success({
    coords: {
      latitude: location.lat,
      longitude: location.lng,
    },
  }));
}

function failLocation(code: number) {
  const failure = getCurrentPosition.mock.lastCall![1];
  act(() => failure({ code, message: "Location unavailable" }));
}

function rerender() {
  act(() => renderer!.rerender(<MonolithicGoogleMap apiKey="test-key" />));
}

function selectPlace(place: google.maps.places.PlaceResult) {
  mocks.selectedPlace = place;
  act(() => mocks.onPlaceChanged!());
}

describe("geolocation and map readiness", () => {
  it("offers the directory when the Maps API cannot load", async () => {
    mocks.loadGoogleMaps.mockRejectedValue(new Error("Network unavailable"));
    await act(async () => {
      renderer = render(<MonolithicGoogleMap apiKey="test-key" />);
    });
    expect(renderer!.getByRole("status").textContent).toContain("unavailable");
    expect(renderer!.getByRole("link", { name: "Explore the directory" }).getAttribute("href")).toBe("/roasters/");
  });

  it("offers the directory without trying to load an unconfigured map", () => {
    renderer = render(<MonolithicGoogleMap apiKey="" />);
    expect(renderer.getByRole("link", { name: "Explore the directory" })).toBeTruthy();
    expect(mocks.loadGoogleMaps).not.toHaveBeenCalled();
  });

  it("recenters and zooms when geolocation arrives after the map", async () => {
    mount();
    await loadMaps();
    expect(mocks.camera).toEqual({ center: australia, zoom: 3 });

    shareLocation();

    expect(mocks.camera).toEqual({ center: melbourne, zoom: 10 });
  });

  it("starts at the user's position when geolocation arrives before the API", async () => {
    mount();
    shareLocation();
    await loadMaps();

    expect(mocks.camera).toEqual({ center: melbourne, zoom: 10 });
  });

  it("waits for the map instance if the API is loaded but useMap is still null", async () => {
    mocks.useMap.mockReturnValue(null);
    mount();
    await loadMaps();
    shareLocation();
    expect(mocks.camera).toEqual({ center: australia, zoom: 3 });

    mocks.useMap.mockReturnValue(map);
    rerender();

    expect(mocks.camera).toEqual({ center: melbourne, zoom: 10 });
  });

  it.each([1, 2, 3])("keeps the fallback for geolocation error code %s", async (code) => {
    mount();
    await loadMaps();
    failLocation(code);

    expect(mocks.camera).toEqual({ center: australia, zoom: 3 });
    expect(map.panTo).not.toHaveBeenCalled();
  });

  it("keeps the fallback when geolocation is unsupported", async () => {
    vi.stubGlobal("navigator", {});
    mount();
    await loadMaps();

    expect(mocks.camera).toEqual({ center: australia, zoom: 3 });
    expect(map.panTo).not.toHaveBeenCalled();
  });

  it("requests a fresh position on later visits and respects revoked permission", async () => {
    mount();
    await loadMaps();
    shareLocation();
    expect(mocks.camera).toEqual({ center: melbourne, zoom: 10 });
    act(() => renderer!.unmount());

    mount();
    await loadMaps();
    shareLocation(sydney);
    expect(mocks.camera).toEqual({ center: sydney, zoom: 10 });
    act(() => renderer!.unmount());

    mount();
    await loadMaps();
    failLocation(1);
    expect(mocks.camera).toEqual({ center: australia, zoom: 3 });
    expect(getCurrentPosition).toHaveBeenCalledTimes(3);
  });

  it("allows manual panning and zooming after centering on the user", async () => {
    mount();
    await loadMaps();
    shareLocation();
    expect(mocks.camera).toEqual({ center: melbourne, zoom: 10 });
    map.panTo(sydney);
    map.setZoom(12);
    rerender();

    expect(mocks.camera).toEqual({ center: sydney, zoom: 12 });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });
});

describe("location search", () => {
  it.each(["before", "after"])("keeps search in control when geolocation arrives %s selection", async (timing) => {
    mount();
    await loadMaps();
    if (timing === "before") shareLocation();
    const location = {
      lat: () => sydney.lat,
      lng: () => sydney.lng,
    } as google.maps.LatLng;
    selectPlace({ geometry: { location } });
    if (timing === "after") shareLocation();

    expect(mocks.camera).toEqual({ center: location, zoom: 14 });
    expect(map.panTo).toHaveBeenLastCalledWith(location);
  });

  it("preserves viewport searches when geolocation arrives later", async () => {
    mount();
    await loadMaps();
    const viewport = {} as google.maps.LatLngBounds;
    selectPlace({ geometry: { viewport } });
    shareLocation();

    expect(map.fitBounds).toHaveBeenCalledExactlyOnceWith(viewport);
    expect(map.panTo).not.toHaveBeenCalled();
    expect(map.setZoom).not.toHaveBeenCalled();
  });
});
