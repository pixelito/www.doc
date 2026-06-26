import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    IconChevronRight, IconTrash, IconPencil, IconX, IconDeviceFloppy,
    IconUser, IconTag, IconCircleCheck, IconClock,
    IconDownload, IconLoader2, IconHistory, IconFileText, IconPlus, IconCalendar, IconLink,
    IconFolderSymlink,
} from '@tabler/icons-react';
import DocsLayout from '@/Layouts/DocsLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import TipTapEditor from '@/components/editor/TipTapEditor';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { can } from '@/lib/permissions';

const CSRF = () => document.querySelector('meta[name="csrf-token"]')?.content ?? '';

function isDocEmpty(content) {
    const nodes = content?.content ?? [];
    if (nodes.length === 0) return true;
    if (nodes.length === 1) {
        const n = nodes[0];
        return n.type === 'paragraph' && (!n.content || n.content.length === 0);
    }
    return false;
}

function fmtDate(iso) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function timeAgo(iso) {
    if (!iso) return null;
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)      return 'just now';
    if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return fmtDate(iso);
}

function MetaItem({ icon: Icon, children }) {
    return (
        <span className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" stroke={1.5} />
            {children}
        </span>
    );
}

function PageMeta({ document, versionsCount }) {
    return (
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border-subtle pt-4 text-xs text-text-tertiary">
            <MetaItem icon={IconCalendar}>
                Created {fmtDate(document.created_at)}
                {document.creator && (
                    <> by <span className="text-text-secondary">{document.creator.name}</span></>
                )}
            </MetaItem>
            <MetaItem icon={IconClock}>
                Edited {timeAgo(document.updated_at)}
                {document.updater && (
                    <> by <span className="text-text-secondary">{document.updater.name}</span></>
                )}
            </MetaItem>
            <Link
                href={`/documents/${document.id}/versions`}
                title="View version history"
                className="flex items-center gap-1.5 text-sage-600 underline decoration-dotted underline-offset-2 transition-colors hover:text-sage-700"
            >
                <IconHistory className="h-3.5 w-3.5 shrink-0" stroke={1.5} />
                <span>{versionsCount} {versionsCount === 1 ? 'version' : 'versions'} · View history</span>
            </Link>
        </div>
    );
}

