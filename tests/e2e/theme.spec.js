import { test, expect } from '@playwright/test';

// Theme preference is per-browser (localStorage), so each test starts from the
// auth storage state only — i.e. no stored preference, which means "system".
// The only control is the "Appearance" card on Settings › Profile.
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

  test('picking Dark in settings applies the dark tokens and persists across reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/settings/profile');

    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // The token layer actually flipped (not just the attribute).
    const canvas = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim().toUpperCase()
    );
    expect(canvas).toBe('#171B17');

    // Persists on other pages: the pre-paint boot script re-stamps it.
    await page.goto('/workspaces');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // An explicit choice wins over the OS scheme.
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('System option returns to following the OS', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/settings/profile');

    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.getByRole('button', { name: 'System', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
