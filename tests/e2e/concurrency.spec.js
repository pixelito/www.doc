import { test, expect } from '@playwright/test';

/**
 * Optimistic-locking: when two people edit the same page, the second save is
 * rejected with a conflict dialog instead of silently overwriting the first.
 */

async function ensureWorkspace(page) {
    await page.goto('/workspaces');
    const existing = page.getByText('E2E Test Workspace').first();
    if (await existing.isVisible().catch(() => false)) {
        await existing.click();
    } else {
        await page.getByRole('button', { name: /New workspace/i }).first().click();
        await page.locator('#workspace-name').fill('E2E Test Workspace');
        await page.getByRole('button', { name: 'Create workspace' }).click();
    }
    await expect(page.getByRole('heading', { name: 'E2E Test Workspace' })).toBeVisible();
}

/** Create a fresh page and return its canonical /documents/{id} URL. */
async function createDoc(page, title) {
    await ensureWorkspace(page);
    const addSubpage = page.getByTitle('Add subpage').first();
    const newPage = page.getByRole('button', { name: /New page/i }).first();
    if (await addSubpage.isVisible().catch(() => false)) await addSubpage.click();
    else await newPage.click();

    await page.getByPlaceholder('e.g. VPN setup').fill(title);
    await page.getByRole('button', { name: 'Create page' }).click();

    await page.waitForURL(/\/documents\/\d+/);
    return page.url().split('?')[0];
}

test('a stale save shows the conflict dialog and overwrite wins', async ({ browser }) => {
    const ctxA = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    const ctxB = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
        // A creates the page (lands in edit mode) — both A and B now load the same base version.
        const docUrl = await createDoc(pageA, `Conflict Doc ${Date.now()}`);

        await pageB.goto(docUrl);
        await pageB.getByRole('button', { name: 'Edit' }).click();
        await expect(pageB.locator('.tiptap.ProseMirror')).toBeVisible();

        // A edits and saves first → the document version bumps.
        const editorA = pageA.locator('.tiptap.ProseMirror');
        await editorA.click();
        await pageA.keyboard.type('Content from user A.');
        await pageA.getByRole('button', { name: 'Save', exact: true }).click();
        await pageA.waitForLoadState('networkidle');
        await expect(pageA.getByRole('button', { name: 'Edit' })).toBeVisible();

        // B edits and saves on the now-stale base → conflict.
        const editorB = pageB.locator('.tiptap.ProseMirror');
        await editorB.click();
        await pageB.keyboard.type('Content from user B.');
        await pageB.getByRole('button', { name: 'Save', exact: true }).click();

        // The conflict dialog appears, showing both versions.
        await expect(pageB.getByText('This page changed while you were editing')).toBeVisible();
        await expect(pageB.getByText('Content from user A.')).toBeVisible(); // "their" side

        // Overwrite with mine → B's content wins.
        await pageB.getByRole('button', { name: /Overwrite with mine/i }).click();
        await pageB.waitForLoadState('networkidle');

        await pageB.goto(docUrl);
        await expect(pageB.getByText('Content from user B.')).toBeVisible();
    } finally {
        await ctxA.close();
        await ctxB.close();
    }
});
