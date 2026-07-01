import { test, expect } from '@playwright/test';

/**
 * Import Backups: back up now → download the archive → import that file back in.
 * The imported archive should register as a restorable "Imported" row.
 */
test('an admin can back up, download, and re-import the archive', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/admin/backups');
    await expect(page.getByRole('heading', { name: 'Backups' })).toBeVisible();

    // Kick off a backup and wait for the blocking progress modal to clear.
    await page.getByRole('button', { name: 'Back up now' }).click();
    await expect(page.getByText(/Backing up|Backup queued/)).toBeVisible();
    await expect(page.getByText(/Backing up|Backup queued/)).toBeHidden({ timeout: 60_000 });

    // Download the newest archive.
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTitle('Download').first().click(),
    ]);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    // Import it back through the modal.
    await page.getByRole('button', { name: 'Import' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Import a backup')).toBeVisible();
    await dialog.locator('#import-file').setInputFiles(filePath);
    await dialog.getByRole('button', { name: 'Import' }).click();

    // The import runs on the queue behind the same progress modal; wait it out.
    await expect(page.getByText(/Backing up|Backup queued/)).toBeHidden({ timeout: 60_000 });

    // An "Imported" row is now listed, and it's restorable (Restore control present).
    await expect(page.getByText('Imported').first()).toBeVisible();
    await expect(page.getByTitle('Restore').first()).toBeEnabled();
});
