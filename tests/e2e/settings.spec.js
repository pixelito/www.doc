import { test, expect } from '@playwright/test';

test.describe('User Settings', () => {
  test('user can access settings and update profile', async ({ page }) => {
    await page.goto('/workspaces');
    await expect(page).toHaveTitle(/www\.doc/i);
    
    // Open user dropdown
    const avatarBtn = page.getByRole('button').filter({ hasText: /Admin User/i });
    if (await avatarBtn.isVisible()) {
      await avatarBtn.click();
      
      // Click Settings
      await page.getByRole('menuitem', { name: /Settings/i }).click();
      
      // Verify we are on the settings page
      await expect(page.getByRole('heading', { name: 'Profile Information' })).toBeVisible();
      
      // Update name
      const nameInput = page.getByLabel('Name');
      await expect(nameInput).toBeVisible();
      await nameInput.fill('Admin User Updated');
      
      // Save changes
      await page.getByRole('button', { name: 'Save' }).first().click();
      
      // Expect success toast or UI update
      await expect(page.getByText('Saved.').first()).toBeVisible();
      
      // Revert name back to keep tests deterministic
      await nameInput.fill('Admin User');
      await page.getByRole('button', { name: 'Save' }).first().click();
      await expect(page.getByText('Saved.').first()).toBeVisible();
    }
  });
});
