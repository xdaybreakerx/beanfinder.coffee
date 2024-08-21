import fs from 'fs';
import fetch from 'node-fetch';

// Import Maps API key
import dotenv from 'dotenv';
dotenv.config();

// Google API Key
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

// Load existing JSON data
import coffeeRoasters from '../data/coffee-roasters.json' assert { type: 'json' };

// Function to fetch place_id, latitude, and longitude
async function fetchPlaceData(roaster) {
    const query = `${roaster.Name} ${roaster.State} Australia`;
    const apiUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,geometry&key=${apiKey}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        console.log('API Response:', JSON.stringify(data, null, 2)); // Log the entire API response

        if (data.candidates.length > 0) {
            const placeId = data.candidates[0].place_id;
            const lat = data.candidates[0].geometry.location.lat;
            const lng = data.candidates[0].geometry.location.lng;

            return { placeId, lat, lng };
        } else {
            return null;
        }
    } catch (error) {
        console.error('API request failed:', error);
        return null;
    }
}

// Update each roaster with new data
async function updateRoasters() {
    for (let roaster of coffeeRoasters) {
        const placeData = await fetchPlaceData(roaster);
        if (placeData) {
            roaster.place_id = placeData.placeId;
            roaster.latitude = placeData.lat;
            roaster.longitude = placeData.lng;
        } else {
            console.log(`No data found for ${roaster.Name}`);
        }
    }

    // Save the updated JSON back to the file
    fs.writeFileSync('../data/coffee-roasters-updated.json', JSON.stringify(coffeeRoasters, null, 2));
}

// Run the update function
updateRoasters();