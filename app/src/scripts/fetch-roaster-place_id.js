import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

// Import API key
import dotenv from 'dotenv';
dotenv.config();

// Set Google API Key
const apiKey = process.env.GOOGLE_MAPS_API_KEY;


// Load existing JSON data
import coffeeRoasters from '../data/coffee-roasters.json' assert { type: 'json' };

// Function to fetch place_id

/**
 * Function to fetch place_id.
 * @date 2024-08-21 15:19:15
 * @author Xander
 *
 * @async
 * @param {*} roaster The roaster object containing Name and State information
 * @returns {unknown} Function to fetch place_id from Google Maps API using the provided roaster's name and state in Australia.
 */
async function fetchPlaceData(roaster, state) {
    const query = `${roaster.Name} ${state} Australia`;
    const apiUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${apiKey}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        console.log('API Response:', JSON.stringify(data, null, 2));

        if (data.candidates.length > 0) {
            return data.candidates[0].place_id;
        } else {
            return null;
        }
    } catch (error) {
        console.error('API request failed:', error);
        return null;
    }
}

/**
 * Update all roaster with new data and save the updated JSON back to the file.
 * @date 2024-08-21 15:20:17
 * @author Xander
 *
 * @async
 * @returns {*} Update all roasters with new data by fetching place data for each roaster and updating their place_id. If place data is not found for a roaster, log a message. Finally, save the updated JSON back to a file and log the filename where the data is saved.
 */
// async function updateRoasters() {
//     for (let roaster of coffeeRoasters) {
//         const placeData = await fetchPlaceData(roaster);
//         if (placeData) {
//             roaster.place_id = placeData.placeId;
//         } else {
//             console.log(`No data found for ${roaster.Name}`);
//         }
//     }   

//     // Save the updated JSON back to the file
//     fs.writeFileSync(filename, JSON.stringify(coffeeRoasters, null, 2));
//     console.log(`Data saved to ${filename}`);
// }

// async function updateRoastersPlaceId() {
//     for (let roaster of coffeeRoasters) {
//         const states = roaster.State.split(',').map(state => state.trim());

//         roaster.place_ids = []; // Array to hold place_ids for all states

//         for (const state of states) {
//             const placeId = await fetchPlaceIdForState(roaster, state);

//             if (placeId) {
//                 roaster.place_ids.push({ state, place_id: placeId });
//             } else {
//                 console.log(`No data found for ${roaster.Name} in ${state}`);
//             }
//         }
//     }

//     // Save the updated JSON back to the file
//     const filename = path.resolve('src/data/coffee-roasters-updated.json');
//     fs.writeFileSync(filename, JSON.stringify(coffeeRoasters, null, 2));
//     console.log(`Data saved to ${filename}`);
// }


/**
 * Update the first 15 roasters with new data
 * This function iterates over the first 15 roasters and updates their place_id using data fetched from fetchPlaceData
 * If no place_data is found for a roaster, it logs a message
 * After updating the roasters, it saves the updated JSON to 'coffee-roasters-updated.json' file using fs.writeFileSync
 * @date 2024-08-21 15:19:40
 * @author Xander
 *
 * @async
 * @returns {*} Update the first 15 roasters with new data by fetching place data for each roaster and updating the place_id. Save the updated JSON data to a new file 'coffee-roasters-update.json'.
 */
async function testUpdateRoasters() {
    for (let i = 0; i < 15; i++) { // Limit to first 15 roasters for testing
        const roaster = coffeeRoasters[i];
        const states = roaster.State.split(',').map(state => state.trim());

        roaster.place_ids = []; // Array to hold place_ids for all states

        for (const state of states) {
            const placeId = await fetchPlaceData(roaster, state);

            if (placeId) {
                roaster.place_ids.push({ state, place_id: placeId });
            } else {
                console.log(`No data found for ${roaster.Name} in ${state}`);
            }
        }
    }

    // Use a static filename
    const filename = path.resolve('src/data/coffee-roasters-updated.json');

    // Save the updated JSON back to a new file using writeFileSync
    fs.writeFileSync(filename, JSON.stringify(coffeeRoasters, null, 2));
    console.log(`Data saved to ${filename}`);
}

// Run the update function
testUpdateRoasters();