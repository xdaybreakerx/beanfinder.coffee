import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMarkers } from "./useMarkers";

const cluster = vi.hoisted(() => ({ addMarkers: vi.fn(), clearMarkers: vi.fn(), setMap: vi.fn() }));
vi.mock("@googlemaps/markerclusterer", () => ({
  MarkerClusterer: class {
    addMarkers = cluster.addMarkers;
    clearMarkers = cluster.clearMarkers;
    setMap = cluster.setMap;
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
    onClick.mockClear();
    markers[0].dispatchEvent(new Event("gmp-click"));
    expect(onClick).toHaveBeenCalledExactlyOnceWith("melbourne-place");
    unmount();
    expect(cluster.clearMarkers).toHaveBeenCalledOnce();
    expect(cluster.setMap).toHaveBeenCalledExactlyOnceWith(null);
  });
  it.each(["Enter", " "])("handles %s without a native click and suppresses the matching native event", keyName => {
    const marker = new EventTarget();
    vi.stubGlobal("google", { maps: { marker: { AdvancedMarkerElement: class { constructor() { return marker; } } } } });
    const onClick = vi.fn();
    renderHook(() => useMarkers({}, [{ place_id: "branch", name: "Coffee", location: { lat: -37.8, lng: 145 } }], onClick));
    const key = new KeyboardEvent("keydown", { key: keyName, cancelable: true });
    marker.dispatchEvent(key);
    marker.dispatchEvent(new Event("gmp-click"));
    expect(key.defaultPrevented).toBe(true);
    expect(onClick).toHaveBeenCalledExactlyOnceWith("branch");
    marker.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    marker.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
