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

test("filter drawer opens and closes on mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile drawer behavior");
  await page.goto("/roasters/VIC/false/1");
  await page.locator('label[for="my-drawer-3"]').first().click();
  await expect(page.locator("#my-drawer-3")).toBeChecked();
  await expect(page.locator(".drawer-side")).toBeVisible();
  await page.locator('label[aria-label="close sidebar"]').click({ position: { x: 350, y: 100 } });
  await expect(page.locator("#my-drawer-3")).not.toBeChecked();
});
