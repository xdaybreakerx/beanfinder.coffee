// A specific Google listing/review link can identify a manually checked score
// without a street address or Places API ID. Keep tracking parameters out of Git.
export function googleReviewUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  let url: URL;
  try { url = new URL(raw); } catch { return undefined; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return undefined;
  if ((url.hostname === 'maps.app.goo.gl' && /^\/[a-z0-9_-]+\/?$/i.test(url.pathname)) ||
      (url.hostname === 'goo.gl' && /^\/maps\/[a-z0-9_-]+\/?$/i.test(url.pathname))) return `${url.origin}${url.pathname}`;
  if (!/^(?:(?:www|maps)\.)?google\.com(?:\.au)?$/.test(url.hostname)) return undefined;
  const cid = url.searchParams.get('cid');
  if (/^\/maps(?:\/|$)/.test(url.pathname) && cid && /^[1-9]\d{0,19}$/.test(cid)) {
    return `https://www.google.com/maps?cid=${cid}`;
  }
  if (/^\/maps\/place\/[^/]+/.test(url.pathname)) return `${url.origin}${url.pathname}`;
  if (url.pathname === '/search' && /^#lrd=0x[0-9a-f]+:0x[0-9a-f]+,1,*$/i.test(url.hash)) {
    const query = url.searchParams.get('q');
    if (query?.trim()) return `https://www.google.com/search?${new URLSearchParams({ q: query.trim() })}${url.hash}`;
  }
  return undefined;
}
