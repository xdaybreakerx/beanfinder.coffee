import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

// Import Maps API key
import dotenv from 'dotenv';
dotenv.config();

// Google API Key
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

// Load existing JSON data
import coffeeRoasters from '../data/coffee-roasters-updated.json' assert { type: 'json' };

// Function to fetch additional place details using place_id
async function fetchPlaceDetails(placeId) {
    const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address,rating&key=${apiKey}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        console.log('Place Details API Response:', JSON.stringify(data, null, 2));

        if (data.result) {
            const { geometry, formatted_address, rating } = data.result;
            return {
                latitude: geometry.location.lat,
                longitude: geometry.location.lng,
                address: formatted_address,
                rating: rating || 'N/A',
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error('API request failed:', error);
        return null;
    }
}

// Update roasters with both place_id and additional details
async function testUpdateRoastersWithDetails() {
    for (let i = 0; i < 15; i++) { // Limit to first 15 roasters for testing
        const roaster = coffeeRoasters[i];

        if (roaster.place_ids && roaster.place_ids.length > 0) {
            for (const placeData of roaster.place_ids) {
                const { place_id, state } = placeData;

                if (place_id) {
                    // Fetch additional details using the place_id
                    const details = await fetchPlaceDetails(place_id);
                    if (details) {
                        // Store details for each place_id under the specific state
                        placeData.latitude = details.latitude;
                        placeData.longitude = details.longitude;
                        placeData.address = details.address;
                        placeData.rating = details.rating;
                    }
                } else {
                    console.log(`No data found for ${roaster.Name} in ${state}`);
                }
            }
        } else {
            console.log(`No place_ids found for ${roaster.Name}`);
        }
    }

    // Save the updated JSON back to a new file
    const filename = path.resolve('src/data/coffee-roasters-updated-from-place_ids.json');
    fs.writeFileSync(filename, JSON.stringify(coffeeRoasters, null, 2));
    console.log(`Data saved to ${filename}`);
}

async function updateAllRoastersWithDetails() {
    for (let i = 0; i < coffeeRoasters.length; i++) { // Loop through all roasters
        const roaster = coffeeRoasters[i];

        if (roaster && roaster.place_ids && roaster.place_ids.length > 0) {
            for (const placeData of roaster.place_ids) {
                const { place_id, state } = placeData;

                if (place_id) {
                    // Fetch additional details using the place_id
                    const details = await fetchPlaceDetails(place_id);
                    if (details) {
                        // Store details for each place_id under the specific state
                        placeData.latitude = details.latitude;
                        placeData.longitude = details.longitude;
                        placeData.address = details.address;
                        placeData.rating = details.rating;
                    }
                } else {
                    console.log(`No data found for ${roaster.Name} in ${state}`);
                }
            }
        } else {
            console.log(`No place_ids found for ${roaster?.Name}`);
        }
    }

    // Save the updated JSON back to a new file
    const filename = path.resolve('src/data/coffee-roasters-updated-from-place_ids.json');
    fs.writeFileSync(filename, JSON.stringify(coffeeRoasters, null, 2));
    console.log(`Data saved to ${filename}`);
}
// Run the update function
// testUpdateRoastersWithDetails();
updateAllRoastersWithDetails();