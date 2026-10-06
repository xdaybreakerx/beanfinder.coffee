import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('route metadata uses the apex origin and analytics is absent', async ({ page }) => {
  const analytics: string[] = [];
  page.on('request', request => { if (/googletagmanager|google-analytics/.test(request.url())) analytics.push(request.url()); });
  const titles = new Set<string>();
  for (const path of ['/', '/roasters/?state=VIC&page=2', '/roasters/online-subscriptions/1', '/submit/', '/privacy/', '/terms/']) {
    await page.goto(path);
    const pathname = new URL(path, 'https://beanfinder.coffee').pathname;
    const canonical = 'https://beanfinder.coffee' + (pathname === '/' ? '/' : pathname.replace(/\/+$/, '') + '/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', await page.title());
    titles.add(await page.title());
    await expect(page.locator('script[src*="googletagmanager"], script[src*="google-analytics"]')).toHaveCount(0);
  }
  expect(titles.size).toBe(6);
  expect(analytics).toEqual([]);
  for (const path of ['/success/', '/404', '/__forms.html']) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  }
});

for (const theme of ['caramellatte', 'coffee']) {
  test(`map reserves its loading area and preserves a directory fallback in ${theme}`, async ({ page }) => {
    await page.addInitScript(value => {
      localStorage.setItem('theme', value);
      (window as typeof window & { locationRequests: number }).locationRequests = 0;
      Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: () => {
        (window as typeof window & { locationRequests: number }).locationRequests++;
      } } });
    }, theme);
    let release: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    await page.route('https://maps.googleapis.com/**', async route => { await blocked; await route.abort(); });
    await page.goto('/map/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Loading the Australian roaster map…')).toBeVisible();
    await expect(page.locator('astro-island[client="only"]')).not.toHaveAttribute('ssr', '');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://beanfinder.coffee/map/');
    const shell = page.locator('.map-shell');
    const before = (await shell.boundingBox())!.height;
    expect((await page.locator('.map-canvas').boundingBox())!.height).toBeGreaterThanOrEqual(320);
    release!();
    await expect(page.getByText('The map is unavailable right now.')).toBeVisible({ timeout: 15000 });
    expect((await shell.boundingBox())!.height).toBeCloseTo(before, 0);
    await expect(shell.getByRole('link', { name: 'Explore the directory' })).toHaveAttribute('href', '/roasters/');
    expect(await page.evaluate(() => (window as typeof window & { locationRequests: number }).locationRequests)).toBe(0);
    for (const fontSize of ['16px', '32px']) {
      await page.evaluate(value => document.documentElement.style.fontSize = value, fontSize);
      for (const width of [320, 375, 414]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      }
    }
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  });
  test(`policy pages and footer links fit narrow screens and enlarged text in ${theme}`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    for (const path of ['/privacy/', '/terms/']) {
      await page.goto(path);
      for (const fontSize of ['16px', '32px']) {
        await page.evaluate(value => document.documentElement.style.fontSize = value, fontSize);
        for (const width of [320, 375, 414]) {
          await page.setViewportSize({ width, height: 900 });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        }
      }
      await expect(page.locator('footer').getByRole('link', { name: 'Privacy', exact: true })).toHaveAttribute('href', '/privacy/');
      await expect(page.locator('footer').getByRole('link', { name: 'Terms of use', exact: true })).toHaveAttribute('href', '/terms/');
    }
  });
}

test('the server-rendered map fallback remains useful without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL + '/map/');
  await expect(page.locator('noscript p')).toContainText('JavaScript is needed for the interactive map.');
  await expect(page.locator('noscript p')).toBeVisible();
  await expect(page.locator('.map-shell').getByRole('link', { name: 'Explore the directory' })).toHaveAttribute('href', '/roasters/');
  expect((await page.locator('.map-canvas').boundingBox())!.height).toBeGreaterThanOrEqual(320);
  await context.close();
});

test('robots identifies the canonical sitemap and excludes utility pages', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.ok()).toBe(true);
  const body = await response.text();
  expect(body).toContain('Sitemap: https://beanfinder.coffee/sitemap-index.xml');
  expect(body).toContain('Disallow: /__forms');
  expect(body).toContain('Disallow: /success/');
});
