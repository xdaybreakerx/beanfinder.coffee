import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
});

test("home navigation and state browsing", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="generator"]')).toHaveAttribute("content", /^Astro v7\./);
  await expect(page.getByRole("heading", { name: "Find your next favourite roast." })).toBeVisible();
  const state = page.getByRole("link", { name: "VIC — Victoria", exact: true });
  await expect(state).toHaveCSS("align-items", "center");
  await expect(state).toHaveCSS("border-bottom-style", "solid");
  await state.click();
  await expect(page.getByRole("heading", { name: "All Roasters in VIC" })).toBeVisible();
  await expect(page.locator("#list-of-roasters .roaster-row")).toHaveCount(12);
});

test("pagination and cafe filtering", async ({ page }) => {
  await page.goto("/roasters/VIC/false/1");
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/\/roasters\/VIC\/false\/2\/?$/);
  await expect(page.locator("#list-of-roasters .roaster-row")).toHaveCount(12);
  await page.getByRole("link", { name: "Show Roasters with a Cafe", exact: true }).click();
  await expect(page).toHaveURL(/\/roasters\/VIC\/true\/1\/?$/);
  await expect(page.getByRole("heading", { name: "Roasters in VIC with a Cafe" })).toBeVisible();
});

test("theme toggle persists across reloads", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("checkbox", { name: "Toggle dark mode" });
  await page.locator('label[for="theme-controller"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(toggle).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator('label[for="theme-controller"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

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
});

test("static detection form mirrors the visible submission fields", async ({ page, request }) => {
  await page.goto("/submit/");
  const fields = await page.locator('form[name="roaster-form"] [name]').evaluateAll(elements => [...new Set(elements.map(element => element.getAttribute("name")))].sort());
  const response = await request.get("/__forms.html");
  const staticFields = [...new Set([...((await response.text()).matchAll(/<(?:input|textarea)\b[^>]*name="([^"]+)"/g))].map(match => match[1]))].sort();
  expect(staticFields).toEqual(fields);
});

test("state navigation opens by keyboard and closes with Escape", async ({ page }) => {
  await page.goto("/roasters/VIC/false/1");
  const summary = page.locator('.state-menu summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.state-menu')).toHaveAttribute('open', '');
  await expect(page.getByRole('link', { name: 'Tasmania TAS' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.state-menu')).not.toHaveAttribute('open');
  await expect(summary).toBeFocused();
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
  await page.getByLabel('Listing type', { exact: true }).selectOption('multi');
  await expect(rows.filter({ hasText: 'BeanHub' })).toHaveCount(1);
  await expect(rows.filter({ hasText: 'Tone Coffee Roasters' })).toHaveCount(0);
  await expect(rows.first().getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
});

test("theme follows the system and works when storage is blocked", async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } }); });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const toggle = page.getByRole('checkbox', { name: 'Toggle dark mode' });
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
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

test("light and dark core pages pass automated WCAG checks", async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    for (const path of ['/', '/roasters/', '/roasters/VIC/false/1', '/roasters/online-subscriptions/1', '/submit/', '/success/', '/404']) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(results.violations.map(violation => ({ id: violation.id, nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })), `${path} (${theme})`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} has horizontal overflow`).toBe(true);
    }
  }
});
