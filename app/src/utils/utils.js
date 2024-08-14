import coffeeRoasters from '../data/coffee-roasters.json';
import coffeeRoastersMulti from '../data/coffee-roasters-multi.json';

export const getRoaster = async (type, options = {}) => {
    let items = [];

    if (type === "roasters") {
        // Fetch roasters from your JSON file
        items = [...coffeeRoasters, ...coffeeRoastersMulti];
    }


    // Sort the roasters alphabetically by name
    items = items.sort((a, b) => a.Name.localeCompare(b.Name));

    // console.log(items); 
    return items;
};

export const getRoasterFilter = (collection, filters = {}) => {
    let filteredItems = collection;

    if (filters.state) {
        filteredItems = filteredItems.filter(item =>
            item.State.split(",").map(s => s.trim()).includes(filters.state)
        );
    }

    if (filters.hasCafe !== undefined) {
        filteredItems = filteredItems.filter(item => item.hasCafe === filters.hasCafe);
    }

    if (filters.multiRoaster !== undefined) {
        filteredItems = filteredItems.filter(item => item.multiRoaster === filters.multiRoaster);
    }

    // console.log(filteredItems); 
    return filteredItems;
};