import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    ChevronLeft, Trash2, Edit3, X, Save, FileText,
    ArrowRight, User, Calendar, Link2, Tag, CheckCircle2, Clock,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TipTapEditor from '@/components/editor/TipTapEditor';

const AUTOSAVE_DELAY_MS = 2000;

export default function DocumentShow({ document, versionsCount, allTags = [], allDocuments = [] }) {
    const [isEditing, setIsEditing] = useState(false);

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
                    preserveState: true,
                    preserveScroll: true,
                    onSuccess: () => setSaveStatus('saved'),
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
            <div className="flex items-center justify-between">
                <Link
                    href={`/workspaces/${document.workspace.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors duration-150 hover:text-foreground"
                >
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                    {document.workspace.name}
                </Link>
            </div>

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
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} />
                                {versionsCount} {versionsCount === 1 ? 'version' : 'versions'}
                            </span>
                            {document.updater && (
                                <>
                                    <span className="text-text-tertiary">•</span>
                                    <span className="flex items-center gap-1">
                                        <User className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} />
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
                                    <Clock className="h-3.5 w-3.5 animate-pulse" strokeWidth={1.5} />
                                    Saving…
                                </span>
                            )}
                            {saveStatus === 'saved' && (
                                <span className="flex items-center gap-1 text-xs text-sage-600">
                                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                                    Saved
                                </span>
                            )}
                            <Button
                                onClick={handleExplicitSave}
                                className="bg-sage-400 hover:bg-sage-500 text-text-inverse"
                            >
                                <Save className="h-4 w-4" strokeWidth={1.5} />
                                Save
                            </Button>
                            <Button
                                variant="outline"
                                className="border-border hover:bg-surface-hover"
                                onClick={handleCancelEdit}
                            >
                                <X className="h-4 w-4" strokeWidth={1.5} />
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                className="border-border hover:bg-surface-hover"
                                onClick={() => setIsEditing(true)}
                            >
                                <Edit3 className="h-4 w-4" strokeWidth={1.5} />
                                Edit
                            </Button>
                            <Button
                                variant="outline"
                                className="border-border text-danger hover:bg-danger/10 hover:border-danger/20 hover:text-danger"
                                onClick={destroyDocument}
                            >
                                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
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
                                    className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                                        selected
                                            ? 'border-sage-200 bg-sage-100 text-sage-700'
                                            : 'border-border bg-surface text-text-secondary hover:bg-surface-hover'
                                    }`}
                                >
                                    <Tag className="mr-1 h-3 w-3 opacity-60" strokeWidth={1.5} />
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
                            <Tag className="mr-1 h-3 w-3" strokeWidth={1.5} />
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
                                <Link2 className="h-3.5 w-3.5 text-sage-600" strokeWidth={1.5} />
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
                                            <ArrowRight className="mr-2 h-3.5 w-3.5 shrink-0 text-text-tertiary" strokeWidth={1.5} />
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
                                <FileText className="h-3.5 w-3.5 text-sage-600" strokeWidth={1.5} />
                                Incoming Backlinks
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            {document.backlinks.length === 0 ? (
                                <p className="py-1 text-xs text-text-tertiary">
                                    No pages link here yet.
                                </p>
                            ) : (
                                <ul className="space-y-2.5">
                                    {document.backlinks.map((link) => (
                                        <li key={link.id} className="flex items-center text-sm">
                                            <ArrowRight className="mr-2 h-3.5 w-3.5 shrink-0 text-text-tertiary" strokeWidth={1.5} />
                                            <Link
                                                href={`/documents/${link.source.id}`}
                                                className="truncate font-medium text-sage-600 transition-colors hover:text-sage-800 hover:underline"
                                            >
                                                {link.source.title}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </aside>
            </div>
        </AppLayout>
    );
}
