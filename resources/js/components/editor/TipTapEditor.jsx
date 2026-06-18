import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';

import { WikiLink } from '@/extensions/WikiLink';
import { SlashCommands } from '@/extensions/SlashCommands';
import { ImageUpload } from '@/extensions/ImageUpload';
import { cleanPastedHtml } from '@/utils/pasteCleanup';
import Toolbar from './Toolbar';
import SuggestionList from './SuggestionList';

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

    const editor = useEditor({
        editable,
        content: content ?? { type: 'doc', content: [] },
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
            Image.configure({ inline: false, allowBase64: false }),
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
            Placeholder.configure({ placeholder }),
            WikiLink.configure({
                suggestions,
                resolvedLinks,
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
        if (editor && !editable && content) {
            editor.commands.setContent(content, false);
        }
    }, [editor, editable, content]);

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
                    renderItem={(item) => item.title}
                />
            )}
            {slashSuggestion && (
                <SuggestionList
                    suggestion={slashSuggestion}
                    keyHandlerRef={slashKeyRef}
                    renderItem={(item) => item.title}
                />
            )}
        </div>
    );
}
