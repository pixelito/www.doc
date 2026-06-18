import React, { useState, useCallback } from 'react';
import {
    IconBold, IconItalic, IconUnderline, IconStrikethrough, IconCode, IconBraces,
    IconH1, IconH2, IconH3,
    IconList, IconListNumbers, IconBlockquote, IconMinus,
    IconLink, IconLinkOff, IconPhoto, IconTable,
} from '@tabler/icons-react';

function ToolbarButton({ onClick, active, title, children, disabled }) {
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onMouseDown={(e) => {
                e.preventDefault(); // prevent editor blur
                onClick();
            }}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors duration-100 ${
                active
                    ? 'bg-sage-100 text-sage-700'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-foreground'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
            {children}
        </button>
    );
}

function Divider() {
    return <div className="mx-1 h-5 w-px bg-border" />;
}

export default function Toolbar({ editor }) {
    const [linkInputVisible, setLinkInputVisible] = useState(false);
    const [linkValue, setLinkValue] = useState('');

    const applyLink = useCallback(() => {
        if (!linkValue.trim()) {
            editor.chain().focus().unsetLink().run();
        } else {
            editor.chain().focus().setLink({ href: linkValue.trim() }).run();
        }
        setLinkInputVisible(false);
        setLinkValue('');
    }, [editor, linkValue]);

    if (!editor) return null;

    return (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface px-2 py-1.5">
            {/* Inline marks */}
            <ToolbarButton
                title="Bold (Ctrl+B)"
                active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}
            >
                <IconBold className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton
                title="Italic (Ctrl+I)"
                active={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}
            >
                <IconItalic className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton
                title="Underline (Ctrl+U)"
                active={editor.isActive('underline')}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
                <IconUnderline className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton
                title="Strikethrough"
                active={editor.isActive('strike')}
                onClick={() => editor.chain().focus().toggleStrike().run()}
            >
                <IconStrikethrough className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton
                title="Inline Code"
                active={editor.isActive('code')}
                onClick={() => editor.chain().focus().toggleCode().run()}
            >
                <IconCode className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>

            <Divider />

            {/* Headings */}
            <ToolbarButton
                title="Heading 1"
                active={editor.isActive('heading', { level: 1 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
                <IconH1 className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton
                title="Heading 2"
                active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
                <IconH2 className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton
                title="Heading 3"
                active={editor.isActive('heading', { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
                <IconH3 className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>

            <Divider />

            {/* Lists & blocks */}
            <ToolbarButton
                title="Bullet List"
                active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
                <IconList className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton
                title="Ordered List"
                active={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
                <IconListNumbers className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton
                title="Blockquote"
                active={editor.isActive('blockquote')}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
                <IconBlockquote className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton
                title="Code Block"
                active={editor.isActive('codeBlock')}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            >
                <IconBraces className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>

            <Divider />

            {/* Link */}
            <ToolbarButton
                title="Insert / edit link"
                active={editor.isActive('link')}
                onClick={() => {
                    if (editor.isActive('link')) {
                        editor.chain().focus().unsetLink().run();
                    } else {
                        const existing = editor.getAttributes('link').href ?? '';
                        setLinkValue(existing);
                        setLinkInputVisible((v) => !v);
                    }
                }}
            >
                {editor.isActive('link') ? (
                    <IconLinkOff className="h-3.5 w-3.5" stroke={2} />
                ) : (
                    <IconLink className="h-3.5 w-3.5" stroke={2} />
                )}
            </ToolbarButton>

            {/* Table */}
            <ToolbarButton
                title="Insert table"
                active={editor.isActive('table')}
                onClick={() =>
                    editor.isActive('table')
                        ? null
                        : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                }
            >
                <IconTable className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>

            {/* Divider line */}
            <ToolbarButton
                title="Horizontal rule"
                active={false}
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
            >
                <IconMinus className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>

            {/* Image by URL */}
            <ToolbarButton
                title="Insert image by URL"
                active={false}
                onClick={() => {
                    const url = prompt('Image URL:');
                    if (url) editor.chain().focus().setImage({ src: url }).run();
                }}
            >
                <IconPhoto className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>

            {/* Inline link URL input */}
            {linkInputVisible && (
                <div className="ml-1 flex items-center gap-1">
                    <input
                        autoFocus
                        type="url"
                        value={linkValue}
                        onChange={(e) => setLinkValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') applyLink();
                            if (e.key === 'Escape') setLinkInputVisible(false);
                        }}
                        placeholder="https://..."
                        className="h-6 rounded border border-border bg-canvas px-2 text-xs text-text-primary outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-200"
                        style={{ width: 200 }}
                    />
                    <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); applyLink(); }}
                        className="rounded bg-sage-400 px-2 py-0.5 text-xs font-medium text-text-inverse hover:bg-sage-500"
                    >
                        Apply
                    </button>
                </div>
            )}
        </div>
    );
}
