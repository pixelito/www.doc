import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    IconChevronRight, IconTrash, IconPencil, IconX, IconDeviceFloppy, IconFileText,
    IconArrowRight, IconUser, IconCalendar, IconLink, IconTag, IconCircleCheck, IconClock,
    IconDownload, IconLoader2, IconHistory,
} from '@tabler/icons-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import TipTapEditor from '@/components/editor/TipTapEditor';

const CSRF = () => document.querySelector('meta[name="csrf-token"]')?.content ?? '';

function ExportModal({ documentId, open, onClose }) {
    const [format, setFormat]   = useState('pdf');
    const [state, setState]     = useState('idle'); // idle | pending | done | failed
    const [error, setError]     = useState(null);
    const pollRef               = useRef(null);
    const jobIdRef              = useRef(null);

    function reset() {
        clearInterval(pollRef.current);
        setState('idle');
        setError(null);
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
        window.location.href = `/documents/${documentId}/exports/${jobIdRef.current}?download=1`;
    }

    useEffect(() => () => clearInterval(pollRef.current), []);

    const formats = [
        { value: 'pdf',  label: 'PDF',  description: 'Print-ready with headers, page numbers & TOC' },
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
                                className={`w-full rounded-md border px-4 py-3 text-left transition-all ${
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
                                <IconDownload className="mr-1.5 h-4 w-4" stroke={1.5} />
                                Export
                            </Button>
                        </div>
                    </div>
                )}

                {/* Pending */}
                {state === 'pending' && (
                    <div className="flex flex-col items-center gap-3 py-8 text-text-secondary">
                        <IconLoader2 className="h-8 w-8 animate-spin text-sage-400" stroke={1.5} />
                        <p className="text-sm">Generating {format.toUpperCase()}…</p>
                    </div>
                )}

                {/* Done */}
                {state === 'done' && (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <IconCircleCheck className="h-10 w-10 text-sage-400" stroke={1.5} />
                        <p className="text-sm font-medium text-text-primary">Your file is ready!</p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleClose}>Close</Button>
                            <Button
                                className="bg-sage-400 hover:bg-sage-500 text-text-inverse"
                                onClick={triggerDownload}
                            >
                                <IconDownload className="mr-1.5 h-4 w-4" stroke={1.5} />
                                Download {format.toUpperCase()}
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

const AUTOSAVE_DELAY_MS = 2000;

export default function DocumentShow({ document, versionsCount, breadcrumbs = [], allTags = [], allDocuments = [] }) {
    const [isEditing, setIsEditing]     = useState(false);
    const [exportOpen, setExportOpen]   = useState(false);

    const [editTitle, setEditTitle] = useState(document.title);
    const [editTags, setEditTags] = useState(document.tags.map((t) => t.id));

    // Holds the latest JSON from the editor without triggering re-renders
    const editorContentRef = useRef(document.content);

    const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved'
    const autosaveTimer = useRef(null);

    // Build resolvedLinks map: { "Page Title": "/documents/id" }
    const resolvedLinks = Object.fromEntries(
        (document.outgoing_links ?? [])
            .filter((l) => l.target)
            .map((l) => [l.target_title, `/documents/${l.target.id}`])
    );

    // Reset form fields when entering edit mode
    useEffect(() => {
        if (isEditing) {
            setEditTitle(document.title);
            setEditTags(document.tags.map((t) => t.id));
            editorContentRef.current = document.content;
            setSaveStatus(null);
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

    const handleEditorUpdate = useCallback(
        (json) => {
            editorContentRef.current = json;
            setSaveStatus('saving');
            clearTimeout(autosaveTimer.current);
            autosaveTimer.current = setTimeout(() => {
                performSave(json);
            }, AUTOSAVE_DELAY_MS);
        },
        [performSave]
    );

    function handleExplicitSave(e) {
        e.preventDefault();
        clearTimeout(autosaveTimer.current);
        performSave(editorContentRef.current);
    }

    function handleCancelEdit() {
        clearTimeout(autosaveTimer.current);
        setIsEditing(false);
        setSaveStatus(null);
    }

    function handleTagToggle(tagId) {
        setEditTags((prev) =>
            prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
        );
    }

    function destroyDocument() {
        if (confirm(`Delete page "${document.title}"?`)) {
            router.delete(`/documents/${document.id}`);
        }
    }

    return (
        <AppLayout>
            <Head title={document.title} />

            {/* Breadcrumb */}
            <nav className="flex flex-wrap items-center gap-1 text-sm text-text-secondary">
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
                        <Label htmlFor="edit-title" className="sr-only">Page title</Label>
                        <Input
                            id="edit-title"
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="text-2xl font-semibold"
                            placeholder="Page title"
                        />
                    </div>
                ) : (
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            {document.title}
                        </h1>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-text-secondary">
                            <Link
                                href={`/documents/${document.id}/versions`}
                                className="flex items-center gap-1 hover:text-sage-600 transition-colors"
                            >
                                <IconHistory className="h-3.5 w-3.5 text-text-tertiary" stroke={1.5} />
                                {versionsCount} {versionsCount === 1 ? 'version' : 'versions'}
                            </Link>
                            {document.updater && (
                                <>
                                    <span className="text-text-tertiary">•</span>
                                    <span className="flex items-center gap-1">
                                        <IconUser className="h-3.5 w-3.5 text-text-tertiary" stroke={1.5} />
                                        Edited by {document.updater.name}
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
                                <IconDeviceFloppy className="h-4 w-4" stroke={1.5} />
                                Save
                            </Button>
                            <Button
                                variant="outline"
                                className="border-border hover:bg-surface-hover"
                                onClick={handleCancelEdit}
                            >
                                <IconX className="h-4 w-4" stroke={1.5} />
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                className="border-border hover:bg-surface-hover"
                                onClick={() => setExportOpen(true)}
                            >
                                <IconDownload className="h-4 w-4" stroke={1.5} />
                                Export
                            </Button>
                            <Button
                                variant="outline"
                                className="border-border hover:bg-surface-hover"
                                onClick={() => setIsEditing(true)}
                            >
                                <IconPencil className="h-4 w-4" stroke={1.5} />
                                Edit
                            </Button>
                            <Button
                                variant="outline"
                                className="border-border text-danger hover:bg-danger/10 hover:border-danger/20 hover:text-danger"
                                onClick={destroyDocument}
                            >
                                <IconTrash className="h-4 w-4" stroke={1.5} />
                                Delete
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Tags — edit mode toggle */}
            {isEditing && allTags.length > 0 && (
                <div className="mt-4">
                    <p className="mb-2 text-xs font-medium text-text-secondary">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                        {allTags.map((tag) => {
                            const selected = editTags.includes(tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => handleTagToggle(tag.id)}
                                    className={`inline-flex cursor-pointer items-center rounded-md border px-3 py-1 text-xs font-medium transition-all ${
                                        selected
                                            ? 'border-sage-200 bg-sage-100 text-sage-700'
                                            : 'border-border bg-surface text-text-secondary hover:bg-surface-hover'
                                    }`}
                                >
                                    <IconTag className="mr-1 h-3 w-3 opacity-60" stroke={1.5} />
                                    {tag.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Tags — read mode */}
            {!isEditing && document.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                    {document.tags.map((tag) => (
                        <Badge key={tag.id} variant="default">
                            <IconTag className="mr-1 h-3 w-3" stroke={1.5} />
                            {tag.name}
                        </Badge>
                    ))}
                </div>
            )}

            {/* Content + sidebar */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
                <Card className="overflow-hidden">
                    <TipTapEditor
                        key={isEditing ? 'edit' : 'view'}
                        content={document.content}
                        editable={isEditing}
                        suggestions={allDocuments}
                        resolvedLinks={resolvedLinks}
                        onUpdate={handleEditorUpdate}
                    />
                </Card>

                <aside className="space-y-6">
                    <Card className="overflow-hidden">
                        <CardHeader className="border-b border-border/40 bg-surface-hover py-3 px-4">
                            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                                <IconLink className="h-3.5 w-3.5 text-sage-600" stroke={1.5} />
                                Outgoing Links
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            {document.outgoing_links.length === 0 ? (
                                <p className="py-1 text-xs text-text-tertiary">
                                    This page links nowhere yet.
                                </p>
                            ) : (
                                <ul className="space-y-2.5">
                                    {document.outgoing_links.map((link) => (
                                        <li key={link.id} className="flex items-center text-sm">
                                            <IconArrowRight className="mr-2 h-3.5 w-3.5 shrink-0 text-text-tertiary" stroke={1.5} />
                                            {link.target ? (
                                                <Link
                                                    href={`/documents/${link.target.id}`}
                                                    className="truncate font-medium text-sage-600 transition-colors hover:text-sage-800 hover:underline"
                                                >
                                                    {link.target.title}
                                                </Link>
                                            ) : (
                                                <span className="truncate italic text-text-secondary">
                                                    {link.target_title}{' '}
                                                    <span className="not-italic rounded-sm bg-border-subtle px-1 text-[10px] font-sans text-text-tertiary">
                                                        broken
                                                    </span>
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="overflow-hidden">
                        <CardHeader className="border-b border-border/40 bg-surface-hover py-3 px-4">
                            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                                <IconFileText className="h-3.5 w-3.5 text-sage-600" stroke={1.5} />
                                Incoming Backlinks
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            {document.backlinks.length === 0 ? (
                                <p className="py-1 text-xs text-text-tertiary">
                                    No pages link here yet.
                                </p>
                            ) : (
                                <ul className="space-y-3">
                                    {document.backlinks.map((link) => (
                                        <li key={link.id}>
                                            <Link
                                                href={`/documents/${link.source.id}`}
                                                className="flex items-center gap-1.5 text-sm font-medium text-sage-600 transition-colors hover:text-sage-800 hover:underline"
                                            >
                                                <IconArrowRight className="h-3 w-3 shrink-0" stroke={1.5} />
                                                {link.source.title}
                                            </Link>
                                            {link.context && (
                                                <p className="mt-0.5 pl-4 text-xs text-text-tertiary leading-relaxed line-clamp-2">
                                                    {link.context}
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </aside>
            </div>
            <ExportModal
                documentId={document.id}
                open={exportOpen}
                onClose={() => setExportOpen(false)}
            />
        </AppLayout>
    );
}
