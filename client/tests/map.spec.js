import { test, expect } from '@playwright/test';

test.describe('Map view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Dismiss welcome modal if present
    const welcomeClose = page.getByRole('button', { name: /get started|close/i });
    if (await welcomeClose.isVisible({ timeout: 3000 }).catch(() => false)) {
      await welcomeClose.click();
    }
  });

  test('loads the map container', async ({ page }) => {
    const map = page.locator('.leaflet-container');
    await expect(map).toBeVisible({ timeout: 10000 });
  });

  test('navbar shows PathGuard brand', async ({ page }) => {
    await expect(page.locator('.brand')).toContainText('PathGuard');
  });

  test('Report incident button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /report incident/i })).toBeVisible();
  });

  test('clicking Report opens the module picker', async ({ page }) => {
    await page.getByRole('button', { name: /report incident/i }).click();
    await expect(page.getByRole('heading', { name: /choose a reporting module/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test('sidebar filter panel is present', async ({ page }) => {
    await expect(page.locator('.sidebar')).toBeVisible();
  });
});
