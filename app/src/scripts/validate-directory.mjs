import { readFile, access } from 'node:fs/promises';
import { validateDirectory } from '../utils/directorySchema.ts';
import { validateLocations } from '../utils/locationSchema.ts';
import { createAustralianPois } from '../utils/australianPlaces.ts';
import { PROCESSED_SUBMISSIONS_PATH, readProcessedSubmissionIds } from '../server/form-submission-backfill.ts';

const read = async name => JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const [roasters, sellers, manifest, reviewed, snapshot] = await Promise.all([
  'coffee-roasters', 'coffee-roasters-multi', 'legacy-place-identities', 'reviewed-places', 'coffee-roasters-updated-from-place_ids',
].map(read));
const businesses = validateDirectory(roasters, sellers);
readProcessedSubmissionIds(await readFile(new URL(`../../../${PROCESSED_SUBMISSIONS_PATH}`, import.meta.url), 'utf8'));
if (manifest.source !== 'legacy-snapshot' || manifest.verifiedAt !== null || Object.keys(manifest).some(key => !['source', 'verifiedAt', 'locations'].includes(key))) throw new Error('Invalid legacy identity manifest');
const { legacy } = validateLocations(manifest.locations, reviewed, businesses);
const accepted = new Set(createAustralianPois(snapshot).map(place => place.place_id));
if (legacy.length !== accepted.size || legacy.some(place => !accepted.has(place.placeId))) throw new Error('Legacy location identities must preserve every accepted marker');
for (const business of businesses) if (business.provenance.source === 'community-submission') {
  await access(new URL(`../../../${business.provenance.receipt}`, import.meta.url));
}
console.log(`Validated ${businesses.length} businesses, ${legacy.length} legacy location identities and ${reviewed.length} reviewed locations.`);
for (const place of legacy.filter(place => place.businessId === null && !reviewed.some(item => item.locationId === place.locationId))) {
  console.log(`Review pending: ${place.locationId} (${place.candidateBusinessIds.join(', ')}). Marker retained; directory association withheld.`);
}