function ExportModal({ documentId, open, onClose }) {
    const [format, setFormat]   = useState('pdf');
    const [state, setState]     = useState('idle'); // idle | pending | done | failed
    const [error, setError]     = useState(null);
    const [downloaded, setDownloaded] = useState(false);
    const pollRef               = useRef(null);
    const jobIdRef              = useRef(null);

    function reset() {
        clearInterval(pollRef.current);
        setState('idle');
        setError(null);
        setDownloaded(false);
        jobIdRef.current = null;
    }

    function handleClose() {
        reset();
        onClose();
    }

    async function startExport() {
        setState('pending');
        setError(null);

        try {
            const res = await fetch(`/documents/${documentId}/exports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': CSRF() },
                body: JSON.stringify({ format }),
            });

            if (!res.ok) throw new Error('Failed to start export');
            const { id } = await res.json();
            jobIdRef.current = id;

            pollRef.current = setInterval(async () => {
                try {
                    const poll = await fetch(`/documents/${documentId}/exports/${id}`, {
                        headers: { 'Accept': 'application/json' },
                    });
                    const data = await poll.json();

                    if (data.status === 'done') {
                        clearInterval(pollRef.current);
                        setState('done');
                    } else if (data.status === 'failed') {
                        clearInterval(pollRef.current);
                        setState('failed');
                        setError(data.error ?? 'Export failed.');
                    }
                } catch {
                    // keep polling
                }
            }, 1500);
        } catch (e) {
            setState('failed');
            setError(e.message);
        }
    }

    function triggerDownload() {
        setDownloaded(true);
        window.location.href = `/documents/${documentId}/exports/${jobIdRef.current}?download=1`;
    }

    useEffect(() => () => clearInterval(pollRef.current), []);

    const formats = [
        { value: 'pdf',  label: 'PDF',  description: 'Print-ready with headers & page numbers' },
        { value: 'docx', label: 'DOCX', description: 'Microsoft Word — preserves all formatting' },
    ];

    return (
        <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Export page</DialogTitle>
                    <DialogDescription>Choose a format to download this page.</DialogDescription>
                </DialogHeader>

                {/* Format selector */}
                {state === 'idle' && (
                    <div className="space-y-3 py-2">
                        {formats.map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setFormat(f.value)}
                                className={`w-full rounded-sm border px-4 py-3 text-left transition-all ${
                                    format === f.value
                                        ? 'border-sage-400 bg-sage-50 ring-[3px] ring-sage-200/60'
                                        : 'border-border bg-surface hover:bg-surface-hover'
                                }`}
                            >
                                <p className="text-sm font-semibold text-text-primary">{f.label}</p>
                                <p className="mt-0.5 text-xs text-text-secondary">{f.description}</p>
                            </button>
                        ))}

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={handleClose}>Cancel</Button>
                            <Button
                                className="bg-sage-400 hover:bg-sage-500 text-text-inverse"
                                onClick={startExport}
                            >
                                <IconDownload stroke={1.5} />
                                Export
                            </Button>
                        </div>
                    </div>
                )}

                {/* Pending */}
                {state === 'pending' && (
                    <div className="flex flex-col items-center gap-3 py-8 text-text-secondary">
                        <IconLoader2 className="h-8 w-8 animate-spin text-sage-500" stroke={1.5} />
                        <p className="text-sm">Generating {format.toUpperCase()}…</p>
                    </div>
                )}

                {/* Done */}
                {state === 'done' && (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <IconCircleCheck className="h-10 w-10 text-sage-500" stroke={1.5} />
                        <p className="text-sm font-medium text-text-primary">Your file is ready!</p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleClose}>Close</Button>
                            <Button
                                className="bg-sage-400 hover:bg-sage-500 text-text-inverse disabled:opacity-50"
                                onClick={triggerDownload}
                                disabled={downloaded}
                            >
                                <IconDownload stroke={1.5} />
                                {downloaded ? 'Downloaded' : `Download ${format.toUpperCase()}`}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Failed */}
                {state === 'failed' && (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <p className="text-sm font-medium text-danger">Export failed</p>
                        {error && <p className="text-xs text-text-secondary">{error}</p>}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleClose}>Close</Button>
                            <Button onClick={() => { reset(); startExport(); }}>Retry</Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function MoveModal({ open, onClose, documentId, workspaces, currentWorkspaceId }) {
    const targets = workspaces.filter((w) => w.id !== currentWorkspaceId);
    const [target, setTarget] = useState('');
    const [moving, setMoving] = useState(false);

    useEffect(() => { if (open) { setTarget(''); setMoving(false); } }, [open]);

    function submit() {
        if (!target) return;
        setMoving(true);
        router.patch(`/documents/${documentId}/move`, { workspace_id: Number(target), parent_id: null }, {
            preserveScroll: true,
            onFinish: () => { setMoving(false); onClose(); },
        });
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Move page</DialogTitle>
                    <DialogDescription>
                        Move this page and its subpages to another workspace. It's placed at
                        the top level there — you can re-nest it afterwards.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-2">
                    <label htmlFor="move-target" className="mb-1.5 block text-sm font-medium text-foreground">
                        Destination workspace
                    </label>
                    <select
                        id="move-target"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className="h-9 w-full rounded-sm border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus:border-sage-400 focus:ring-[3px] focus:ring-sage-200"
                    >
                        <option value="" disabled>Select a workspace…</option>
                        {targets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={submit} disabled={!target || moving}>
                        {moving && <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.5} />}
                        Move page
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function formatContext(text) {
    if (!text) return null;
    return text.split(/(\[\[.*?\]\])/g).map((part, index) => {
        if (part.startsWith('[[') && part.endsWith(']]')) {
            const innerText = part.slice(2, -2);
            return (
                <span key={index} className="mx-0.5 inline-block rounded-[3px] bg-sage-50 px-1 font-medium text-sage-600 underline decoration-sage-300 underline-offset-2">
                    {innerText}
                </span>
            );
        }
        return <span key={index}>{part}</span>;
    });
}

function BacklinksPanel({ backlinks }) {
    return (
        <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">
                <IconLink className="h-3.5 w-3.5" stroke={1.5} />
                Referenced by ({backlinks.length})
            </h2>
            <div className="overflow-hidden rounded-md border border-border bg-card">
                {backlinks.map((link, idx) => (
                    <Link
                        key={link.id}
                        href={`/documents/${link.id}`}
                        className={`block px-4 py-3 transition-colors hover:bg-surface-hover${idx > 0 ? ' border-t border-border-subtle' : ''}`}
                    >
                        <div className="flex items-center gap-2">
                            <IconFileText className="h-4 w-4 shrink-0 text-text-tertiary" stroke={1.5} />
                            <span className="truncate text-sm font-medium text-foreground">{link.title}</span>
                        </div>
                        {link.context && (
                            <p className="mt-1 truncate pl-6 text-xs text-text-tertiary">
                                {formatContext(link.context)}
                            </p>
                        )}
                    </Link>
                ))}
            </div>
        </section>
    );
}

export default function DocumentShow({ document, versionsCount, breadcrumbs = [], backlinks = [], allTags = [], allDocuments = [], workspaces = [] }) {
    const { auth } = usePage().props;
    const perms = can(auth);
    const [isEditing, setIsEditing]       = useState(
        () => perms.update && new URLSearchParams(window.location.search).get('edit') === '1'
    );
    const [exportOpen, setExportOpen]     = useState(false);
    const [moveOpen, setMoveOpen]         = useState(false);

    const [editTitle, setEditTitle] = useState(document.title);
    const [editTags, setEditTags] = useState(document.tags.map((t) => t.id));

    // Holds the latest JSON from the editor without triggering re-renders
    const editorContentRef = useRef(document.content);

    const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved'
    const [deleteOpen, setDeleteOpen]   = useState(false);
    const isDirtyRef = useRef(false);

    const [showNewTag, setShowNewTag]           = useState(false);
    const [newTagName, setNewTagName]           = useState('');
    const [newTagProcessing, setNewTagProcessing] = useState(false);
    const [newTagError, setNewTagError]         = useState('');

    // Build resolvedLinks map: { "Page Title": "/documents/id" }
    const resolvedLinks = Object.fromEntries(
        (document.outgoing_links ?? [])
            .filter((l) => l.target)
            .map((l) => [l.target_title, `/documents/${l.target.id}`])
    );

    // Warn before losing unsaved edits on close/refresh or an in-app navigation
    // (breadcrumb, version history, sidebar). In-page POSTs — saving, creating a
    // tag — are non-GET and pass through; see the discard modal below.
    const { promptOpen, requestLeave, confirmDiscard, dismissPrompt } = useUnsavedChangesGuard({
        active: isEditing,
        dirtyRef: isDirtyRef,
        revert: () => { setIsEditing(false); setSaveStatus(null); },
    });

    // Title/tag edits count as unsaved too (content edits flag the ref directly).
    useEffect(() => {
        if (!isEditing) return;
        const titleChanged = editTitle !== document.title;
        const tagsChanged = JSON.stringify([...editTags].sort()) !== JSON.stringify([...document.tags.map(t => t.id)].sort());
        if (titleChanged || tagsChanged) isDirtyRef.current = true;
    }, [editTitle, editTags, isEditing]);

    // Reset form fields when entering/leaving edit mode
    useEffect(() => {
        if (isEditing) {
            setEditTitle(document.title);
            setEditTags(document.tags.map((t) => t.id));
            editorContentRef.current = document.content;
            setSaveStatus(null);
            isDirtyRef.current = false;
        } else {
            setShowNewTag(false);
            setNewTagName('');
            setNewTagError('');
        }
    }, [isEditing]);

    // --- Save helpers ---

    const performSave = useCallback(
        (content) => {
            setSaveStatus('saving');
            router.patch(
                `/documents/${document.id}`,
                { title: editTitle, content, tags: editTags },
                {
                    preserveState: false,
                    preserveScroll: true,
                    onSuccess: () => {
                        setSaveStatus('saved');
                        setIsEditing(false);
                    },
                    onError: () => setSaveStatus(null),
                }
            );
        },
        [document.id, editTitle, editTags]
    );

    const handleEditorUpdate = useCallback((json) => {
        editorContentRef.current = json;
        isDirtyRef.current = true;
    }, []);

    function handleExplicitSave(e) {
        e.preventDefault();
        performSave(editorContentRef.current);
    }

    function handleTagToggle(tagId) {
        setEditTags((prev) =>
            prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
        );
    }

    function submitNewTag(e) {
        e.preventDefault();
        const name = newTagName.trim();
        if (!name || newTagProcessing) return;
        setNewTagProcessing(true);
        setNewTagError('');
        router.post('/tags', { name }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: (page) => {
                const created = (page.props.allTags ?? []).find(t => t.name === name);
                if (created) setEditTags(prev => prev.includes(created.id) ? prev : [...prev, created.id]);
                setNewTagName('');
                setShowNewTag(false);
                setNewTagProcessing(false);
            },
            onError: (errors) => {
                setNewTagError(errors.name ?? 'Failed to create tag.');
                setNewTagProcessing(false);
            },
        });
    }

    function destroyDocument() {
        setDeleteOpen(true);
    }

    function confirmDelete() {
        setDeleteOpen(false);
        router.delete(`/documents/${document.id}`);
    }

    return (
        <>
        <DocsLayout>
            <Head title={document.title} />

            {/* Breadcrumb */}
            <nav className="flex flex-wrap items-center gap-1.5 text-sm text-text-secondary">
                <Link href="/workspaces" className="transition-colors hover:text-foreground">
                    Workspaces
                </Link>
                <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" stroke={1.5} />
                <Link
                    href={`/workspaces/${document.workspace.id}`}
                    className="transition-colors hover:text-foreground"
                >
                    {document.workspace.name}
                </Link>
                {breadcrumbs.map((anc) => (
                    <React.Fragment key={anc.id}>
                        <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" stroke={1.5} />
                        <Link
                            href={`/documents/${anc.id}`}
                            className="transition-colors hover:text-foreground"
                        >
                            {anc.title}
                        </Link>
                    </React.Fragment>
                ))}
                <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" stroke={1.5} />
                <span className="font-medium text-foreground">{document.title}</span>
            </nav>

            {/* Header */}
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                {isEditing ? (
                    <div className="flex-1">
                        <label htmlFor="edit-title" className="sr-only">Page title</label>
                        <input
                            id="edit-title"
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Page title"
                            className="w-full bg-transparent text-2xl font-semibold text-foreground outline-none placeholder:text-text-tertiary border-b border-border-subtle focus:border-sage-400 transition-colors duration-150"
                        />
                    </div>
                ) : (
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">
                            {document.title}
                        </h1>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary">
                            <Link
                                href={`/documents/${document.id}/versions`}
                                title="View version history"
                                className="flex items-center gap-1 text-sage-600 underline decoration-dotted underline-offset-2 transition-colors hover:text-sage-700"
                            >
                                <IconHistory className="h-3.5 w-3.5" stroke={1.5} />
                                {versionsCount} {versionsCount === 1 ? 'version' : 'versions'}
                            </Link>
                            {document.updater && (
                                <>
                                    <span>·</span>
                                    <span className="flex items-center gap-1">
                                        <IconUser className="h-3.5 w-3.5" stroke={1.5} />
                                        {document.updater.name}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-2 self-start">
                    {isEditing ? (
                        <>
                            {saveStatus === 'saving' && (
                                <span className="flex items-center gap-1 text-xs text-text-tertiary">
                                    <IconClock className="h-3.5 w-3.5 animate-pulse" stroke={1.5} />
                                    Saving…
                                </span>
                            )}
                            {saveStatus === 'saved' && (
                                <span className="flex items-center gap-1 text-xs text-sage-600">
                                    <IconCircleCheck className="h-3.5 w-3.5" stroke={1.5} />
                                    Saved
                                </span>
                            )}
                            <Button
                                onClick={handleExplicitSave}
                                className="bg-sage-400 hover:bg-sage-500 text-text-inverse"
                            >
                                <IconDeviceFloppy stroke={1.5} />
                                Save
                            </Button>
                            <Button
                                variant="outline"
                                className="border-border hover:bg-surface-hover"
                                onClick={requestLeave}
                            >
                                <IconX stroke={1.5} />
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <>
                            {perms.create && (
                                <Button
                                    variant="outline"
                                    className="border-border hover:bg-surface-hover"
                                    onClick={() => setExportOpen(true)}
                                >
                                    <IconDownload stroke={1.5} />
                                    Export
                                </Button>
                            )}
                            {perms.update && (
                                <Button
                                    variant="outline"
                                    className="border-border hover:bg-surface-hover"
                                    onClick={() => setIsEditing(true)}
                                >
                                    <IconPencil stroke={1.5} />
                                    Edit
                                </Button>
                            )}
                            {perms.update && workspaces.length > 1 && (
                                <Button
                                    variant="outline"
                                    className="border-border hover:bg-surface-hover"
                                    onClick={() => setMoveOpen(true)}
                                >
                                    <IconFolderSymlink stroke={1.5} />
                                    Move
                                </Button>
                            )}
                            {perms.delete && (
                                <Button
                                    variant="outline"
                                    className="border-border text-danger hover:bg-danger/10 hover:border-danger/20 hover:text-danger"
                                    onClick={destroyDocument}
                                >
                                    <IconTrash stroke={1.5} />
                                    Delete
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Tags — edit mode toggle */}
            {isEditing && (
                <div className="mt-4">
                    <p className="mb-2 text-xs font-medium text-text-secondary">Tags</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {allTags.map((tag) => {
                            const selected = editTags.includes(tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => handleTagToggle(tag.id)}
                                    className={`inline-flex cursor-pointer items-center rounded-sm border px-2.5 py-0.5 text-xs font-medium transition-all ${
                                        selected
                                            ? 'border-sage-200 bg-sage-100 text-sage-600'
                                            : 'border-border bg-surface text-text-secondary hover:bg-surface-hover'
                                    }`}
                                >
                                    <IconTag className="mr-1 h-3 w-3 opacity-60" stroke={1.5} />
                                    {tag.name}
                                </button>
                            );
                        })}

                        {showNewTag ? (
                            <form onSubmit={submitNewTag} className="flex items-center gap-1">
                                <input
                                    autoFocus
                                    type="text"
                                    value={newTagName}
                                    onChange={(e) => { setNewTagName(e.target.value); setNewTagError(''); }}
                                    onKeyDown={(e) => { if (e.key === 'Escape') { setShowNewTag(false); setNewTagName(''); setNewTagError(''); } }}
                                    placeholder="Tag name"
                                    className="h-[22px] w-28 rounded-sm border border-border bg-canvas px-2 text-xs text-foreground outline-none placeholder:text-text-tertiary focus:border-sage-400 focus:ring-[3px] focus:ring-sage-200"
                                />
                                <button
                                    type="submit"
                                    disabled={!newTagName.trim() || newTagProcessing}
                                    className="rounded-sm bg-sage-400 px-2 py-0.5 text-xs font-medium text-text-inverse hover:bg-sage-500 disabled:opacity-50"
                                >
                                    {newTagProcessing ? '…' : 'Add'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowNewTag(false); setNewTagName(''); setNewTagError(''); }}
                                    className="rounded-sm px-1.5 py-0.5 text-xs text-text-tertiary transition-colors hover:bg-surface-hover hover:text-foreground"
                                >
                                    Cancel
                                </button>
                            </form>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowNewTag(true)}
                                className="inline-flex items-center gap-1 rounded-sm border border-dashed border-border px-2 py-0.5 text-xs text-text-tertiary transition-colors hover:border-sage-300 hover:text-sage-600"
                            >
                                <IconPlus className="h-3 w-3" stroke={1.5} />
                                New tag
                            </button>
                        )}
                    </div>
                    {newTagError && (
                        <p className="mt-1 text-[11px] text-danger">{newTagError}</p>
                    )}
                </div>
            )}

            {/* Tags — read mode */}
            {!isEditing && document.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {document.tags.map((tag) => (
                        <Link
                            key={tag.id}
                            href={`/tags/${tag.id}`}
                            className="inline-flex items-center gap-1.5 rounded-md bg-sage-100 px-2 py-0.5 text-[11px] font-medium text-sage-600 transition-colors hover:bg-sage-200"
                        >
                            <IconTag className="h-3.5 w-3.5 shrink-0" stroke={1.5} />
                            {tag.name}
                        </Link>
                    ))}
                </div>
            )}

            {/* Content — full width */}
            <div className="mt-6">
                <Card className="overflow-clip">
                    {!isEditing && isDocEmpty(document.content) ? (
                        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sage-200 bg-sage-50">
                                <IconPencil className="h-6 w-6 text-sage-500" stroke={1.5} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">This page is empty</p>
                                <p className="mt-0.5 text-xs text-text-tertiary">Click Edit to start writing.</p>
                            </div>
                        </div>
                    ) : (
                        <TipTapEditor
                            key={isEditing ? 'edit' : 'view'}
                            content={document.content}
                            editable={isEditing}
                            suggestions={allDocuments}
                            resolvedLinks={resolvedLinks}
                            onUpdate={handleEditorUpdate}
                        />
                    )}
                </Card>
            </div>

            {/* Referenced by — pages that wiki-link here */}
            {!isEditing && backlinks.length > 0 && <BacklinksPanel backlinks={backlinks} />}

            {/* Page metadata strip */}
            <PageMeta document={document} versionsCount={versionsCount} />
            <ExportModal
                documentId={document.id}
                open={exportOpen}
                onClose={() => setExportOpen(false)}
            />
            <MoveModal
                open={moveOpen}
                onClose={() => setMoveOpen(false)}
                documentId={document.id}
                workspaces={workspaces}
                currentWorkspaceId={document.workspace.id}
            />
        </DocsLayout>

        <ConfirmDialog
            open={promptOpen}
            title="Discard changes?"
            message="You have unsaved changes. Leaving edit mode will discard them permanently."
            confirmLabel="Discard changes"
            cancelLabel="Keep editing"
            variant="danger"
            onConfirm={confirmDiscard}
            onCancel={dismissPrompt}
        />

        <ConfirmDialog
            open={deleteOpen}
            title={`Delete "${document.title}"?`}
            message="This page, along with any subpages, will be moved to Trash. You can restore it later from there."
            confirmLabel="Move to Trash"
            cancelLabel="Cancel"
            variant="danger"
            onConfirm={confirmDelete}
            onCancel={() => setDeleteOpen(false)}
        />
        </>
    );
}
