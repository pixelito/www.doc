import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';

import { ResizableImage } from '@/extensions/ResizableImage';
import { WikiLink } from '@/extensions/WikiLink';
import { NetworkDiagram } from '@/extensions/NetworkDiagram';
import { SlashCommands } from '@/extensions/SlashCommands';
import { ImageUpload } from '@/extensions/ImageUpload';
import { cleanPastedHtml } from '@/utils/pasteCleanup';
import Toolbar from './Toolbar';
import SuggestionList from './SuggestionList';
import WikiLinkPreview from './WikiLinkPreview';

/**
 * Recursively drop invalid empty text nodes. ProseMirror requires every text
 * node to carry a non-empty string; a `{ type: 'text', text: null }` (or '')
 * makes `Node.fromJSON` throw and blanks the WHOLE document. Such nodes have
 * crept into stored content (seeder fallback, link-adjacent segments), so we
 * defensively strip them before handing content to the editor — otherwise a
 * single bad node renders the page blank even though the data is recoverable.
 */
function sanitizeDoc(node) {
    if (!node || typeof node !== 'object' || !Array.isArray(node.content)) {
        return node;
    }
    return {
        ...node,
        content: node.content
            .filter((c) => !(c?.type === 'text' && (typeof c.text !== 'string' || c.text === '')))
            .map(sanitizeDoc),
    };
}

/**
 * TipTap editor component — used for both edit and read-only view.
 *
 * Props:
 *   content        – initial TipTap JSON document
 *   editable       – true for edit mode, false for read-only
 *   suggestions    – [{ id, title, slug }] for wiki-link autocomplete
 *   resolvedLinks  – { [title]: '/documents/{id}' } for read-only link resolution
 *   onUpdate(json) – called when editor content changes (edit mode only)
 *   placeholder    – placeholder text shown in empty editor
 */
export default function TipTapEditor({
    content,
    editable = true,
    suggestions = [],
    resolvedLinks = {},
    onUpdate,
    placeholder = 'Start writing… Type / for commands or [[ to link a page.',
}) {
    const [wikiSuggestion, setWikiSuggestion] = useState(null);
    const [slashSuggestion, setSlashSuggestion] = useState(null);

    const wikiKeyRef  = useRef(null);
    const slashKeyRef = useRef(null);

    // A wiki-link resolves if it matches a known page title OR an already-saved
    // outgoing link. Without the suggestions fallback a link to a page that
    // exists still shows as "doesn't exist yet" until the doc is saved and the
    // backend repopulates outgoing_links — so resolve against the page list too.
    // Explicit resolvedLinks win (they carry the canonical id for the title).
    const linkTargets = useMemo(() => {
        const map = {};
        for (const d of suggestions) {
            if (d?.title) map[d.title] = `/documents/${d.id}`;
        }
        return { ...map, ...resolvedLinks };
    }, [suggestions, resolvedLinks]);

    const safeContent = useMemo(() => (content ? sanitizeDoc(content) : content), [content]);

    const editor = useEditor({
        editable,
        // A doc requires block+ content; default to an empty paragraph (never an
        // empty doc) so there's always a text block to receive inline inserts
        // like wiki-links — otherwise an atom can land at the top level.
        content: safeContent ?? { type: 'doc', content: [{ type: 'paragraph' }] },
        onUpdate: ({ editor: e }) => {
            if (editable) onUpdate?.(e.getJSON());
        },
        editorProps: {
            attributes: {
                class: 'tiptap',
                spellcheck: 'true',
            },
            transformPastedHTML: cleanPastedHtml,
        },
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                // Link and Underline are now built into StarterKit v3
                link: {
                    openOnClick: !editable,
                    HTMLAttributes: { rel: 'noopener noreferrer' },
                },
                underline: {},
            }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            TextStyle,
            Color.configure({ types: ['textStyle'] }),
            Highlight.configure({ multicolor: true }),
            ResizableImage.configure({ inline: false, allowBase64: false }),
            NetworkDiagram,
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
            Placeholder.configure({ placeholder }),
            WikiLink.configure({
                suggestions,
                resolvedLinks: linkTargets,
                onSuggestionStart:   (p) => setWikiSuggestion(p),
                onSuggestionUpdate:  (p) => setWikiSuggestion(p),
                onSuggestionExit:    ()  => setWikiSuggestion(null),
                onSuggestionKeyDown: (e) => wikiKeyRef.current?.(e) ?? false,
            }),
            ...(editable
                ? [
                      SlashCommands.configure({
                          onSuggestionStart:   (p) => setSlashSuggestion(p),
                          onSuggestionUpdate:  (p) => setSlashSuggestion(p),
                          onSuggestionExit:    ()  => setSlashSuggestion(null),
                          onSuggestionKeyDown: (e) => slashKeyRef.current?.(e) ?? false,
                      }),
                      ImageUpload,
                  ]
                : []),
        ],
    });

    // Keep editable flag in sync (e.g. switching from read→edit without remount).
    useEffect(() => {
        if (editor && editor.isEditable !== editable) {
            editor.setEditable(editable);
        }
    }, [editor, editable]);

    // For read-only view: update content when the prop changes (e.g. after Inertia reload).
    useEffect(() => {
        if (editor && !editable && safeContent) {
            editor.commands.setContent(safeContent, false);
        }
    }, [editor, editable, safeContent]);

    return (
        <div className="flex flex-col">
            {editable && <Toolbar editor={editor} />}
            <EditorContent
                editor={editor}
                className={editable ? 'tiptap-edit-area' : 'tiptap-read-area'}
            />
            {wikiSuggestion && (
                <SuggestionList
                    suggestion={wikiSuggestion}
                    keyHandlerRef={wikiKeyRef}
                    renderItem={(item) => (
                        <div className="flex flex-col text-left leading-tight">
                            <span>{item.title}</span>
                            <span className="text-[10px] text-text-tertiary">
                                {item.workspace?.name} / {item.slug}
                            </span>
                        </div>
                    )}
                />
            )}
            {slashSuggestion && (
                <SuggestionList
                    suggestion={slashSuggestion}
                    keyHandlerRef={slashKeyRef}
                    renderItem={(item) => item.title}
                />
            )}
            <WikiLinkPreview />
        </div>
    );
}
