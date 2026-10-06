import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { renderedContrast } from './rowContrast';

test.beforeEach(async ({ page }) => {
  await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
});

test("home navigation and state browsing", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="generator"]')).toHaveAttribute("content", /^Astro v7\./);
  await expect(page.getByRole("heading", { name: "Find your next favourite roast." })).toBeVisible();
  await expect(page.locator('.hero-art')).toHaveCount(0);
  await expect(page.getByText('Roasted here. Enjoyed anywhere.')).toHaveCount(0);
  await expect(page.locator('.directory-stats dd').last()).toHaveText('All');
  await expect(page.locator('footer')).toContainText('A good place to find your next great coffee.');
  await expect(page.locator('footer')).toContainText('Made with');
  await expect(page.getByRole('img', { name: 'love', exact: true })).toBeVisible();
  const state = page.getByRole("link", { name: /^VIC Victoria \d+ listings$/ });
  await expect(state).toHaveAttribute('href', '/roasters/?state=VIC');
  await expect(state).toHaveCSS("align-items", "center");
  await expect(state).toHaveCSS("border-bottom-style", "solid");
  await state.click();
  await expect(page).toHaveURL(/\/roasters\/\?state=VIC$/);
  await expect(page.getByLabel('State or territory')).toHaveValue('VIC');
  await expect(page.locator("#list-of-roasters .roaster-row:visible")).toHaveCount(12);
});

