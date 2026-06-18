import React, { useState, useCallback, useRef } from 'react';
import {
    IconBold, IconItalic, IconUnderline, IconStrikethrough, IconCode, IconBraces,
    IconH1, IconH2, IconH3,
    IconList, IconListNumbers, IconBlockquote, IconMinus,
    IconLink, IconLinkOff, IconPhoto, IconTable, IconTableOff,
    IconRowInsertBottom, IconRowInsertTop, IconRowRemove,
    IconColumnInsertLeft, IconColumnInsertRight, IconColumnRemove,
    IconAlignLeft, IconAlignCenter, IconAlignRight,
} from '@tabler/icons-react';
import { insertFiles } from '@/extensions/ImageUpload';

function ToolbarButton({ onClick, active, title, children, disabled }) {
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onMouseDown={(e) => {
                e.preventDefault();
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
    const [tablePickerVisible, setTablePickerVisible] = useState(false);
    const [tableRows, setTableRows] = useState(3);
    const [tableCols, setTableCols] = useState(3);
    const [imagePickerVisible, setImagePickerVisible] = useState(false);
    const [imageMode, setImageMode] = useState('upload'); // 'upload' | 'url'
    const [imageUrl, setImageUrl] = useState('');
    const fileInputRef = useRef(null);

    const applyLink = useCallback(() => {
        if (!linkValue.trim()) {
            editor.chain().focus().unsetLink().run();
        } else {
            editor.chain().focus().setLink({ href: linkValue.trim() }).run();
        }
        setLinkInputVisible(false);
        setLinkValue('');
    }, [editor, linkValue]);

    const insertImageUrl = useCallback(() => {
        if (imageUrl.trim()) {
            editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
        }
        setImagePickerVisible(false);
        setImageUrl('');
    }, [editor, imageUrl]);

    const insertTable = useCallback(() => {
        const rows = Math.max(1, Math.min(20, tableRows));
        const cols = Math.max(1, Math.min(20, tableCols));
        editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
        setTablePickerVisible(false);
        setTableRows(3);
        setTableCols(3);
    }, [editor, tableRows, tableCols]);

    if (!editor) return null;

    const inTable = editor.isActive('table');

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
                        setTablePickerVisible(false);
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

            {/* Table — insert button (only when not in a table) */}
            {!inTable && (
                <ToolbarButton
                    title="Insert table"
                    active={tablePickerVisible}
                    onClick={() => {
                        setLinkInputVisible(false);
                        setTablePickerVisible((v) => !v);
                    }}
                >
                    <IconTable className="h-3.5 w-3.5" stroke={2} />
                </ToolbarButton>
            )}

            {/* Table context controls — shown only when cursor is inside a table */}
            {inTable && (
                <>
                    <Divider />
                    <ToolbarButton
                        title="Add row above"
                        active={false}
                        onClick={() => editor.chain().focus().addRowBefore().run()}
                    >
                        <IconRowInsertTop className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Add row below"
                        active={false}
                        onClick={() => editor.chain().focus().addRowAfter().run()}
                    >
                        <IconRowInsertBottom className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Delete row"
                        active={false}
                        onClick={() => editor.chain().focus().deleteRow().run()}
                    >
                        <IconRowRemove className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                    <Divider />
                    <ToolbarButton
                        title="Add column left"
                        active={false}
                        onClick={() => editor.chain().focus().addColumnBefore().run()}
                    >
                        <IconColumnInsertLeft className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Add column right"
                        active={false}
                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                    >
                        <IconColumnInsertRight className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Delete column"
                        active={false}
                        onClick={() => editor.chain().focus().deleteColumn().run()}
                    >
                        <IconColumnRemove className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                    <Divider />
                    <ToolbarButton
                        title="Delete table"
                        active={false}
                        onClick={() => editor.chain().focus().deleteTable().run()}
                    >
                        <IconTableOff className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                </>
            )}

            {/* Divider line */}
            <ToolbarButton
                title="Horizontal rule"
                active={false}
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
            >
                <IconMinus className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>

            {/* Image — upload or URL */}
            <ToolbarButton
                title="Insert image"
                active={imagePickerVisible}
                onClick={() => {
                    setLinkInputVisible(false);
                    setTablePickerVisible(false);
                    setImagePickerVisible((v) => !v);
                    setImageMode('upload');
                    setImageUrl('');
                }}
            >
                <IconPhoto className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>

            {/* Hidden file input — triggered by the Upload tab button */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const files = Array.from(e.target.files ?? []).filter(f =>
                        f.type.startsWith('image/')
                    );
                    if (files.length > 0) insertFiles(editor, editor.view, files);
                    setImagePickerVisible(false);
                    e.target.value = '';
                }}
            />

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

            {/* Image picker — upload or URL */}
            {imagePickerVisible && (
                <div className="ml-1 flex items-center gap-1">
                    {/* Mode tabs */}
                    <div className="flex overflow-hidden rounded border border-border text-xs">
                        <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setImageMode('upload'); }}
                            className={`px-2 py-0.5 ${imageMode === 'upload' ? 'bg-sage-100 text-sage-700' : 'text-text-secondary hover:bg-surface-hover'}`}
                        >
                            Upload
                        </button>
                        <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setImageMode('url'); }}
                            className={`border-l border-border px-2 py-0.5 ${imageMode === 'url' ? 'bg-sage-100 text-sage-700' : 'text-text-secondary hover:bg-surface-hover'}`}
                        >
                            URL
                        </button>
                    </div>

                    {imageMode === 'upload' ? (
                        <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                            className="rounded border border-border bg-canvas px-2 py-0.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover"
                        >
                            Choose file…
                        </button>
                    ) : (
                        <>
                            <input
                                autoFocus
                                type="url"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') insertImageUrl();
                                    if (e.key === 'Escape') setImagePickerVisible(false);
                                }}
                                placeholder="https://…"
                                className="h-6 rounded border border-border bg-canvas px-2 text-xs text-text-primary outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-200"
                                style={{ width: 200 }}
                            />
                            <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); insertImageUrl(); }}
                                className="rounded bg-sage-400 px-2 py-0.5 text-xs font-medium text-text-inverse hover:bg-sage-500"
                            >
                                Insert
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Image alignment — shown whenever an image node is selected */}
            {editor.isActive('image') && (
                <>
                    <Divider />
                    <ToolbarButton
                        title="Align left"
                        active={!editor.isActive('image', { align: 'center' }) && !editor.isActive('image', { align: 'right' })}
                        onClick={() => editor.commands.updateAttributes('image', { align: 'left' })}
                    >
                        <IconAlignLeft className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Align center"
                        active={editor.isActive('image', { align: 'center' })}
                        onClick={() => editor.commands.updateAttributes('image', { align: 'center' })}
                    >
                        <IconAlignCenter className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Align right"
                        active={editor.isActive('image', { align: 'right' })}
                        onClick={() => editor.commands.updateAttributes('image', { align: 'right' })}
                    >
                        <IconAlignRight className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                </>
            )}

            {/* Table size picker */}
            {tablePickerVisible && (
                <div className="ml-1 flex items-center gap-1.5">
                    <label className="text-xs text-text-secondary">Rows</label>
                    <input
                        autoFocus
                        type="number"
                        min={1}
                        max={20}
                        value={tableRows}
                        onChange={(e) => setTableRows(Number(e.target.value))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') insertTable();
                            if (e.key === 'Escape') setTablePickerVisible(false);
                        }}
                        className="h-6 w-12 rounded border border-border bg-canvas px-1.5 text-center text-xs text-text-primary outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-200"
                    />
                    <label className="text-xs text-text-secondary">Cols</label>
                    <input
                        type="number"
                        min={1}
                        max={20}
                        value={tableCols}
                        onChange={(e) => setTableCols(Number(e.target.value))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') insertTable();
                            if (e.key === 'Escape') setTablePickerVisible(false);
                        }}
                        className="h-6 w-12 rounded border border-border bg-canvas px-1.5 text-center text-xs text-text-primary outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-200"
                    />
                    <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); insertTable(); }}
                        className="rounded bg-sage-400 px-2 py-0.5 text-xs font-medium text-text-inverse hover:bg-sage-500"
                    >
                        Insert
                    </button>
                </div>
            )}
        </div>
    );
}
