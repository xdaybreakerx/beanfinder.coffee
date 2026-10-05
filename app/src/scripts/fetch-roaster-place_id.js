import fs from "node:fs/promises";
import dotenv from "dotenv";
import coffeeRoasters from "../data/coffee-roasters.json" with { type: "json" };
import { findAustralianPlace } from "./google-places.mjs";

dotenv.config();
const options = { apiKey: process.env.GOOGLE_MAPS_API_KEY };
const updated = [];
for (const roaster of coffeeRoasters) {
  const place_ids = [];
  for (const state of roaster.State.split(",").map(state => state.trim())) {
    const place_id = await findAustralianPlace(roaster.Name, state, options);
    if (place_id) place_ids.push({ state, place_id });
    else console.info(`No Australian location found for ${roaster.Name} in ${state}`);
  }
  updated.push({ ...roaster, place_ids });
}
await fs.writeFile(new URL("../data/coffee-roasters-updated.json", import.meta.url), JSON.stringify(updated, null, 2));
console.info("Saved Australian place IDs.");