test("legacy state URLs redirect to consistent filters and pagination", async ({ page, request }) => {
  for (const [path, destination] of [
    ['/roasters/TAS/false/1', '/roasters/?state=TAS'],
    ['/roasters/VIC/true/2', '/roasters/?state=VIC&cafe=true&page=2'],
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe(destination);
  }
  for (const path of ['/roasters/ZZ/false/1', '/roasters/TAS/bogus/1', '/roasters/TAS/false/0']) {
    expect((await request.get(path)).status()).toBe(404);
  }
  await page.goto("/roasters/VIC/false/1");
  await expect(page).toHaveURL(/\/roasters\/\?state=VIC$/);
  const next = page.getByRole("link", { name: "Next", exact: true });
  await expect(next).toHaveAttribute('href', '/roasters/?state=VIC&page=2');
  await next.click();
  await expect(page.getByRole('link', { name: 'Previous', exact: true })).toHaveAttribute('href', '/roasters/?state=VIC');
  await expect(page).toHaveURL(/\/roasters\/\?state=VIC&page=2$/);
  await expect(page.locator("#list-of-roasters .roaster-row:visible")).toHaveCount(12);
  await page.getByLabel('With a cafe', { exact: true }).check();
  await expect(page).toHaveURL(/\/roasters\/\?state=VIC&cafe=true$/);
  await expect(page.getByLabel('State or territory')).toHaveValue('VIC');
});

test('header links directly to multi-roaster sellers and identifies the current section', async ({ page }) => {
  await page.goto('/roasters/');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(navigation.getByRole('link', { name: 'Directory', exact: true })).toHaveAttribute('aria-current', 'page');
  const multi = navigation.getByRole('link', { name: 'Multi-roaster', exact: true });
  await expect(multi).toHaveAttribute('href', '/roasters/online-subscriptions/1');
  await multi.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/roasters\/online-subscriptions\/1\/?$/);
  await expect(page.getByRole('heading', { name: 'Explore multi-roaster sellers.' })).toBeVisible();
  await expect(multi).toHaveAttribute('aria-current', 'page');
  await expect(navigation.getByRole('link', { name: 'Directory', exact: true })).not.toHaveAttribute('aria-current');
  await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
  await navigation.getByRole('link', { name: 'Directory', exact: true }).click();
  await expect(navigation.getByRole('link', { name: 'Directory', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(multi).not.toHaveAttribute('aria-current');
});

test("theme toggle persists across reloads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "caramellatte");
  const toggle = page.getByRole("checkbox", { name: "Toggle dark mode" });
  await page.locator('label[for="theme-controller"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "coffee");
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('coffee');
  await page.reload();
  await expect(toggle).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "coffee");
  await page.locator('label[for="theme-controller"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "caramellatte");
});

for (const [saved, theme] of [['light', 'caramellatte'], ['dark', 'coffee']]) {
  test(`retains the saved ${saved} preference with the new theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: saved === 'light' ? 'dark' : 'light' });
    await page.addInitScript(value => localStorage.setItem('theme', value), saved);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByRole('checkbox', { name: 'Toggle dark mode' })).toBeChecked({ checked: saved === 'dark' });
  });
}

test("submission form remains detectable and usable", async ({ page }) => {
  await page.goto("/submit/");
  const form = page.locator('form[name="roaster-form"]');
  await expect(form).toBeVisible();
  await expect(form).toHaveAttribute("action", "/__forms");
  await expect(page.getByRole("combobox", { name: "Select Roaster State" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeVisible();
  await page.goto("/__forms.html");
  await expect(page.locator('form[name="roaster-form"]')).toHaveAttribute("data-netlify", "true");
});

test("recommendation collects directory fields and posts a Netlify-compatible body", async ({ page }) => {
  let submission: URLSearchParams | undefined;
  await page.route("**/__forms", async route => {
    submission = new URLSearchParams(route.request().postData()!);
    expect(route.request().headers()["content-type"]).toBe("application/x-www-form-urlencoded");
    await route.fulfill({ status: 200, body: "OK" });
  });
  await page.goto("/submit/");
  await page.getByRole("radio", { name: "Recommend a new roaster" }).check();
  await page.getByLabel("Roaster Name", { exact: true }).fill("New Coffee");
  await page.getByLabel("Roaster Website", { exact: true }).fill("https://new.coffee/");
  await page.getByLabel("Does it have a cafe?").selectOption("false");
  await page.getByLabel("Does it sell beans from multiple roasters?").selectOption("false");
  await page.getByLabel("Select Roaster State").selectOption("SA");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page).toHaveURL(/\/success\/?$/);
  expect(submission?.get("form-name")).toBe("roaster-form");
  expect(submission?.get("submission-type")).toBe("recommendation");
  expect(submission?.get("has-cafe")).toBe("false");
  expect(submission?.get("multi-roaster")).toBe("false");
  expect(submission?.has("original-website")).toBe(false);
});

test("correction requires notes and preserves unspecified directory fields", async ({ page }) => {
  await page.route("**/__forms", route => route.fulfill({ status: 200, body: "OK" }));
  await page.goto("/submit/");
  await page.getByRole("radio", { name: "Correct an existing listing" }).check();
  await expect(page.getByLabel("Current listing website")).toBeVisible();
  await expect(page.getByLabel("Details", { exact: true })).toHaveAttribute("required", "");
  await expect(page.getByLabel("Select Roaster State")).not.toHaveAttribute("required");
  await page.getByLabel("Roaster Name", { exact: true }).fill("Existing Coffee");
  await page.getByLabel("Roaster Website", { exact: true }).fill("https://existing.coffee/");
  await page.getByLabel("Details", { exact: true }).fill("The cafe has moved");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page).toHaveURL(/\/success\/?$/);
});

test("submission failures show an error and allow retry", async ({ page }) => {
  await page.route("**/__forms", route => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/submit/");
  await page.getByRole("radio", { name: "Correct an existing listing" }).check();
  await page.getByLabel("Roaster Name", { exact: true }).fill("Existing Coffee");
  await page.getByLabel("Roaster Website", { exact: true }).fill("https://existing.coffee/");
  await page.getByLabel("Details", { exact: true }).fill("Correction details");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("We could not submit your update. Please try again.");
  await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeEnabled();
  for (const theme of ['caramellatte', 'coffee']) {
    await page.getByRole('checkbox', { name: 'Toggle dark mode' }).setChecked(theme === 'coffee');
    // daisyUI animates button colours; scan after the theme transition settles.
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCSS('color', await page.locator('body').evaluate(element => getComputedStyle(element).color));
    const results = await new AxeBuilder({ page }).include('.roaster-form').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map(violation => ({ id: violation.id, nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })), `Submission error in ${theme}`).toEqual([]);
  }
});

test("static detection form mirrors the visible submission fields", async ({ page, request }) => {
  await page.goto("/submit/");
  const fields = await page.locator('form[name="roaster-form"] [name]').evaluateAll(elements => [...new Set(elements.map(element => element.getAttribute("name")))].sort());
  const response = await request.get("/__forms.html");
  const staticFields = [...new Set([...((await response.text()).matchAll(/<(?:input|textarea)\b[^>]*name="([^"]+)"/g))].map(match => match[1]))].sort();
  expect(staticFields).toEqual(fields);
});

test("homepage state shortcuts open the same filter URLs by keyboard", async ({ page }) => {
  await page.goto('/');
  for (const code of ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']) {
    await expect(page.locator('.state-index a').filter({ has: page.getByText(code, { exact: true }) })).toHaveAttribute('href', `/roasters/?state=${code}`);
  }
  const tasmania = page.getByRole('link', { name: /^TAS Tasmania \d+ listings$/ });
  await tasmania.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/roasters\/\?state=TAS$/);
  await expect(page.getByLabel('State or territory')).toHaveValue('TAS');
  expect(await page.locator('.roaster-row:visible').evaluateAll(elements => elements.every(element => element.getAttribute('data-state')?.split(',').map(state => state.trim()).includes('TAS')))).toBe(true);
  const names = await page.locator('.roaster-row:visible .roaster-title').allTextContents();
  await page.goto('/roasters/');
  await page.getByLabel('State or territory').selectOption('TAS');
  await expect(page).toHaveURL(/\/roasters\/\?state=TAS$/);
  expect(await page.locator('.roaster-row:visible .roaster-title').allTextContents()).toEqual(names);
});

test("directory search, filters, bookmarks, and clear state", async ({ page }) => {
  await page.goto('/roasters/');
  const rows = page.locator('#list-of-roasters .roaster-row:visible');
  await page.getByLabel('Find a roaster').fill('Tone Coffee');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Tone Coffee Roasters');
  await page.getByLabel('State or territory').selectOption('VIC');
  await page.getByLabel('With a cafe', { exact: true }).check();
  await page.reload();
  await expect(rows).toHaveCount(1);
  await expect(page.getByLabel('Find a roaster')).toHaveValue('Tone Coffee');
  await expect(page.getByLabel('With a cafe', { exact: true })).toBeChecked();
  await page.getByLabel('State or territory').selectOption('NSW');
  await expect(rows).toHaveCount(0);
  await expect(page.locator('#directory-empty')).toBeVisible();
  await expect(page.locator('#directory-count')).toHaveText('0 listings');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByLabel('Find a roaster')).toBeFocused();
  await expect(rows).not.toHaveCount(0);
  await expect(page.getByLabel('Listing type', { exact: true })).toHaveCount(0);
  await expect(page.locator('.roaster-row[data-multi="true"]')).toHaveCount(0);
  await expect(page.getByLabel('State or territory')).toBeVisible();
  await expect(page).not.toHaveURL(/state=/);
  await expect(rows.first().locator('.roaster-name-link')).toHaveAttribute('rel', 'noopener noreferrer');
});

test('directory pagination shows ranges, last-page controls, and searches beyond the current page', async ({ page }) => {
  await page.goto('/roasters/');
  const rows = page.locator('#list-of-roasters .roaster-row:visible');
  const total = await page.locator('#list-of-roasters .roaster-row').count();
  const lastPage = Math.ceil(total / 12);
  await expect(rows).toHaveCount(12);
  await expect(page.locator('#directory-count')).toHaveText(`1–12 of ${total} listings`);
  await expect(page.locator('#directory-page')).toHaveText(`Page 1 of ${lastPage}`);
  await expect(page.getByRole('link', { name: 'Previous', exact: true })).toHaveCount(0);
  await expect(page.locator('#directory-previous-disabled')).toHaveAttribute('aria-disabled', 'true');
  await page.goto(`/roasters/?page=${lastPage}`);
  await expect(rows).toHaveCount(total - (lastPage - 1) * 12);
  await expect(page.locator('#directory-count')).toHaveText(`${(lastPage - 1) * 12 + 1}–${total} of ${total} listings`);
  await expect(page.getByRole('link', { name: 'Next', exact: true })).toHaveCount(0);
  await expect(page.locator('#directory-next-disabled')).toHaveAttribute('aria-disabled', 'true');
  await page.goto('/roasters/');
  await page.getByLabel('Find a roaster').fill('Tone Coffee');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Tone Coffee Roasters');
  await expect(page.locator('#directory-count')).toHaveText('1 listing');
  await expect(page.locator('#directory-page')).toHaveText('Page 1 of 1');
  await expect(page.getByLabel('Find a roaster')).toBeFocused();
  await page.getByLabel('Find a roaster').fill('no matching coffee business');
  await expect(rows).toHaveCount(0);
  await expect(page.locator('#directory-count')).toHaveText('0 listings');
  await expect(page.locator('#directory-empty')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Pagination' })).toBeHidden();
});

test('directory page links preserve filters and browser navigation restores results', async ({ page }) => {
  await page.goto('/roasters/?state=VIC&cafe=true&type=roaster');
  const rows = page.locator('#list-of-roasters .roaster-row:visible');
  const firstNames = await rows.locator('.roaster-title').allTextContents();
  const next = page.getByRole('link', { name: 'Next', exact: true });
  const href = new URL((await next.getAttribute('href'))!, page.url());
  expect(Object.fromEntries(href.searchParams)).toEqual({ state: 'VIC', cafe: 'true', page: '2' });
  await expect(page).not.toHaveURL(/type=/);
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('#list-of-roasters')).toBeFocused();
  await expect(page.locator('#directory-page')).toContainText('Page 2 of');
  const secondNames = await rows.locator('.roaster-title').allTextContents();
  expect(secondNames).not.toEqual(firstNames);
  await page.reload();
  await expect(page.locator('#directory-page')).toContainText('Page 2 of');
  expect(await rows.locator('.roaster-title').allTextContents()).toEqual(secondNames);
  await page.goBack();
  await expect(page.locator('#directory-page')).toContainText('Page 1 of');
  expect(await rows.locator('.roaster-title').allTextContents()).toEqual(firstNames);
  await page.goForward();
  await expect(page.locator('#directory-page')).toContainText('Page 2 of');
  expect(await rows.locator('.roaster-title').allTextContents()).toEqual(secondNames);
  await page.getByLabel('State or territory').focus();
  await page.getByLabel('State or territory').selectOption('NSW');
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.locator('#directory-page')).toContainText('Page 1 of');
  await expect(page.getByLabel('State or territory')).toBeFocused();
});

test('directory normalizes pages and old seller filter URLs open the dedicated page', async ({ page }) => {
  for (const invalid of ['0', '-2', '1.5', 'nope', 'Infinity', '9007199254740992']) {
    await page.goto(`/roasters/?page=${invalid}`);
    await expect(page.locator('#directory-page')).toContainText('Page 1 of');
    await expect(page).not.toHaveURL(/page=/);
  }
  await page.goto('/roasters/?page=999');
  const total = await page.locator('#list-of-roasters .roaster-row').count();
  const lastPage = Math.ceil(total / 12);
  await expect(page.locator('#directory-page')).toHaveText(`Page ${lastPage} of ${lastPage}`);
  expect(new URL(page.url()).searchParams.get('page')).toBe(String(lastPage));
  await page.getByLabel('With a cafe', { exact: true }).check();
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.locator('#directory-page')).toContainText('Page 1 of');
  await page.goto('/roasters/?q=Tone+Coffee&page=999');
  await expect(page.locator('#directory-count')).toHaveText('1 listing');
  await expect(page).not.toHaveURL(/page=/);
  await page.goto('/roasters/?type=multi&state=VIC&page=99');
  await expect(page).toHaveURL(/\/roasters\/online-subscriptions\/1$/);
  await expect(page.locator('.seller-row')).toHaveCount(8);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Directory', exact: true }).click();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByLabel('Find a roaster')).toBeFocused();
  await expect(page.locator('#list-of-roasters .roaster-row:visible')).toHaveCount(12);
});

test('ratings show half-star graphics and accessible en dashes for missing ratings', async ({ page }) => {
  await page.goto('/roasters/?q=2+Keys+Coffee');
  const row = page.locator('.roaster-row:visible');
  await expect(row).toHaveCount(1);
  await expect(row.getByRole('img', { name: '4.5 out of 5', exact: true })).toBeVisible();
  await expect(row.locator('.roaster-rating')).toHaveText('');
  await expect(row.locator('.rating-star[data-fill="1"]')).toHaveCount(4);
  await expect(row.locator('.rating-star[data-fill="0.5"]')).toHaveCount(1);
  const source = row.getByRole('link', { name: /Mount Hawthorn WA — View 2 Keys Coffee Boutique on Google Maps/ });
  expect(new URL((await source.getAttribute('href'))!).searchParams.get('query_place_id')).toBe('ChIJiyYa1pylMioRKk-alGO0RYc');
  await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
  expect(new URL((await source.getAttribute('href'))!).searchParams.get('query')).toContain('6016');
  await expect(page.locator('.rating-note')).toHaveText('Ratings come from Google Maps. A dash means no rating is available.');
  await page.getByLabel('Find a roaster').fill('Tone Coffee');
  await expect(row.locator('.roaster-rating .not-rated > [aria-hidden="true"]')).toHaveText('–');
  await expect(row.locator('.roaster-rating .sr-only')).toHaveText('Not rated');
  await expect(row.locator('.roaster-rating')).toHaveCSS('min-height', '20px');
  await expect(row.locator('.rating-star')).toHaveCount(0);
});

test('rating sorting ranks the entire filtered directory before pagination and persists in shared URLs', async ({ page }) => {
  await page.goto('/roasters/?state=VIC&cafe=true&page=2');
  const sort = page.getByLabel('Sort listings');
  const rows = page.locator('.roaster-row:visible');
  const expected = await page.locator('.roaster-row').evaluateAll(elements => elements
    .filter(element => element.getAttribute('data-state')?.split(',').map(state => state.trim()).includes('VIC') && element.getAttribute('data-cafe') === 'true')
    .map(element => ({ name: element.getAttribute('data-name')!, score: Number(element.getAttribute('data-rating') || '-1') }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)));
  await sort.selectOption('rating-desc');
  await expect(page).not.toHaveURL(/page=/);
  expect(new URL(page.url()).searchParams.get('sort')).toBe('rating-desc');
  expect(await rows.locator('.roaster-title').allTextContents()).toEqual(expected.slice(0, 12).map(listing => listing.name));
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('sort')).toBe('rating-desc');
  expect(await rows.locator('.roaster-title').allTextContents()).toEqual(expected.slice(12, 24).map(listing => listing.name));
  await page.reload();
  await expect(sort).toHaveValue('rating-desc');
  expect(await rows.locator('.roaster-title').allTextContents()).toEqual(expected.slice(12, 24).map(listing => listing.name));
  await page.goBack();
  expect(await rows.locator('.roaster-title').allTextContents()).toEqual(expected.slice(0, 12).map(listing => listing.name));
  await sort.selectOption('rating-asc');
  const lowest = expected.filter(listing => listing.score > 0).sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  expect(await rows.locator('.roaster-title').allTextContents()).toEqual(lowest.slice(0, 12).map(listing => listing.name));
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(sort).toHaveValue('');
  await expect(page).not.toHaveURL(/sort=/);
  const names = await rows.locator('.roaster-title').allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
});

test('unrated listings stay last in either rating sort direction', async ({ page }) => {
  for (const direction of ['rating-asc', 'rating-desc']) {
    await page.goto(`/roasters/?sort=${direction}&page=999`);
    const rows = page.locator('.roaster-row:visible');
    expect((await rows.evaluateAll(elements => elements.map(element => element.getAttribute('data-rating')))).every(score => score === '')).toBe(true);
    await expect(rows.first().locator('.roaster-rating .not-rated > [aria-hidden="true"]')).toHaveText('–');
    await expect(rows.first().locator('.roaster-rating .star-rating')).toHaveCount(0);
  }
});

test('multiple location ratings name the ranked branch consistently through state redirects', async ({ page }) => {
  await page.goto('/roasters/?q=Allpress');
  const row = page.locator('.roaster-row:visible');
  await expect(row.locator('.roaster-rating').getByRole('img', { name: '4.5 out of 5', exact: true })).toBeVisible();
  const summary = row.locator('.location-disclosure summary');
  await expect(summary.locator('.location-count')).toHaveText('3 locations');
  await expect(summary.locator('.location-preview')).toHaveText('East Brisbane, Collingwood, Zetland');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(row.locator('.location-disclosure')).toHaveAttribute('open', '');
  await expect(row.locator('.roaster-rating')).toBeHidden();
  await expect(row.getByRole('img')).toHaveCount(3);
  await expect(summary.locator('.location-preview')).toBeHidden();
  await expect(row.getByRole('link', { name: /Collingwood VIC — View Allpress on Google Maps/ })).toBeVisible();
  await expect(row.getByRole('link', { name: /Zetland NSW — View Allpress on Google Maps/ })).toBeVisible();
  for (const height of await row.locator('.location-list li').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height))) {
    expect(height).toBeGreaterThanOrEqual(32);
    expect(height).toBeLessThanOrEqual(40);
  }
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(summary.locator('.location-preview')).toBeVisible();
  await expect(row.locator('.roaster-rating')).toBeVisible();
  await expect(row.getByRole('img')).toHaveCount(1);
  await page.keyboard.press('Enter');
  for (const theme of ['caramellatte', 'coffee']) {
    await page.getByRole('checkbox', { name: 'Toggle dark mode' }).setChecked(theme === 'coffee');
    expect((await new AxeBuilder({ page }).include('.roaster-row:not([hidden])').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  }
  await page.goto('/roasters/VIC/false/1');
  await expect(page).toHaveURL(/\/roasters\/\?state=VIC$/);
  const victoria = page.locator('.roaster-row').filter({ has: page.getByRole('heading', { name: 'Allpress (opens in a new tab)', exact: true }) });
  await expect(victoria.locator('.roaster-rating').getByRole('img', { name: '4.5 out of 5', exact: true })).toBeVisible();
  await victoria.locator('summary').click();
  const coll = victoria.getByRole('link', { name: /Collingwood VIC — View Allpress on Google Maps/ });
  expect(new URL((await coll.getAttribute('href'))!).searchParams.get('query_place_id')).toBe('ChIJ97GV_uNC1moRTHYYvdZInGk');
  await expect(victoria.locator('.location-list li')).toHaveCount(3);
});

test('listing links, hierarchy, badges and responsive columns follow the row design', async ({ page }) => {
  await page.goto('/roasters/?q=Allpress');
  const row = page.locator('.roaster-row:visible');
  const website = row.getByRole('link', { name: 'Allpress (opens in a new tab)', exact: true });
  await expect(website).toHaveAttribute('href', 'https://www.allpressespresso.com/');
  await expect(website).toHaveAttribute('target', '_blank');
  await expect(website).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(website).toHaveCSS('text-decoration-line', 'none');
  await website.hover();
  await expect(website).toHaveCSS('text-decoration-line', 'underline');
  await page.mouse.move(0, 0);
  await expect(row.locator('.roaster-domain')).toHaveText('allpressespresso.com');
  await expect(row.locator('.roaster-domain')).not.toHaveAttribute('href');
  await expect(row.locator('.roaster-name-link svg')).toHaveCount(0);
  const badges = row.locator('.roaster-tags .badge');
  await expect(badges).toHaveText(['Coffee roaster', 'Cafe']);
  expect(await badges.evaluateAll(elements => elements.every(element => getComputedStyle(element).fontWeight === '400'))).toBe(true);
  expect(await row.evaluate(element => {
    const title = element.querySelector('h2')!;
    const titleSize = parseFloat(getComputedStyle(title).fontSize);
    return getComputedStyle(title).fontWeight === '700' && [...element.querySelectorAll('.roaster-domain, .badge, .roaster-location')].every(other => parseFloat(getComputedStyle(other).fontSize) < titleSize);
  })).toBe(true);
  await expect(row.getByText('Visit website', { exact: true })).toHaveCount(0);
  await expect(row.getByText('Google Maps', { exact: true })).toHaveCount(0);
  await expect(row.locator('.roaster-location > span')).toHaveCount(0);
  const summary = row.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(row.locator('.location-list li')).toHaveCount(3);
  await expect(row.locator('.cafe-map-link .map-pin')).toHaveCount(3);
  await expect(row.locator('.cafe-map-link .map-pin').first()).toHaveAttribute('aria-hidden', 'true');
  await page.keyboard.press('Tab');
  for (const control of [website, summary, row.locator('.cafe-map-link').first()]) {
    await control.focus();
    await expect(control).toHaveCSS('outline-style', 'solid');
    await expect(control).toHaveCSS('outline-width', '3px');
  }
  await row.locator('.cafe-map-link').first().hover();
  await expect(row.locator('.cafe-map-link').first()).toHaveCSS('text-decoration-line', 'underline');
  const notes = await row.locator('a[target="_blank"]').evaluateAll(elements => elements.every(element =>
    element.getAttribute('rel') === 'noopener noreferrer' && element.querySelector('.sr-only')?.textContent?.includes('(opens in a new tab)')));
  expect(notes).toBe(true);
  for (const fontSize of ['16px', '32px']) {
    await page.evaluate(value => document.documentElement.style.fontSize = value, fontSize);
    for (const width of [320, 375, 390, 414, 639, 640, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(row).toHaveCSS('display', 'grid');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${width}px / ${fontSize}`).toBe(true);
      const geometry = await row.evaluate(element => {
        const identity = element.querySelector('.roaster-identity')!.getBoundingClientRect();
        const name = element.querySelector('.roaster-name')!.getBoundingClientRect();
        const tags = element.querySelector('.roaster-tags')!.getBoundingClientRect();
        const locations = element.querySelector('.roaster-location')!.getBoundingClientRect();
        const rating = element.querySelector('.roaster-rating')!.getBoundingClientRect();
        const branches = [...element.querySelectorAll('.location-list li')].every(branch => {
          const label = branch.querySelector('a')!.getBoundingClientRect();
          const stars = branch.querySelector('.location-rating')!.getBoundingClientRect();
          const starShapes = branch.querySelector('.star-rating')!.getBoundingClientRect();
          const ratingEdge = element.getBoundingClientRect().right - parseFloat(getComputedStyle(element).paddingRight);
          const pin = branch.querySelector('.map-pin')!.getBoundingClientRect();
          const text = branch.querySelector('.location-label')!.getBoundingClientRect();
          return label.right <= stars.left && Math.abs(label.top - stars.top) < 1 && Math.abs(starShapes.right - ratingEdge) < 1 && pin.right <= text.left;
        });
        return { stacked: name.bottom <= tags.top && tags.bottom <= locations.top && getComputedStyle(element.querySelector('.roaster-rating')!).display === 'none',
          aligned: Math.abs(identity.top - tags.top) < 1 && Math.abs(identity.top - locations.top) < 1 && Math.abs(identity.top - rating.top) < 1,
          columns: identity.right <= tags.left && tags.right <= locations.left && Math.abs(locations.right - rating.right) < 1, branches };
      });
      expect(width < 640 ? geometry.stacked : geometry.aligned && geometry.columns).toBe(true);
      expect(geometry.branches).toBe(true);
    }
  }
});

