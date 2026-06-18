import { Extension } from '@tiptap/core';
import { Plugin, TextSelection } from 'prosemirror-state';

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content ?? '';

export async function uploadFile(file) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/assets', {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': csrf() },
        body: form,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
}

async function rehostUrl(url) {
    const res = await fetch('/assets/rehost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
        body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error('Rehost failed');
    return res.json();
}

function dataUriToFile(dataUri, filename = 'pasted-image.png') {
    const [header, b64] = dataUri.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
}

function replaceBlobSrc(view, blobUrl, realUrl) {
    const tr = view.state.tr;
    let changed = false;
    view.state.doc.descendants((node, pos) => {
        if (node.type.name === 'image' && node.attrs.src === blobUrl) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: realUrl });
            changed = true;
        }
    });
    if (changed) view.dispatch(tr);
    URL.revokeObjectURL(blobUrl);
}

export function insertFiles(editor, view, files) {
    files.forEach(file => {
        const preview = URL.createObjectURL(file);
        editor.chain().focus().setImage({ src: preview }).run();
        uploadFile(file)
            .then(({ url }) => replaceBlobSrc(view, preview, url))
            .catch(() => URL.revokeObjectURL(preview));
    });
}

/**
 * Handles image paste (files, base64 data URIs, external URLs) and image file drop.
 * Each image is uploaded/rehosted via the asset API, then stored as a permanent URL.
 */
export const ImageUpload = Extension.create({
    name: 'imageUpload',

    addProseMirrorPlugins() {
        const editor = this.editor;

        return [
            new Plugin({
                props: {
                    handlePaste(view, event) {
                        const cd = event.clipboardData;
                        if (!cd) return false;

                        // Direct image files from clipboard (e.g. screenshot paste)
                        const imageFiles = Array.from(cd.files).filter(f =>
                            f.type.startsWith('image/')
                        );
                        if (imageFiles.length > 0) {
                            event.preventDefault();
                            insertFiles(editor, view, imageFiles);
                            return true;
                        }

                        // HTML paste containing data: URIs or external <img> srcs
                        const html = cd.getData('text/html');
                        if (html && /<img/i.test(html)) {
                            const hasDataUri = html.includes('data:image/');
                            const hasExternal = /src=["']https?:\/\//i.test(html);

                            if (hasDataUri || hasExternal) {
                                // Let TipTap process the HTML normally (transformPastedHTML
                                // runs first), then async-replace image srcs with hosted URLs.
                                (async () => {
                                    const doc = new DOMParser().parseFromString(html, 'text/html');
                                    await Promise.all(
                                        Array.from(doc.querySelectorAll('img')).map(async img => {
                                            const src = img.getAttribute('src') ?? '';
                                            try {
                                                if (src.startsWith('data:image/')) {
                                                    const { url } = await uploadFile(dataUriToFile(src));
                                                    img.setAttribute('src', url);
                                                } else if (/^https?:\/\//i.test(src)) {
                                                    const { url } = await rehostUrl(src);
                                                    img.setAttribute('src', url);
                                                }
                                            } catch {
                                                // Leave original src on failure
                                            }
                                        })
                                    );
                                    editor.chain().focus().insertContent(doc.body.innerHTML).run();
                                })();
                                // Return true to suppress TipTap's default HTML paste so we
                                // don't double-insert; our async chain inserts the cleaned HTML.
                                event.preventDefault();
                                return true;
                            }
                        }

                        return false;
                    },

                    handleDrop(view, event) {
                        const dt = event.dataTransfer;
                        if (!dt) return false;

                        const imageFiles = Array.from(dt.files).filter(f =>
                            f.type.startsWith('image/')
                        );
                        if (imageFiles.length === 0) return false;

                        event.preventDefault();

                        // Move cursor to drop position
                        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
                        if (coords) {
                            view.dispatch(
                                view.state.tr.setSelection(
                                    TextSelection.near(view.state.doc.resolve(coords.pos))
                                )
                            );
                        }

                        insertFiles(editor, view, imageFiles);
                        return true;
                    },
                },
            }),
        ];
    },
});
