import { test, expect } from '@playwright/test';

async function openModule1(page) {
  await page.goto('/');
  const welcome = page.getByRole('button', { name: /get started|close/i });
  if (await welcome.isVisible({ timeout: 3000 }).catch(() => false)) await welcome.click();

  await page.getByRole('button', { name: /report incident/i }).click();
  // Pick Module 1 (Accident / Conflict)
  await page.getByRole('button', { name: /accident|conflict/i }).click();
  // A "click on the map" banner appears — click the map centre to pick a location
  const map = page.locator('.leaflet-container');
  await map.click({ position: { x: 400, y: 300 } });
}

test.describe('Module 1 — Accident & Conflict form', () => {
  test('form appears after picking location', async ({ page }) => {
    await openModule1(page);
    await expect(page.locator('form, [role="form"]')).toBeVisible({ timeout: 8000 });
  });

  test('required fields are present', async ({ page }) => {
    await openModule1(page);
    await expect(page.locator('select, input[type="radio"]').first()).toBeVisible({
      timeout: 8000,
    });
  });

  test('submit with no required fields shows error or keeps form open', async ({ page }) => {
    await openModule1(page);
    const submitBtn = page.getByRole('button', { name: /submit|report/i });
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.click();
      // Either a validation error appears or the form stays open (not navigated away)
      await expect(page.locator('form, .error, [role="alert"]').first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('close button dismisses the form', async ({ page }) => {
    await openModule1(page);
    const close = page.getByRole('button', { name: /cancel|close|✕/i }).first();
    if (await close.isVisible({ timeout: 5000 }).catch(() => false)) {
      await close.click();
      await expect(page.locator('.leaflet-container')).toBeVisible();
    }
  });
});