test('directory has compact rows, a bounded grid and an opaque sticky header', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto('/roasters/');
  const table = page.locator('.directory-table');
  const heading = table.locator('.list-heading');
  await expect(heading.locator('span')).toHaveText(['Roaster', 'Type', 'Locations', 'Rating']);
  expect((await table.boundingBox())!.width).toBeLessThanOrEqual(1024);
  await expect(page.locator('.roaster-row:visible').first()).toHaveCSS('padding-top', '16px');
  await expect(page.locator('.roaster-row:visible .roaster-rating').first()).toHaveCSS('width', '100px');
  await heading.evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top + 160));
  await expect(heading).toHaveCSS('position', 'sticky');
  expect(Math.abs((await heading.boundingBox())!.y)).toBeLessThan(1);
  expect(await heading.evaluate(element => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = getComputedStyle(element).backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    return ctx.getImageData(0, 0, 1, 1).data[3];
  })).toBe(255);
  await page.goto('/roasters/?q=2+Keys+Coffee');
  expect((await page.locator('.roaster-row:visible').boundingBox())!.height).toBeLessThan(100);
});

for (const theme of ['caramellatte', 'coffee']) {
  test(`row secondary text and star shapes have sufficient contrast in ${theme}`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    await page.goto('/roasters/?q=Allpress');
    const row = page.locator('.roaster-row:visible');
    await row.locator('summary').click();
    for (const hover of [false, true]) {
      if (hover) await row.hover(); else await page.mouse.move(0, 0);
      for (const selector of ['.roaster-name-link', '.roaster-domain', '.badge', '.cafe-map-link']) {
        expect(await renderedContrast(row.locator(selector).first()), `${theme} ${selector}, hover=${hover}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const selector of ['.rating-star-filled', '.rating-star-empty']) {
        expect(await renderedContrast(row.locator(`.location-list ${selector}`).first()), `${theme} ${selector}, hover=${hover}`).toBeGreaterThanOrEqual(3);
      }
    }
    await row.locator('summary').click();
    expect(await renderedContrast(row.locator('.location-preview'))).toBeGreaterThanOrEqual(4.5);
    await page.getByLabel('Find a roaster').fill('Tone Coffee');
    expect(await renderedContrast(page.locator('.roaster-row:visible .not-rated'))).toBeGreaterThanOrEqual(4.5);
  });
}

for (const theme of ['caramellatte', 'coffee']) {
  test(`homepage state links fit narrow screens and enlarged text in ${theme}`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    await page.goto('/');
    await expect(page.locator('.brand')).toHaveAccessibleName('BeanFinder Australian coffee directory');
    await expect(page.getByRole('link', { name: 'NT Northern Territory 1 listing', exact: true })).toBeVisible();
    const names = new AxeBuilder({ page }).withRules(['label-content-name-mismatch']);
    expect((await names.analyze()).violations).toEqual([]);
    for (const fontSize of ['16px', '32px']) {
      await page.evaluate(size => document.documentElement.style.fontSize = size, fontSize);
      for (const width of [320, 375, 390, 414]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${theme}, ${width}px, ${fontSize}`).toBe(true);
        const links = page.locator('.state-index a');
        await expect(links).toHaveCount(8);
        const layout = await links.evaluateAll(elements => elements.map(element => {
          const bounds = element.getBoundingClientRect();
          return [...element.children].every(child => {
            const rect = child.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1;
          });
        }));
        expect(layout.every(Boolean), `State text must stay inside its link at ${width}px, ${fontSize}`).toBe(true);
        await expect(links.first().locator('.state-code')).toHaveCSS('grid-column-start', '1');
        await expect(links.first().locator('span').last()).toHaveCSS('grid-column-start', '2');
      }
    }
  });
  test(`directory controls and pagination fit enlarged text in ${theme}`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    await page.goto('/roasters/');
    await page.evaluate(() => document.documentElement.style.fontSize = '32px');
    for (const width of [320, 375, 390, 414]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `Directory at ${width}px, 200% text`).toBe(true);
      const controls = page.locator('.directory-tools input, .directory-tools select, .directory-tools button, .pagination a:not([hidden])');
      const layout = await controls.evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.left >= 0 && rect.right <= document.documentElement.clientWidth;
      }));
      expect(layout.every(Boolean)).toBe(true);
    }
    await page.getByRole('link', { name: 'Next', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#list-of-roasters')).toBeFocused();
    await expect(page.locator('#directory-page')).toContainText('Page 2 of');
  });
}

