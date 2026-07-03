import { test, expect } from '@playwright/test';

// Theme preference is per-browser (localStorage), so each test starts from the
// auth storage state only — i.e. no stored preference, which means "system".
// No workspace/content is created by this spec.
test.describe('Theme', () => {
  test('defaults to system and follows OS scheme changes live', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/workspaces');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // With the preference on "system", an OS scheme flip re-themes without a reload.
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('picking Dark applies the dark tokens and persists across reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/workspaces');

    await page.getByRole('button', { name: 'Theme' }).click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // The token layer actually flipped (not just the attribute).
    const canvas = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim().toUpperCase()
    );
    expect(canvas).toBe('#171B17');

    // Persists: the pre-paint boot script re-stamps it on a fresh load.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // An explicit choice wins over the OS scheme.
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('profile settings control switches theme and System returns to the OS', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/settings/profile');

    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.getByRole('button', { name: 'System', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
