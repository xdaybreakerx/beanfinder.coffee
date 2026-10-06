import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PlaceOverviewComponent from "./PlaceOverviewComponent";
import { mapPlaces } from "../utils/mapPlaces";
const mocks = vi.hoisted(() => ({ fetchFields: vi.fn(), country: "AU", address: "1 Coffee Street, Melbourne VIC, Australia" }));
vi.mock("@vis.gl/react-google-maps", () => { const places = {
  Place: class {
    formattedAddress = mocks.address;
    addressComponents = [{ types: ["country"], shortText: mocks.country }];
    fetchFields = mocks.fetchFields;
  },
}; return { useMapsLibrary: () => places }; });
beforeEach(() => { mocks.country = "AU"; mocks.fetchFields.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);
it("fetches only current address/country and keeps curated identity and directions separate", async () => {
  const view = render(<PlaceOverviewComponent place={mapPlaces[0]} reserveDetails={() => true} />);
  await act(async () => {});
  expect(mocks.fetchFields).toHaveBeenCalledExactlyOnceWith({ fields: ["formattedAddress", "addressComponents"] });
  expect(view.getByRole("heading").textContent).toBe(mapPlaces[0].Name);
  expect(document.activeElement).toBe(view.getByRole("heading"));
  expect(view.getByText(mocks.address)).toBeTruthy();
  expect(view.getAllByAltText("Google Maps")).toHaveLength(2);
  const directions = new URL(view.getByRole("link", { name: "Directions" }).getAttribute("href")!);
  expect(directions.searchParams.get("destination_place_id")).toBe(mapPlaces[0].placeId);
});
it.each(["failure", "foreign", "limit"])("preserves Maps links when current details are unavailable: %s", async kind => {
  if (kind === "failure") mocks.fetchFields.mockRejectedValue(new Error("Unavailable"));
  if (kind === "foreign") mocks.country = "US";
  const view = render(<PlaceOverviewComponent place={mapPlaces[0]} reserveDetails={() => kind !== "limit"} />);
  await act(async () => {});
  expect(view.queryByText(mocks.address)).toBeNull();
  expect(view.getByRole("link", { name: "Directions" })).toBeTruthy();
  expect(view.getByRole("status").textContent).not.toBe("");
  if (kind === "limit") expect(mocks.fetchFields).not.toHaveBeenCalled();
});
it("discards a response arriving after the selected place closes", async () => {
  let finish: () => void;
  mocks.fetchFields.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  const view = render(<PlaceOverviewComponent place={mapPlaces[0]} reserveDetails={() => true} />);
  view.unmount();
  await act(async () => finish!());
  expect(view.container.textContent).toBe("");
});
