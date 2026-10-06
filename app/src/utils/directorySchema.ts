export const AU_STATES = new Set(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']);
export type Provenance =
  | { source: 'legacy-directory'; verifiedAt: null }
  | { source: 'operator-website'; url: string; reviewedAt: string; fields: Array<'Name' | 'Website' | 'State' | 'hasCafe' | 'multiRoaster'> }
  | { source: 'community-submission'; receipt: string; proposedAt: string; verifiedAt: null };
export type Business = {
  businessId: string;
  Name: string;
  Website: string;
  websiteAliases?: string[];
  State: string;
  hasCafe: boolean;
  multiRoaster: boolean;
  subscription?: boolean;
  selection?: string[];
  brew?: string[];
  provenance: Provenance;
};

export class DirectoryError extends Error {}
export function websiteIdentity(raw: string): string {
  let url: URL;
  try { url = new URL(raw); } catch { throw new DirectoryError('Invalid HTTP(S) website'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new DirectoryError('Invalid HTTP(S) website');
  }
  // Preserve paths, ports and queries: different brands can share a hosting domain.
  return `${url.hostname.replace(/^www\./, '')}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/+$/, '')}${url.search}`;
}
export function businessWebsites(business: Pick<Business, 'Website' | 'websiteAliases'>): string[] {
  return [business.Website, ...(business.websiteAliases ?? [])].map(websiteIdentity);
}
export function validId(id: unknown, prefix: string): id is string {
  return typeof id === 'string' && new RegExp(`^${prefix}-[a-z0-9][a-z0-9-]{0,99}$`).test(id);
}
export function validPastDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now();
}
function onlyKeys(value: object, keys: string[]): boolean { return Object.keys(value).every(key => keys.includes(key)); }
function validateProvenance(value: any) {
  if (!value || typeof value !== 'object') throw new DirectoryError('Missing business provenance');
  if (value.source === 'legacy-directory' && value.verifiedAt === null && onlyKeys(value, ['source', 'verifiedAt'])) return;
  if (value.source === 'operator-website' && validPastDate(value.reviewedAt) && Array.isArray(value.fields) && value.fields.length && new Set(value.fields).size === value.fields.length && value.fields.every((field: string) => ['Name', 'Website', 'State', 'hasCafe', 'multiRoaster'].includes(field)) && onlyKeys(value, ['source', 'url', 'reviewedAt', 'fields'])) {
    websiteIdentity(value.url); return;
  }
  if (value.source === 'community-submission' && value.verifiedAt === null && validPastDate(value.proposedAt) &&
      typeof value.receipt === 'string' && /^\.github\/form-submissions\/[a-zA-Z0-9-]{1,80}\.json$/.test(value.receipt) &&
      onlyKeys(value, ['source', 'receipt', 'proposedAt', 'verifiedAt'])) return;
  throw new DirectoryError('Invalid business provenance');
}

export function validateDirectory(roasters: unknown, sellers: unknown): Business[] {
  if (!Array.isArray(roasters) || !Array.isArray(sellers)) throw new DirectoryError('Directory collections must be arrays');
  const ids = new Set<string>();
  const websites = new Map<string, string>();
  for (const [records, seller] of [[roasters, false], [sellers, true]] as const) for (const record of records) {
    if (!record || !validId(record.businessId, 'biz') || ids.has(record.businessId)) throw new DirectoryError('Invalid or duplicate business ID');
    ids.add(record.businessId);
    if (typeof record.Name !== 'string' || !record.Name.trim() || record.Name !== record.Name.trim() || /[\x00-\x1f\x7f]/.test(record.Name) ||
        typeof record.Website !== 'string' || typeof record.hasCafe !== 'boolean' || record.multiRoaster !== seller ||
        !onlyKeys(record, ['businessId', 'Name', 'Website', 'websiteAliases', 'State', 'hasCafe', 'multiRoaster', 'subscription', 'selection', 'brew', 'provenance'])) {
      throw new DirectoryError(`Invalid business fields or seller classification: ${record.businessId}`);
    }
    const states = typeof record.State === 'string' ? record.State.split(',').map((state: string) => state.trim()) : [];
    if (!states.length || new Set(states).size !== states.length || !(seller && record.State === 'all') && !states.every((state: string) => AU_STATES.has(state))) {
      throw new DirectoryError(`Invalid state set: ${record.businessId}`);
    }
    if (record.websiteAliases !== undefined && (!Array.isArray(record.websiteAliases) || !record.websiteAliases.every((url: unknown) => typeof url === 'string'))) throw new DirectoryError('Invalid website aliases');
    const own = new Set<string>();
    for (const identity of businessWebsites(record)) {
      if (own.has(identity) || websites.has(identity)) throw new DirectoryError(`Duplicate normalized website: ${identity}`);
      own.add(identity); websites.set(identity, record.businessId);
    }
    if ((!seller && ['subscription', 'selection', 'brew'].some(key => key in record)) ||
        (record.subscription !== undefined && typeof record.subscription !== 'boolean') ||
        ['selection', 'brew'].some(key => record[key] !== undefined && (!Array.isArray(record[key]) || !record[key].length || new Set(record[key]).size !== record[key].length ||
          !record[key].every((value: string) => (key === 'selection' ? ['surprise', 'choose'] : ['filter', 'espresso', 'decaf']).includes(value))))) {
      throw new DirectoryError(`Invalid seller options: ${record.businessId}`);
    }
    validateProvenance(record.provenance);
  }
  return [...roasters, ...sellers];
}
