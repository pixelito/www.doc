import { test, expect } from '@playwright/test';
import { createDoc } from './helpers';

/**
 * Network diagram — the browser-only parts Pest can't reach (this replaces the
 * old docs/network-diagram-smoke-test.md manual checklist):
 *
 *   - the live React Flow canvas: insert, add nodes, rename via double-click
 *   - persistence round-trip: the graph JSON in `attrs` is the source of truth,
 *     so a reload must bring the same nodes/labels back
 *   - the read view renders a (read-only) canvas, not an editor
 *   - hidden-label FTS: a node label never appears in the page TEXT, yet search
 *     must find the page by it (the search vector indexes diagram labels)
 *
 * Everything downstream of the persisted graph (server-side SVG for PDF/DOCX,
 * search-vector SQL) is covered by Pest: DiagramSvgTest, RenderDocumentTest,
 * NetworkDiagramTest, SearchTest.
 */
test('a network diagram edits, persists, renders read-only, and is searchable by node label', async ({ page }) => {
    test.setTimeout(60_000);

    const stamp = Date.now();
    const docTitle = `Diagram Doc ${stamp}`;
    // Unique label so the search assertion can't match older test runs' data.
    const label = `core-router-${stamp}`;

    await createDoc(page, 'E2E Diagram Workspace', docTitle);

    // Insert a diagram from the editor toolbar.
    const editor = page.locator('.tiptap.ProseMirror');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.getByTitle('Insert diagram').click();

    const diagram = page.locator('[data-network-diagram]');
    await expect(diagram).toBeVisible();

    // Add two nodes.
    const addNode = diagram.getByRole('button', { name: 'Node', exact: true });
    await addNode.click();
    await addNode.click();
    await expect(diagram.locator('.react-flow__node')).toHaveCount(2);

    // Rename the first node: double-click opens the inline label input.
    const firstNode = diagram.locator('.react-flow__node').first();
    await firstNode.dblclick();
    const labelInput = firstNode.locator('input');
    await expect(labelInput).toBeVisible();
    await labelInput.fill(label);
    await labelInput.press('Enter');
    await expect(diagram.getByText(label)).toBeVisible();

    // Save → read mode. The read view renders the graph as a READ-ONLY canvas:
    // the label is visible but the editing chrome (the Node button) is not.
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(page.locator('[data-network-diagram]').getByText(label)).toBeVisible();
    await expect(page.locator('[data-network-diagram]').getByRole('button', { name: 'Node', exact: true })).toHaveCount(0);

    // Reload: the graph JSON persisted in the document is the source of truth.
    await page.reload();
    await expect(page.locator('[data-network-diagram]').getByText(label)).toBeVisible();

    // Hidden-label FTS: the label only ever existed inside the canvas, never in
    // the page text — searching for it must still find the page.
    const searchInput = page.getByPlaceholder(/Search docs/i);
    await searchInput.fill(label);
    await searchInput.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=/);
    await expect(page.getByText(docTitle).first()).toBeVisible();
});
