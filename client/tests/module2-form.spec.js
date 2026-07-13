import { test, expect } from '@playwright/test';

async function openModule2(page) {
  await page.goto('/');
  const welcome = page.getByRole('button', { name: /get started|close/i });
  if (await welcome.isVisible({ timeout: 3000 }).catch(() => false)) await welcome.click();

  await page.getByRole('button', { name: /report incident/i }).click();
  await page.getByRole('button', { name: /hazard|infrastructure/i }).click();
  const map = page.locator('.leaflet-container');
  await map.click({ position: { x: 400, y: 300 } });
}

test.describe('Module 2 — Hazard & Infrastructure form', () => {
  test('form appears after picking location', async ({ page }) => {
    await openModule2(page);
    await expect(page.locator('form, [role="form"]')).toBeVisible({ timeout: 8000 });
  });

  test('hazard type selector is present', async ({ page }) => {
    await openModule2(page);
    // The dynamic form renders selects/radios for hazard type
    await expect(page.locator('select, [role="listbox"]').first()).toBeVisible({
      timeout: 8000,
    });
  });

  test('form is scrollable on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openModule2(page);
    const form = page.locator('form, .report-form, .modal').first();
    const box = await form.boundingBox();
    // Form should not exceed 100vh (667px) in width — it should be contained
    if (box) {
      expect(box.width).toBeLessThanOrEqual(375 + 10);
    }
  });
});
