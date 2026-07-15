import { test, expect } from '@playwright/test';
import { createDoc } from './helpers.js';

// The paste handler must upload the raw bitmap from the clipboard whenever the
// accompanying HTML offers no image we can resolve — e.g. web apps like
// WhatsApp that paste <img src="blob:…their-origin…"> alongside the bitmap.
// A blob: URL is scoped to the source origin: we can neither fetch nor store
// it, so without this the image lands as a dead "Image Unavailable" placeholder.
const WS = 'E2E Image Paste Workspace';

// 1x1 transparent PNG.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Synthesize a paste of an image bitmap plus optional text/html, and return the
 * src attributes of the images that ended up in the editor (after upload).
 */
async function pasteBitmap(page, { html }) {
  return page.evaluate(async ({ b64, html }) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const file = new File([bytes], 'pasted.png', { type: 'image/png' });

    const dt = new DataTransfer();
    dt.items.add(file);
    if (html) dt.setData('text/html', html);

    const el = document.querySelector('.tiptap-edit-area .tiptap');
    el.focus();
    el.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: dt, bubbles: true, cancelable: true,
    }));

    await new Promise(r => setTimeout(r, 1500)); // allow the upload round-trip
    return Array.from(document.querySelectorAll('.tiptap-edit-area img'))
      .map(i => i.getAttribute('src'));
  }, { b64: PNG_B64, html });
}

test('pasting a WhatsApp-style image (bitmap + blob img) uploads the bitmap', async ({ page }) => {
  await createDoc(page, WS, `WA Paste ${Date.now()}`);
  await page.locator('.tiptap-edit-area .tiptap').click();

  const srcs = await pasteBitmap(page, {
    html: '<img src="blob:https://web.whatsapp.com/deadbeef-0000">',
  });

  expect(srcs.length).toBeGreaterThan(0);
  for (const src of srcs) expect(src).not.toContain('web.whatsapp.com');
  expect(srcs.some(s => /\/storage\/assets\//.test(s))).toBe(true);
});

test('pasting a plain screenshot (bitmap, no html) uploads the bitmap', async ({ page }) => {
  await createDoc(page, WS, `Screenshot Paste ${Date.now()}`);
  await page.locator('.tiptap-edit-area .tiptap').click();

  const srcs = await pasteBitmap(page, { html: '' });

  expect(srcs.length).toBeGreaterThan(0);
  expect(srcs.some(s => /\/storage\/assets\//.test(s))).toBe(true);
});
