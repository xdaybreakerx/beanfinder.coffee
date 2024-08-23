import roasters from "../data/coffee-roasters-updated-from-place_ids.json";

export function usePoiCreation() {
  const roastersPois = [];

  for (let i = 0; i < roasters.length; i++) {
    const roaster = roasters[i];

    if (!roaster.place_ids || roaster.place_ids.length === 0) {
      // console.log(`Skipping roaster ${roaster.Name} due to missing place_ids.`); 
      continue;
    }

    for (const place of roaster.place_ids) {
      const poi = {
        key: place.place_id,
        location: {
          lat: place.latitude,
          lng: place.longitude,
        },
        name: `${roaster.Name} (${place.state})`,
        address: place.address,
        rating: place.rating || "N/A",
        place_id: place.place_id,
      };
      roastersPois.push(poi);
    }
  }

  return roastersPois;
}
