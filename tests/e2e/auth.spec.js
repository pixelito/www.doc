import { test, expect } from '@playwright/test';

test('login page renders correctly', async ({ page }) => {
  await page.goto('/login');
  
  // Expect the title to contain something about Login or the app name
  await expect(page).toHaveTitle(/www\.doc/i);
  
  // Expect a login form to be visible
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible();
  
  const passwordInput = page.locator('input[type="password"]');
  await expect(passwordInput).toBeVisible();
  
  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeVisible();
});