test("multi-roaster stores show the supplied subscription, selection and brew details", async ({ page }) => {
  await page.goto('/roasters/online-subscriptions/1');
  const expected = [
    { name: 'Acuratore', domain: 'au.acuratore.com', subscription: true, selection: ['Surprise me'], brew: ['Filter', 'Espresso', 'Decaf'] },
    { name: 'Allways Coffee', domain: 'allways.coffee', subscription: true, selection: ['Surprise me'], brew: ['Espresso', 'Decaf'] },
    { name: 'Altdrop', domain: 'altdrop.com.au', subscription: true, selection: ['Surprise me', 'Choose your own'], brew: ['Filter', 'Espresso', 'Decaf'] },
    { name: 'BeanHub', domain: 'beanhub.com.au', subscription: false, selection: ['Choose your own'], brew: ['Filter', 'Espresso', 'Decaf'] },
    { name: 'Beanz', domain: 'beanz.com', subscription: false, selection: ['Choose your own'], brew: ['Espresso', 'Decaf'] },
    { name: 'Direct Coffee', domain: 'directcoffee.com.au', subscription: false, selection: ['Choose your own'], brew: ['Filter', 'Espresso', 'Decaf'] },
    { name: 'Play-Ground', domain: 'play-ground.com.au', subscription: true, selection: ['Surprise me'], brew: ['Filter', 'Espresso'] },
    { name: 'Three Thousand Thieves', domain: 'threethousandthieves.com', subscription: true, selection: ['Surprise me'], brew: ['Filter', 'Espresso', 'Decaf'] },
  ];
  const rows = page.locator('.seller-row');
  await expect(rows).toHaveCount(8);
  await expect(page.locator('.subscription-badge')).toHaveCount(5);
  await expect(page.locator('.store-only')).toHaveCount(3);
  expect(await page.locator('.brew-badge').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeLessThan(
    await page.locator('.selection-badge').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))
  );
  for (const store of expected) {
    const row = rows.filter({ has: page.getByRole('link', { name: `${store.name} (opens in a new tab)`, exact: true }) });
    await expect(row).toHaveCount(1);
    await expect(row.locator('.roaster-domain')).toHaveText(store.domain);
    expect(new URL((await row.locator('.roaster-name-link').getAttribute('href'))!).hostname.replace(/^www\./, '')).toBe(store.domain);
    await expect(row.getByRole('group', { name: 'Subscription', exact: true }).locator('.badge')).toHaveText([store.subscription ? 'Subscription' : 'Store Only']);
    await expect(row.getByRole('group', { name: 'Selection', exact: true }).locator('.badge-outline')).toHaveText(store.selection);
    await expect(row.getByRole('group', { name: 'Brew', exact: true }).locator('.badge-sm')).toHaveText(store.brew);
  }
  await expect(page.locator('.roaster-tags, .roaster-location, .roaster-rating, .rating-heading')).toHaveCount(0);
  await expect(page.getByText('Multi-roaster seller', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Online', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Browse by state', { exact: true })).toHaveCount(0);
  const navigation = page.getByRole('navigation', { name: 'Directory navigation' });
  await expect(navigation.getByRole('link', { name: 'Multi-roaster sellers', exact: true })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'All roasters', exact: true })).toHaveAttribute('href', '/roasters/');
  await expect(page.locator('.list-heading > span')).toHaveText(['Store', 'Subscription', 'Selection', 'Brew']);
  const first = rows.first();
  await expect(first.locator('.roaster-name-link')).toHaveAttribute('target', '_blank');
  await expect(first.locator('.roaster-name-link')).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(first.locator('.roaster-domain')).not.toHaveAttribute('href');
  await expect(first.locator('svg')).toHaveCount(0);
  await first.locator('.roaster-name-link').hover();
  await expect(first.locator('.roaster-name-link')).toHaveCSS('text-decoration-line', 'underline');
  await page.keyboard.press('Tab');
  await first.locator('.roaster-name-link').focus();
  await expect(first.locator('.roaster-name-link')).toHaveCSS('outline-width', '3px');
  for (const fontSize of ['16px', '32px']) {
    await page.evaluate(value => document.documentElement.style.fontSize = value, fontSize);
    for (const width of [320, 639, 640, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const aligned = await first.evaluate((row, stacked) => {
        const cells = [...row.children].map(cell => cell.getBoundingClientRect());
        return cells.every((cell, index) => index === 0 || (stacked
          ? cells[index - 1].bottom <= cell.top
          : cells[index - 1].right <= cell.left && Math.abs(cell.top - cells[0].top) < 1));
      }, width < 640);
      expect(aligned).toBe(true);
      expect(await rows.evaluateAll(elements => elements.every(row => [...row.querySelectorAll('.seller-cell')].every(cell => cell.scrollWidth <= cell.clientWidth)))).toBe(true);
      if (width < 640) await expect(first.locator('.seller-cell-label').first()).toBeVisible();
    }
  }
  await page.goto('/roasters/?type=multi&state=VIC');
  await expect(page).toHaveURL(/\/roasters\/online-subscriptions\/1$/);
  await expect(page.locator('.seller-row')).toHaveCount(8);
  await expect(page.locator('.seller-row').filter({ hasText: 'Acuratore' })).toHaveCount(1);
  await page.goto('/roasters/VIC/false/1');
  await expect(page.getByRole('heading', { name: 'Acuratore (opens in a new tab)', exact: true })).toHaveCount(0);
});

