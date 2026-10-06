import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReviewedCoordinates } from "./useReviewedCoordinates";
import { COORDINATE_TTL } from "../utils/placeCoordinates";

vi.mock("../utils/mapPlaces", () => ({ mapPlaces: [{ placeId: "new-place", Name: "New Coffee", state: "VIC" }] }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });
const coordinate = (now = Date.now(), duration = COORDINATE_TTL) => ({ placeId: "new-place", latitude: -37.8, longitude: 145, countryCode: "AU", provider: "google-maps", retrievedAt: new Date(now).toISOString(), expiresAt: new Date(now + duration).toISOString() });
const response = (coordinates: unknown[]) => Response.json({ coordinates, missingPlaceIds: [] });

describe("automatic cached map coordinates", () => {
  it("loads valid cached markers automatically without a place-specific lookup", async () => {
    const fetcher = vi.fn(async () => response([coordinate()]));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useReviewedCoordinates());
    await waitFor(() => expect(result.current.pois).toHaveLength(1));
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/.netlify/functions/place-coordinates", expect.objectContaining({ cache: "no-store" }));
    expect(result.current.pois[0].name).toBe("New Coffee (VIC)");
    expect(result.current.pending).toBe(false);
    expect(result.current.missingPlaceIds).toEqual([]);
  });

  it("waits for map readiness before loading the cache", async () => {
    const fetcher = vi.fn(async () => response([]));
    vi.stubGlobal("fetch", fetcher);
    const { result, rerender } = renderHook(({ enabled }) => useReviewedCoordinates(enabled), { initialProps: { enabled: false } });
    expect(fetcher).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result.current.missingPlaceIds).toEqual(["new-place"]);
  });

  it("rejects unknown, expired, duplicate and polluted coordinates", async () => {
    const good = coordinate();
    vi.stubGlobal("fetch", vi.fn(async () => response([
      { ...good, placeId: "unknown" }, { ...good, rating: 5 },
      { ...good, expiresAt: good.retrievedAt }, good, good,
    ])));
    const { result } = renderHook(() => useReviewedCoordinates());
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.pois).toHaveLength(1);
  });

  it.each([429, 503])("keeps a useful fallback when cache reads return %s", async status => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({}, { status })));
    const { result } = renderHook(() => useReviewedCoordinates());
    await waitFor(() => expect(result.current.error).toContain("Google Maps links"));
    expect(result.current.pois).toEqual([]);
    expect(result.current.pending).toBe(false);
  });

  it("rechecks hourly, preserves valid markers on errors, and recovers on returning to the tab", async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const fetcher = vi.fn().mockResolvedValueOnce(response([coordinate()])).mockRejectedValueOnce(new Error("Offline")).mockImplementation(async () => response([]));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useReviewedCoordinates());
    await act(async () => {});
    expect(result.current.pois).toHaveLength(1);
    await act(async () => vi.advanceTimersByTimeAsync(60 * 60 * 1000));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeTruthy();
    expect(result.current.pois).toHaveLength(1);
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(result.current.error).toBeNull();
    expect(result.current.pois).toEqual([]);
    expect(result.current.missingPlaceIds).toEqual(["new-place"]);
  });

  it("removes expired coordinates from a map left open", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => response([coordinate(Date.now(), 1000)])));
    const { result } = renderHook(() => useReviewedCoordinates());
    await act(async () => {});
    expect(result.current.pois).toHaveLength(1);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.pois).toEqual([]);
    expect(result.current.missingPlaceIds).toEqual(["new-place"]);
  });

  it("aborts outstanding cache reads when the map unmounts", () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetcher);
    const { unmount } = renderHook(() => useReviewedCoordinates());
    const signal = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].signal!;
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
