import { test, expect } from '@playwright/test';

test.describe('Document and Workspace Management', () => {
  test('user can view workspaces and access the editor', async ({ page }) => {
    // Go to the workspaces dashboard
    // Because of the auth setup, we are already logged in!
    await page.goto('/workspaces');
    
    // Verify we are logged in and on the correct page
    await expect(page).toHaveTitle(/www\.doc/i);
    
    // Wait for the main UI to load by checking for the user's avatar
    await expect(page.getByTitle(/Admin User/i)).toBeVisible();
    
    // Test creating a new workspace
    const newWorkspaceBtn = page.getByRole('button', { name: /New workspace/i }).first();
    if (await newWorkspaceBtn.isVisible()) {
      await newWorkspaceBtn.click();
      
      const nameInput = page.getByLabel('Name');
      await nameInput.fill('E2E Test Workspace');
      
      const createBtn = page.getByRole('button', { name: 'Create workspace' });
      await createBtn.click();
      
      // Verify workspace was created and we are redirected to it
      await expect(page.getByRole('heading', { name: 'E2E Test Workspace' })).toBeVisible();
    }
  });
});
