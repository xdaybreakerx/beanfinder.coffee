import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
});

test("home navigation and migrated button styles", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="generator"]')).toHaveAttribute("content", /^Astro v7\./);
  await expect(page.getByRole("heading", { name: "Welcome to BeanFinder" })).toBeVisible();
  const state = page.getByRole("link", { name: "VIC", exact: true });
  await expect(state).toHaveCSS("align-items", "center");
  await expect(state).toHaveCSS("border-top-style", "solid");
  await state.click();
  await expect(page.getByRole("heading", { name: "All Roasters in VIC" })).toBeVisible();
  await expect(page.locator("#list-of-roasters .card")).toHaveCount(12);
});

test("pagination and cafe filtering", async ({ page }) => {
  await page.goto("/roasters/VIC/false/1");
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/\/roasters\/VIC\/false\/2\/?$/);
  await expect(page.locator("#list-of-roasters .card")).toHaveCount(12);
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
  await expect(page.getByRole("combobox")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeVisible();
  await page.goto("/__forms.html");
  await expect(page.locator('form[name="roaster-form"]')).toHaveAttribute("data-netlify", "true");
});

test("filter drawer opens and closes on mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile drawer behavior");
  await page.goto("/roasters/VIC/false/1");
  await page.locator('label[for="my-drawer-3"]').first().click();
  await expect(page.locator("#my-drawer-3")).toBeChecked();
  await expect(page.locator(".drawer-side")).toBeVisible();
  await page.locator('label[aria-label="close sidebar"]').click({ position: { x: 350, y: 100 } });
  await expect(page.locator("#my-drawer-3")).not.toBeChecked();
});
