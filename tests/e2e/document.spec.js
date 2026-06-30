import { test, expect } from '@playwright/test';

test.describe('Document and Workspace Management', () => {
  test('user can view workspaces, create a document, type, and export', async ({ page }) => {
    // Navigate to workspaces
    await page.goto('/workspaces');
    await expect(page).toHaveTitle(/www\.doc/i);
    await expect(page.getByTitle(/Admin User/i)).toBeVisible();
    
    // Check if E2E Test Workspace exists. If so, click it. Otherwise, create it.
    const existingWorkspace = page.getByText('E2E Test Workspace').first();
    if (await existingWorkspace.isVisible()) {
      await existingWorkspace.click();
    } else {
      const newWorkspaceBtn = page.getByRole('button', { name: /New workspace/i }).first();
      await newWorkspaceBtn.click();
      
      const nameInput = page.locator('#workspace-name');
      await expect(nameInput).toBeVisible();
      await nameInput.fill('E2E Test Workspace');
      
      const createBtn = page.getByRole('button', { name: 'Create workspace' });
      await createBtn.click();
    }
    
    // Verify we are inside the workspace
    await expect(page.getByRole('heading', { name: 'E2E Test Workspace' })).toBeVisible();

    // Create a new document in this workspace
    // The "New page" button or the "+" icon next to "Pages"
    const addSubpageBtn = page.getByTitle('Add subpage').first();
    const newPageBtn = page.getByRole('button', { name: /New page/i }).first();
    
    if (await addSubpageBtn.isVisible()) {
        await addSubpageBtn.click();
    } else {
        await newPageBtn.click();
    }

    // Title input has placeholder "e.g. VPN setup"
    const titleInput = page.getByPlaceholder('e.g. VPN setup');
    await expect(titleInput).toBeVisible();
    
    // Give it a unique name with timestamp to avoid duplicates
    const docTitle = `My E2E Document ${Date.now()}`;
    await titleInput.fill(docTitle);
    await page.getByRole('button', { name: 'Create page' }).click();

    // Now inside the document view
    await expect(page.getByText(docTitle)).toBeVisible();

    // Type inside the editor
    const editor = page.locator('.tiptap.ProseMirror');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type('This is some E2E test content.');

    // Wait a brief moment to ensure state is registered
    await page.waitForTimeout(500);

    // Click "Save"
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // Wait for the save request to complete
    await page.waitForLoadState('networkidle');
    
    // Test export functionality
    const exportBtn = page.getByRole('button', { name: /Export/i });
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      
      // Select PDF and click Export in the modal
      await page.getByText('PDF').click();
      await page.getByRole('dialog').getByRole('button', { name: 'Export' }).click();
      
      // Wait for it to become ready for download
      const downloadBtn = page.getByRole('button', { name: 'Download file' });
      // The generation can take some time
      await expect(downloadBtn).toBeVisible({ timeout: 15000 });
      
      // Download the file
      const downloadPromise = page.waitForEvent('download');
      await downloadBtn.click();
      const download = await downloadPromise;
      
      // Assert the filename is correct
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    }
  });
});
