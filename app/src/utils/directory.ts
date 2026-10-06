import roasterRecords from '../data/coffee-roasters.json';
import sellerRecords from '../data/coffee-roasters-multi.json';
import { validateDirectory } from './directorySchema';

export const businesses = validateDirectory(roasterRecords, sellerRecords);
export const roasters = businesses.filter(business => !business.multiRoaster);
export const sellers = businesses.filter(business => business.multiRoaster);
