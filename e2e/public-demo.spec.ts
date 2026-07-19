import { expect, test } from "@playwright/test";

test("public demo catalogue loads without runtime errors", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) runtimeErrors.push(`${response.status()} ${response.url()}`);
  });

  const response = await page.goto("/demo", { waitUntil: "networkidle" });

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("img", { name: "Antalya Kebab" })).toBeVisible();
  await expect(page.getByText("Kebab", { exact: true }).first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  expect(runtimeErrors).toEqual([]);
});

test("Arabic changes document direction and preserves the catalogue", async ({
  page,
}) => {
  const response = await page.goto("/demo?lang=ar", {
    waitUntil: "networkidle",
  });

  expect(response?.ok()).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("img", { name: "Antalya Kebab" })).toBeVisible();
});

test("a customer can configure a kebab and add it to the order", async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.goto("/demo?lang=en", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Kebab/ }).first().click();

  await expect(page.getByRole("heading", { name: "Toppings" })).toBeVisible();
  await page.getByRole("button", { name: "Full", exact: true }).click();

  const progress = page.getByTestId("customizer-progress");
  await expect(progress).toHaveAttribute("data-current", "2");
  await expect(progress).toHaveAttribute("data-total", "5");

  for (let step = 2; step < 5; step += 1) {
    const nextButton = page.locator('[data-testid="customizer-next"]:visible');
    await expect(nextButton).toBeEnabled();
    await nextButton.click();
    await expect(progress).toHaveAttribute("data-current", String(step + 1));
  }

  const addButton = page.locator('[data-testid="customizer-add"]:visible');
  await expect(addButton).toBeVisible();
  await addButton.click();
  const cartButton = page.getByRole("button", { name: /View cart/ });
  await expect(cartButton).toBeVisible();
  await cartButton.click();
  await page.getByRole("button", { name: /^Order -/ }).click();

  await expect(page).toHaveURL(/\/order$/);
  await page.getByPlaceholder("Your name").fill("Browser Test");
  await page.getByPlaceholder("Phone number").fill("0612345678");
  await page.getByRole("button", { name: /^Confirm -/ }).click();

  await expect(page).toHaveURL(/\/suivi\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/Order|Commande/).first()).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("the demo dashboard loads operational and menu views", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) runtimeErrors.push(`${response.status()} ${response.url()}`);
  });

  await page.addInitScript(() => {
    localStorage.setItem("cm_onboarding_done_antalya-kebab-moneteau", "true");
  });
  const response = await page.goto("/admin/demo?lang=en", { waitUntil: "networkidle" });
  expect(response?.ok()).toBe(true);
  await expect(page.getByText("DEMO MODE").first()).toBeVisible();
  await expect(page.getByText(/Antalya Kebab/).first()).toBeVisible();

  await page.getByRole("button", { name: "Manage", exact: true }).click();
  const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
  const menuButton = isMobile
    ? page.getByText("My Menu", { exact: true }).first()
    : page.getByRole("button", { name: "Menu", exact: true }).first();
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByText("SANDWICHS", { exact: true })).toBeVisible();
  await expect(page.getByText("Kebab", { exact: true }).first()).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
