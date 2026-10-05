import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMarkers } from "./useMarkers";

const cluster = vi.hoisted(() => ({ addMarkers: vi.fn(), clearMarkers: vi.fn() }));
vi.mock("@googlemaps/markerclusterer", () => ({
  MarkerClusterer: class {
    addMarkers = cluster.addMarkers;
    clearMarkers = cluster.clearMarkers;
  },
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("accessible map markers", () => {
  it("opens the correct place from a Google DOM click and clears clusters on unmount", () => {
    const markers: EventTarget[] = [];
    const options: Array<{ gmpClickable: boolean; title: string }> = [];
    vi.stubGlobal("google", { maps: { marker: { AdvancedMarkerElement: class extends EventTarget {
      constructor(option: { gmpClickable: boolean; title: string }) {
        super(); options.push(option); markers.push(this);
      }
    } } } });
    const onClick = vi.fn();
    const { unmount } = renderHook(() => useMarkers({}, [
      { place_id: "melbourne-place", name: "Melbourne Coffee", location: { lat: -37.8, lng: 145 } },
      { place_id: "sydney-place", name: "Sydney Coffee", location: { lat: -33.8, lng: 151 } },
    ], onClick));
    expect(options.every(option => option.gmpClickable)).toBe(true);
    expect(cluster.addMarkers).toHaveBeenCalledWith(markers);
    markers[1].dispatchEvent(new Event("gmp-click"));
    expect(onClick).toHaveBeenCalledExactlyOnceWith("sydney-place");
    unmount();
    expect(cluster.clearMarkers).toHaveBeenCalledOnce();
  });
});
