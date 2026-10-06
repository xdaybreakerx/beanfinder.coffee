import { beforeEach, expect, it, vi } from "vitest";

const loader = vi.hoisted(() => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn(),
}));

vi.mock("@googlemaps/js-api-loader", () => loader);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

it("shares one initialization and waits for marker support before declaring the map ready", async () => {
  let resolveMarkers: (value: object) => void;
  const markers = new Promise((resolve) => { resolveMarkers = resolve; });
  loader.importLibrary.mockImplementation((library) =>
    library === "marker" ? markers : Promise.resolve({}),
  );
  const { loadGoogleMaps } = await import("./googleMapsLoader.js");
  const loading = loadGoogleMaps("test-key");
  expect(loadGoogleMaps("test-key")).toBe(loading);
  let ready = false;
  loading.then(() => { ready = true; });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(ready).toBe(false);

  resolveMarkers!({});
  await loading;
  expect(ready).toBe(true);
  expect(loader.setOptions).toHaveBeenCalledExactlyOnceWith({ key: "test-key", v: "weekly" });
  expect(loader.importLibrary.mock.calls.map(call => call[0])).toEqual(["maps", "marker"]);
});

it("reports library-loading failures to the existing map loading error handler", async () => {
  const failure = new Error("Maps API unavailable");
  loader.importLibrary.mockRejectedValue(failure);
  const { loadGoogleMaps } = await import("./googleMapsLoader.js");
  await expect(loadGoogleMaps("test-key")).rejects.toBe(failure);
});
