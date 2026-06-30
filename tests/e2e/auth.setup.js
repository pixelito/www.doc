import { test as setup, expect } from '@playwright/test';
const authFile = 'playwright/.auth/admin.json';

setup('complete setup wizard and authenticate', async ({ page }) => {
  // A fresh database redirects everything to /setup
  await page.goto('/login');
  
  // Wait for network to settle so we know where we landed
  await page.waitForLoadState('networkidle');
  
  if (page.url().includes('login')) {
      // Already setup, just login
      await page.getByLabel('Email').fill('admin@example.com');
      await page.getByLabel('Password').fill('password123');
      await page.getByRole('button', { name: /Sign in/i }).click();
  } else {
      // Step 1: Welcome
      await expect(page).toHaveURL(/.*setup/);
      await page.getByRole('button', { name: /Get started/i }).click();
      
      // Step 2: Administrator account creation
      await expect(page.getByText('Create your administrator account')).toBeVisible();
      await page.getByLabel('Name').fill('Admin User');
      await page.getByLabel('Email').fill('admin@example.com');
      
      // Need to use exact matches for password fields
      await page.getByLabel('Password', { exact: true }).fill('password123');
      await page.getByLabel('Confirm password').fill('password123');
      await page.getByRole('button', { name: /Continue/i }).click();
      
      // Step 3: Instance name
      await expect(page.getByLabel('Instance name')).toBeVisible();
      // It defaults to 'www.doc', just click Continue
      await page.getByRole('button', { name: /Continue/i }).click();
      
      // Step 4: Email / SMTP (Skip for now)
      await expect(page.getByText('Email (SMTP) settings')).toBeVisible();
      await page.getByRole('button', { name: /Skip for now/i }).click();
      
      // Step 5: Finish
      await expect(page.getByText('All set')).toBeVisible();
      await page.getByRole('button', { name: /Finish setup/i }).click();
  }
  
  // After finishing or logging in, it redirects to the workspaces index
  await expect(page).toHaveURL(/.*workspaces/);
  await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible();

  // Save the authenticated state
  await page.context().storageState({ path: authFile });
});
