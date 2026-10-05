import fs from "node:fs/promises";
import dotenv from "dotenv";
import coffeeRoasters from "../data/coffee-roasters-updated.json" with { type: "json" };
import { getAustralianPlaceDetails } from "./google-places.mjs";

dotenv.config();
const options = { apiKey: process.env.GOOGLE_MAPS_API_KEY };
const updated = [];
for (const roaster of coffeeRoasters) {
  const place_ids = [];
  for (const place of roaster.place_ids ?? []) {
    const details = await getAustralianPlaceDetails(place.place_id, options);
    if (details) place_ids.push({ state: place.state, place_id: place.place_id, ...details });
    else console.info(`Excluded unverified or non-Australian location for ${roaster.Name}`);
  }
  updated.push({ ...roaster, place_ids });
}
await fs.writeFile(new URL("../data/coffee-roasters-updated-from-place_ids.json", import.meta.url), JSON.stringify(updated, null, 2));
console.info("Saved verified Australian locations.");
