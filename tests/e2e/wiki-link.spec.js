import { test, expect } from '@playwright/test';
import { createDoc } from './helpers.js';

const WS = 'E2E WikiLink Workspace';

test('typing [[ to a missing page offers Create new page and inserts a red link', async ({ page }) => {
  await createDoc(page, WS, `Wiki Source ${Date.now()}`);

  const editor = page.locator('.tiptap-edit-area .tiptap');
  await editor.click();

  const title = `Runbook ${Date.now()}`;
  await page.keyboard.type(`[[${title}`);

  const createItem = page.getByText(`Create new page '${title}'`);
  await expect(createItem).toBeVisible();
  await createItem.click();

  // An unresolved wiki-link chip now exists in the editor.
  const chip = editor.locator('span.wiki-link.unresolved', { hasText: title });
  await expect(chip).toBeVisible();
});
