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

export function dataUriToFile(dataUri, filename = 'pasted-image.png') {
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

                        const imageFiles = Array.from(cd.files).filter(f => f.type.startsWith('image/'));
                        const html       = cd.getData('text/html');
                        const htmlHasImg = html && /<img/i.test(html);

                        // Pure image file(s) — screenshot or copy-image with no surrounding HTML.
                        // When HTML with <img> is also present we fall through to preserve text context.
                        if (imageFiles.length > 0 && !htmlHasImg) {
                            event.preventDefault();
                            insertFiles(editor, view, imageFiles);
                            return true;
                        }

                        // HTML paste containing <img> — handles three src formats:
                        //   data:image/…  → upload directly
                        //   https?://…    → rehost via asset API
                        //   file://…      → pair positionally with cd.files and upload
                        //                   (LibreOffice on Linux puts images as file:// refs
                        //                    alongside the image file in cd.files)
                        if (htmlHasImg) {
                            const parsed = new DOMParser().parseFromString(html, 'text/html');
                            const imgs   = Array.from(parsed.querySelectorAll('img'));

                            const hasDataUri  = imgs.some(img => (img.getAttribute('src') ?? '').startsWith('data:image/'));
                            const hasExternal = imgs.some(img => /^https?:\/\//i.test(img.getAttribute('src') ?? ''));
                            const hasFileRef  = imgs.some(img => (img.getAttribute('src') ?? '').startsWith('file://'));

                            if (hasDataUri || hasExternal || hasFileRef) {
                                event.preventDefault();
                                // fileIdx increments synchronously inside map() before any await,
                                // so positional pairing with cd.files is deterministic.
                                let fileIdx = 0;
                                (async () => {
                                    await Promise.all(imgs.map(async img => {
                                        const src = img.getAttribute('src') ?? '';
                                        try {
                                            if (src.startsWith('data:image/')) {
                                                const { url } = await uploadFile(dataUriToFile(src));
                                                img.setAttribute('src', url);
                                            } else if (/^https?:\/\//i.test(src)) {
                                                const { url } = await rehostUrl(src);
                                                img.setAttribute('src', url);
                                            } else if (src.startsWith('file://')) {
                                                const file = imageFiles[fileIdx++];
                                                if (file) {
                                                    const { url } = await uploadFile(file);
                                                    img.setAttribute('src', url);
                                                } else {
                                                    img.remove();
                                                }
                                            }
                                        } catch {
                                            if ((img.getAttribute('src') ?? '').startsWith('file://')) img.remove();
                                        }
                                    }));
                                    editor.chain().focus().insertContent(parsed.body.innerHTML).run();
                                })();
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