for (const theme of ['caramellatte', 'coffee']) {
  test(`clear filters remains visible and keyboard accessible in ${theme}`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    await page.goto('/roasters/?state=TAS&q=coffee');
    const clear = page.getByRole('button', { name: 'Clear filters' });
    expect(await renderedContrast(clear)).toBeGreaterThanOrEqual(4.5);
    await clear.hover();
    expect(await renderedContrast(clear)).toBeGreaterThanOrEqual(4.5);
    await expect(clear).toHaveCSS('text-decoration-thickness', '2px');
    await clear.focus();
    await expect(clear).toHaveCSS('outline-style', 'solid');
    await expect(clear).toHaveCSS('outline-width', '3px');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Find a roaster')).toBeFocused();
    await expect(page.getByLabel('Find a roaster')).toHaveValue('');
    await expect(page.getByLabel('State or territory')).toHaveValue('');
    await expect(page).not.toHaveURL(/state=|q=/);
  });
}

for (const theme of ['caramellatte', 'coffee']) {
  test(`multi-roaster badge styles maintain readable contrast in ${theme}`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    await page.goto('/roasters/');
    const directoryBackground = await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor);
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Multi-roaster', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor)).toBe(directoryBackground);
    expect(await page.locator('.subscription-badge').first().evaluate((element, theme) => {
      const sample = document.createElement('span');
      sample.style.backgroundColor = theme === 'coffee' ? 'var(--color-primary)' : 'var(--color-secondary)';
      document.body.append(sample);
      const expected = getComputedStyle(sample).backgroundColor;
      sample.remove();
      return getComputedStyle(element).backgroundColor === expected;
    }, theme)).toBe(true);
    for (const hover of [false, true]) {
      if (hover) await page.locator('.seller-row').first().hover(); else await page.mouse.move(0, 0);
      for (const selector of ['.roaster-name-link', '.roaster-domain', '.subscription-badge', '.store-only', '.selection-badge', '.brew-badge']) {
        expect(await renderedContrast(page.locator(`.seller-row ${selector}`).first()), `${theme} ${selector}, hover=${hover}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
}

test("known locations link to Google Maps without postcodes and unspecified locations show Online", async ({ page }) => {
  await page.goto('/roasters/');
  await page.getByLabel('Find a roaster').fill('Mount Hawthorn');
  const listing = page.locator('.roaster-row:visible').filter({ hasText: '2 Keys Coffee Boutique' });
  await expect(listing).toHaveCount(1);
  const link = listing.getByRole('link', { name: /View 2 Keys Coffee Boutique on Google Maps/ });
  await expect(link).toContainText('Mount Hawthorn WA');
  await expect(link).not.toContainText('6016');
  await expect(link.locator('.map-pin')).toBeVisible();
  const url = new URL((await link.getAttribute('href'))!);
  expect(url.searchParams.get('query_place_id')).toBe('ChIJiyYa1pylMioRKk-alGO0RYc');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await page.getByLabel('Find a roaster').fill('Tone Coffee');
  const unspecified = page.locator('.roaster-row:visible');
  await expect(unspecified.locator('.roaster-location')).toHaveText('Online');
  await expect(unspecified.locator('.online-globe')).toBeVisible();
  await expect(unspecified.locator('.online-globe')).toHaveAttribute('aria-hidden', 'true');
  await expect(unspecified.locator('.roaster-location a, .roaster-location .badge')).toHaveCount(0);
});

test("theme follows the system and works when storage is blocked", async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } }); });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'coffee');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'caramellatte');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'coffee');
  const toggle = page.getByRole('checkbox', { name: 'Toggle dark mode' });
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'caramellatte');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'caramellatte');
});

test("skip link and responsive layout support keyboard and zoom", async ({ page }) => {
  await page.goto('/roasters/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByLabel('Find a roaster')).toBeVisible();
});

for (const theme of ['caramellatte', 'coffee']) {
for (const path of ['/', '/roasters/', '/roasters/?state=VIC', '/roasters/online-subscriptions/1', '/submit/', '/success/', '/404']) {
    test(`${path} (${theme}) passes automated WCAG checks`, async ({ page }) => {
      await page.addInitScript(value => localStorage.setItem('theme', value), theme);
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(results.violations.map(violation => ({ id: violation.id, nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })), `${path} (${theme})`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} has horizontal overflow`).toBe(true);
    });
  }
}
