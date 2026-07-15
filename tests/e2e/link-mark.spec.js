import { test, expect } from '@playwright/test';
import { createDoc } from './helpers.js';

// A link mark must not be inclusive: typing at the end of a link should produce
// plain text, not extend the link. Regression guard for the boundary behaviour.
const WS = 'E2E Link Mark Workspace';

test('typing after a link produces plain text, not more link', async ({ page }) => {
  await createDoc(page, WS, `Link Doc ${Date.now()}`);

  const editor = page.locator('.tiptap-edit-area .tiptap');
  await editor.click();

  // Write a word and select it.
  await page.keyboard.type('linktext');
  await page.keyboard.press('Shift+Home');

  // Apply a link to the selection via the toolbar (Enter in the URL field).
  await page.getByTitle('Insert / edit link').click();
  await page.getByPlaceholder('https://...').fill('https://example.com');
  await page.getByPlaceholder('https://...').press('Enter');

  // Collapse the selection to the right edge (cursor at end of the link) and
  // continue writing.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type('PLAIN');

  // The anchor must hold only the linked word — the trailing text is plain.
  const anchor = page.locator('.tiptap-edit-area a');
  await expect(anchor).toHaveCount(1);
  await expect(anchor).toHaveText('linktext');
  await expect(editor).toContainText('linktextPLAIN'); // both present in the paragraph
});

test('typing after an inline code span produces plain text, not more code', async ({ page }) => {
  await createDoc(page, WS, `Code Mark Doc ${Date.now()}`);

  const editor = page.locator('.tiptap-edit-area .tiptap');
  await editor.click();

  // Write a word, select it, and mark it as inline code via the toolbar.
  await page.keyboard.type('codetext');
  await page.keyboard.press('Shift+Home');
  await page.getByTitle('Inline code').click();

  // Collapse to the right edge (cursor at end of the code span) and keep typing.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type('PLAIN');

  // The <code> must hold only the marked word — the trailing text is plain.
  const code = page.locator('.tiptap-edit-area code');
  await expect(code).toHaveCount(1);
  await expect(code).toHaveText('codetext');
  await expect(editor).toContainText('codetextPLAIN');
});
