import React, { useState, useCallback, useRef, useEffect } from 'react';
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
                    ? 'bg-sage-100 text-sage-600'
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
    // One exclusive picker at a time — null | 'link' | 'table' | 'image'
    const [openPicker, setOpenPicker] = useState(null);
    const [linkValue,  setLinkValue]  = useState('');
    const [tableRows,  setTableRows]  = useState(3);
    const [tableCols,  setTableCols]  = useState(3);
    const [imageMode,  setImageMode]  = useState('upload');
    const [imageUrl,   setImageUrl]   = useState('');
    const fileInputRef = useRef(null);

    // Re-render whenever the editor selection or content changes so that
    // isActive() calls always reflect the current cursor position.
    const [, rerender] = useState(0);
    useEffect(() => {
        if (!editor) return;
        const update = () => rerender((v) => v + 1);
        editor.on('selectionUpdate', update);
        editor.on('transaction', update);
        return () => {
            editor.off('selectionUpdate', update);
            editor.off('transaction', update);
        };
    }, [editor]);

    function togglePicker(name, onOpen) {
        if (openPicker === name) {
            setOpenPicker(null);
        } else {
            onOpen?.();
            setOpenPicker(name);
        }
    }

    const applyLink = useCallback(() => {
        if (!linkValue.trim()) {
            editor.chain().focus().unsetLink().run();
        } else {
            editor.chain().focus().setLink({ href: linkValue.trim() }).run();
        }
        setOpenPicker(null);
        setLinkValue('');
    }, [editor, linkValue]);

    const insertImageUrl = useCallback(() => {
        if (imageUrl.trim()) {
            editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
        }
        setOpenPicker(null);
        setImageUrl('');
    }, [editor, imageUrl]);

    const insertTable = useCallback(() => {
        const rows = Math.max(1, Math.min(20, tableRows));
        const cols = Math.max(1, Math.min(20, tableCols));
        editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
        setOpenPicker(null);
        setTableRows(3);
        setTableCols(3);
    }, [editor, tableRows, tableCols]);

    if (!editor) return null;

    const inTable   = editor.isActive('table');
    const inImage   = editor.isActive('image');
    const imgAlign  = inImage ? (editor.getAttributes('image').align ?? 'left') : null;
    const textAlign = editor.getAttributes('paragraph').textAlign
                   ?? editor.getAttributes('heading').textAlign
                   ?? 'left';

    return (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 border-b border-border bg-surface px-2 py-1.5">

            {/* ── Inline marks ──────────────────────────────────────── */}
            <ToolbarButton title="Bold (Ctrl+B)" active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}>
                <IconBold className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton title="Italic (Ctrl+I)" active={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}>
                <IconItalic className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton title="Underline (Ctrl+U)" active={editor.isActive('underline')}
                onClick={() => editor.chain().focus().toggleUnderline().run()}>
                <IconUnderline className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton title="Strikethrough" active={editor.isActive('strike')}
                onClick={() => editor.chain().focus().toggleStrike().run()}>
                <IconStrikethrough className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton title="Inline code" active={editor.isActive('code')}
                onClick={() => editor.chain().focus().toggleCode().run()}>
                <IconCode className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>

            <Divider />

            {/* ── Headings ──────────────────────────────────────────── */}
            <ToolbarButton title="Heading 1" active={editor.isActive('heading', { level: 1 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                <IconH1 className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                <IconH2 className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                <IconH3 className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>

            <Divider />

            {/* ── Lists & blocks ────────────────────────────────────── */}
            <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}>
                <IconList className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton title="Ordered list" active={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                <IconListNumbers className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton title="Blockquote" active={editor.isActive('blockquote')}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                <IconBlockquote className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton title="Code block" active={editor.isActive('codeBlock')}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
                <IconBraces className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>

            <Divider />

            {/* ── Link ──────────────────────────────────────────────── */}
            <ToolbarButton
                title="Insert / edit link"
                active={editor.isActive('link') || openPicker === 'link'}
                onClick={() => {
                    if (editor.isActive('link')) {
                        editor.chain().focus().unsetLink().run();
                    } else {
                        togglePicker('link', () => {
                            setLinkValue(editor.getAttributes('link').href ?? '');
                        });
                    }
                }}
            >
                {editor.isActive('link')
                    ? <IconLinkOff className="h-3.5 w-3.5" stroke={2} />
                    : <IconLink    className="h-3.5 w-3.5" stroke={2} />}
            </ToolbarButton>

            {openPicker === 'link' && (
                <div className="ml-1 flex items-center gap-1">
                    <input
                        autoFocus
                        type="url"
                        value={linkValue}
                        onChange={(e) => setLinkValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter')  applyLink();
                            if (e.key === 'Escape') setOpenPicker(null);
                        }}
                        placeholder="https://..."
                        className="h-6 rounded border border-border bg-canvas px-2 text-xs text-foreground outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-200"
                        style={{ width: 200 }}
                    />
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); applyLink(); }}
                        className="rounded bg-sage-400 px-2 py-0.5 text-xs font-medium text-text-inverse hover:bg-sage-500">
                        Apply
                    </button>
                </div>
            )}

            {/* ── Table ─────────────────────────────────────────────── */}
            {!inTable && (
                <ToolbarButton title="Insert table" active={openPicker === 'table'}
                    onClick={() => togglePicker('table')}>
                    <IconTable className="h-3.5 w-3.5" stroke={2} />
                </ToolbarButton>
            )}

            {openPicker === 'table' && (
                <div className="ml-1 flex items-center gap-1.5">
                    <label className="text-xs text-text-secondary">Rows</label>
                    <input autoFocus type="number" min={1} max={20} value={tableRows}
                        onChange={(e) => setTableRows(Number(e.target.value))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter')  insertTable();
                            if (e.key === 'Escape') setOpenPicker(null);
                        }}
                        className="h-6 w-12 rounded border border-border bg-canvas px-1.5 text-center text-xs outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-200"
                    />
                    <label className="text-xs text-text-secondary">Cols</label>
                    <input type="number" min={1} max={20} value={tableCols}
                        onChange={(e) => setTableCols(Number(e.target.value))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter')  insertTable();
                            if (e.key === 'Escape') setOpenPicker(null);
                        }}
                        className="h-6 w-12 rounded border border-border bg-canvas px-1.5 text-center text-xs outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-200"
                    />
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); insertTable(); }}
                        className="rounded bg-sage-400 px-2 py-0.5 text-xs font-medium text-text-inverse hover:bg-sage-500">
                        Insert
                    </button>
                </div>
            )}

            {/* Table context controls — visible only when cursor is inside a table */}
            {inTable && (
                <>
                    <Divider />
                    <ToolbarButton title="Add row above" active={false}
                        onClick={() => editor.chain().focus().addRowBefore().run()}>
                        <IconRowInsertTop className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                    <ToolbarButton title="Add row below" active={false}
                        onClick={() => editor.chain().focus().addRowAfter().run()}>
                        <IconRowInsertBottom className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                    <ToolbarButton title="Delete row" active={false}
                        onClick={() => editor.chain().focus().deleteRow().run()}>
                        <IconRowRemove className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                    <Divider />
                    <ToolbarButton title="Add column left" active={false}
                        onClick={() => editor.chain().focus().addColumnBefore().run()}>
                        <IconColumnInsertLeft className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                    <ToolbarButton title="Add column right" active={false}
                        onClick={() => editor.chain().focus().addColumnAfter().run()}>
                        <IconColumnInsertRight className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                    <ToolbarButton title="Delete column" active={false}
                        onClick={() => editor.chain().focus().deleteColumn().run()}>
                        <IconColumnRemove className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                    <Divider />
                    <ToolbarButton title="Delete table" active={false}
                        onClick={() => editor.chain().focus().deleteTable().run()}>
                        <IconTableOff className="h-3.5 w-3.5" stroke={2} />
                    </ToolbarButton>
                </>
            )}

            {/* ── Horizontal rule ───────────────────────────────────── */}
            <ToolbarButton title="Horizontal rule" active={false}
                onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                <IconMinus className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>

            {/* ── Image ─────────────────────────────────────────────── */}
            <ToolbarButton title="Insert image" active={openPicker === 'image'}
                onClick={() => togglePicker('image', () => {
                    setImageMode('upload');
                    setImageUrl('');
                })}>
                <IconPhoto className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>

            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => {
                    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'));
                    if (files.length > 0) insertFiles(editor, editor.view, files);
                    setOpenPicker(null);
                    e.target.value = '';
                }}
            />

            {openPicker === 'image' && (
                <div className="ml-1 flex items-center gap-1">
                    <div className="flex overflow-hidden rounded border border-border text-xs">
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); setImageMode('upload'); }}
                            className={`px-2 py-0.5 ${imageMode === 'upload' ? 'bg-sage-100 text-sage-600' : 'text-text-secondary hover:bg-surface-hover'}`}>
                            Upload
                        </button>
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); setImageMode('url'); }}
                            className={`border-l border-border px-2 py-0.5 ${imageMode === 'url' ? 'bg-sage-100 text-sage-600' : 'text-text-secondary hover:bg-surface-hover'}`}>
                            URL
                        </button>
                    </div>

                    {imageMode === 'upload' ? (
                        <button type="button"
                            onMouseDown={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                            className="rounded border border-border bg-canvas px-2 py-0.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover">
                            Choose file…
                        </button>
                    ) : (
                        <>
                            <input autoFocus type="url" value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter')  insertImageUrl();
                                    if (e.key === 'Escape') setOpenPicker(null);
                                }}
                                placeholder="https://…"
                                className="h-6 rounded border border-border bg-canvas px-2 text-xs text-foreground outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-200"
                                style={{ width: 200 }}
                            />
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); insertImageUrl(); }}
                                className="rounded bg-sage-400 px-2 py-0.5 text-xs font-medium text-text-inverse hover:bg-sage-500">
                                Insert
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* ── Alignment ─────────────────────────────────────────── */}
            <Divider />
            <ToolbarButton title="Align left"
                active={inImage ? imgAlign === 'left' : textAlign === 'left'}
                onClick={() => inImage
                    ? editor.commands.updateAttributes('image', { align: 'left' })
                    : editor.chain().focus().setTextAlign('left').run()}>
                <IconAlignLeft className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton title="Align center"
                active={inImage ? imgAlign === 'center' : textAlign === 'center'}
                onClick={() => inImage
                    ? editor.commands.updateAttributes('image', { align: 'center' })
                    : editor.chain().focus().setTextAlign('center').run()}>
                <IconAlignCenter className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>
            <ToolbarButton title="Align right"
                active={inImage ? imgAlign === 'right' : textAlign === 'right'}
                onClick={() => inImage
                    ? editor.commands.updateAttributes('image', { align: 'right' })
                    : editor.chain().focus().setTextAlign('right').run()}>
                <IconAlignRight className="h-3.5 w-3.5" stroke={2} />
            </ToolbarButton>

        </div>
    );
}
