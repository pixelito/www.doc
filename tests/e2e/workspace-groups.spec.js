import { test, expect } from '@playwright/test';
import { openWorkspace, createDoc } from './helpers.js';

// Per-file convention: each test uses its OWN workspace name (specs run parallel).
// The "Move to group" submenu is deliberately NOT driven here — pointer-driving
// Radix submenus races with Playwright; the regroup endpoint is covered by Pest
// (WorkspaceGroupTest). This spec covers the reliably pointer-driveable surface.

const GROUP_WS = 'E2E Groups Workspace';
const GROUP = 'E2E Security Group';

test('workspace groups: create, collapse a section, delete', async ({ page }) => {
    // Ensure a workspace exists, then land back on the index.
    await openWorkspace(page, GROUP_WS);
    await page.goto('/workspaces');

    // Create a group via the header ⋯ → New group.
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: /New group/i }).click();
    await page.locator('#group-name').fill(GROUP);
    await page.getByRole('button', { name: 'Create group' }).click();

    // The group section header appears (anchored so it doesn't match "Actions for …").
    const header = page.getByRole('button', { name: new RegExp('^' + GROUP) });
    await expect(header).toBeVisible();

    // The new group is empty and owns the only header — workspaces in no group
    // stay bare rows above it rather than moving under an "Ungrouped" heading.
    const row = page.locator('li').filter({ hasText: GROUP_WS }).first();
    const empty = page.getByText(/No workspaces here yet/);
    await expect(row).toBeVisible();
    await expect(empty).toBeVisible();

    // Collapse → the section's body hides; expand → it returns. (Persists in localStorage.)
    await header.click();
    await expect(empty).toBeHidden();
    await expect(row).toBeVisible(); // ungrouped rows are outside the section
    await header.click();
    await expect(empty).toBeVisible();

    // Delete the group; its header disappears and the workspace survives.
    await page.getByRole('button', { name: `Actions for ${GROUP}` }).click();
    await page.getByRole('menuitem', { name: /Delete group/i }).click();
    await page.getByRole('button', { name: 'Delete group' }).click();
    await expect(page.getByText(new RegExp(`Deleted the group .*${GROUP}`))).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp('^' + GROUP) })).toHaveCount(0);
    await expect(row).toBeVisible();
});

const FOLDER_WS = 'E2E Folder Workspace';

test('a page with children shows a Contents folder view instead of a blank editor', async ({ page }) => {
    // Create a top-level page (lands in edit mode), then view it empty.
    const parentUrl = await createDoc(page, FOLDER_WS, 'E2E Folder Home');
    await page.goto(parentUrl);

    // Empty, no children → the empty-folder state with an add-page affordance.
    await expect(page.getByText('This page is empty')).toBeVisible();
    await page.getByRole('button', { name: /New page/ }).first().click();

    // Adds a child parented to this page (the modal's parent is pre-set).
    await page.getByPlaceholder('e.g. VPN setup').fill('E2E Recovery Key');
    await page.getByRole('button', { name: 'Create page' }).click();
    await page.waitForURL(/\/documents\/\d+/);

    // Back on the parent, the Contents index stands in for the blank editor.
    await page.goto(parentUrl);
    await expect(page.getByRole('heading', { name: /^Contents \(1\)/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /E2E Recovery Key/ })).toBeVisible();
    await expect(page.getByText('This page is empty')).toHaveCount(0);
});

const REORDER_WS = 'E2E Reorder Workspace';
const REORDER_GROUP = 'E2E Reorder Group';

test('reorder mode exposes drag handles for groups and rows, then Cancel discards', async ({ page }) => {
    // A workspace + a group so both kinds of top-level drag handle are present.
    await openWorkspace(page, REORDER_WS);
    await page.goto('/workspaces');
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: /New group/i }).click();
    await page.locator('#group-name').fill(REORDER_GROUP);
    await page.getByRole('button', { name: 'Create group' }).click();
    await expect(page.getByRole('button', { name: new RegExp('^' + REORDER_GROUP) })).toBeVisible();

    // Enter reorder mode via the header ⋯ → Reorder.
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: /^Reorder/ }).click();

    // Done/Cancel own the header, and both the group block and loose rows expose a
    // drag handle — the group and the workspace share one sortable top level. (The
    // actual drag + persistence is covered by Pest; pointer-driving dnd-kit is flaky.)
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
    await expect(page.getByRole('button', { name: `Drag to reorder ${REORDER_GROUP}` })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Drag to reorder' }).first()).toBeVisible();

    // Cancel leaves reorder mode (nothing was dragged, so no discard prompt).
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Done' })).toHaveCount(0);

    // Clean up the group so reruns start fresh.
    await page.getByRole('button', { name: `Actions for ${REORDER_GROUP}` }).click();
    await page.getByRole('menuitem', { name: /Delete group/i }).click();
    await page.getByRole('button', { name: 'Delete group' }).click();
    await expect(page.getByText(new RegExp(`Deleted the group .*${REORDER_GROUP}`))).toBeVisible();
});
