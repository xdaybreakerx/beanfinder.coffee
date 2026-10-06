// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@netlify/functions";
import handler from "../../netlify/functions/place-coordinates.mts";
import purge from "../../netlify/functions/purge-place-coordinates.mts";
import refresh, { config } from "../../netlify/functions/refresh-place-coordinates.mts";

const storage = vi.hoisted(() => ({ getStore: vi.fn(), readCachedCoordinates: vi.fn(), refreshCoordinates: vi.fn(), purgeExpiredCoordinates: vi.fn() }));
vi.mock("@netlify/blobs", () => ({ getStore: storage.getStore }));
vi.mock("./place-coordinates", async original => ({ ...await original<typeof import("./place-coordinates")>(), readCachedCoordinates: storage.readCachedCoordinates, refreshCoordinates: storage.refreshCoordinates, purgeExpiredCoordinates: storage.purgeExpiredCoordinates }));
vi.mock("../utils/mapPlaces", () => ({ mapPlaces: [{ placeId: "reviewed" }, { placeId: "missing" }] }));
const context = (deploy: string) => ({ deploy: { context: deploy } }) as Context;
const request = new Request("https://beanfinder.coffee/.netlify/functions/place-coordinates");
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("production coordinate functions", () => {
  it("rejects previews, unknown IDs and unsupported methods before accessing storage", async () => {
    expect((await handler(request, context("deploy-preview"))).status).toBe(503);
    expect((await handler(new Request(request.url, { method: "POST" }), context("production"))).status).toBe(405);
    expect((await handler(new Request("https://beanfinder.coffee/?place_id=unknown"), context("production"))).status).toBe(404);
    await purge(request, context("deploy-preview"));
    await refresh(request, context("deploy-preview"));
    expect(storage.getStore).not.toHaveBeenCalled();
    expect(storage.refreshCoordinates).not.toHaveBeenCalled();
  });

  it("serves all cached markers with strong consistency and never calls Google", async () => {
    vi.stubEnv("GOOGLE_PLACES_SERVER_API_KEY", "private-server-key");
    vi.stubEnv("PLACE_COORDINATES_MONTHLY_LIMIT", "1000");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    storage.readCachedCoordinates.mockResolvedValue([{ placeId: "reviewed" }]);
    const response = await handler(request, context("production"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Netlify-CDN-Cache-Control")).toBe("no-store");
    expect(storage.getStore).toHaveBeenCalledExactlyOnceWith({ name: "place-coordinates-v1", consistency: "strong" });
    expect(await response.json()).toEqual({ coordinates: [{ placeId: "reviewed" }], missingPlaceIds: ["missing"] });
    expect(storage.refreshCoordinates).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("filters optional single-ID cache reads without triggering retrieval", async () => {
    storage.readCachedCoordinates.mockResolvedValue([]);
    const response = await handler(new Request(request.url + "?place_id=reviewed"), context("production"));
    expect(await response.json()).toEqual({ coordinates: [], missingPlaceIds: ["reviewed"] });
    expect(storage.readCachedCoordinates).toHaveBeenCalledWith(undefined, [{ placeId: "reviewed" }]);
  });

  it("passes the private key and bounded budget only to the hourly worker", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("GOOGLE_PLACES_SERVER_API_KEY", "private-server-key");
    vi.stubEnv("PLACE_COORDINATES_MONTHLY_LIMIT", "5000");
    storage.refreshCoordinates.mockResolvedValue({ processed: 4, refreshed: 4, failed: 0, disabled: false });
    expect((await refresh(request, context("production"))).status).toBe(204);
    expect(storage.refreshCoordinates).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "private-server-key", limit: 1000 }));
    expect(config.schedule).toBe("17 * * * *");
  });

  it("returns an unavailable response without exposing storage credentials", async () => {
    storage.getStore.mockImplementation(() => { throw new Error("private token"); });
    const response = await handler(request, context("production"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private token");
  });
});
