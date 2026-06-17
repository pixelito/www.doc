import React, { useState, useEffect } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { ChevronLeft, Trash2, Edit3, X, Save, FileText, ArrowRight, User, Calendar, Link2, Tag } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Helper to convert TipTap JSON to plain text
function fromTipTap(content) {
    if (!content || !content.content) return '';
    return content.content
        .map((node) => {
            if (node.type === 'paragraph' && node.content) {
                return node.content.map((c) => c.text).join('');
            }
            return '';
        })
        .filter((text) => text.trim() !== '')
        .join('\n\n');
}

// Helper to convert plain text back to TipTap JSON
function toTipTap(text) {
    const paragraphs = text.split('\n\n').filter((p) => p.trim() !== '');
    return {
        type: 'doc',
        content: paragraphs.map((p) => ({
            type: 'paragraph',
            content: [{ type: 'text', text: p.trim() }],
        })),
    };
}

export default function DocumentShow({ document, versionsCount, allTags = [] }) {
    const [isEditing, setIsEditing] = useState(false);
    const [plainText, setPlainText] = useState('');

    const { data, setData, patch, processing, errors, reset } = useForm({
        title: document.title,
        content: document.content,
        tags: document.tags.map((t) => t.id),
    });

    // Sync plain text state and form content state
    useEffect(() => {
        setPlainText(fromTipTap(document.content));
        setData({
            title: document.title,
            content: document.content,
            tags: document.tags.map((t) => t.id),
        });
    }, [document]);

    // Whenever plainText updates, convert and sync it to form's content
    useEffect(() => {
        setData('content', toTipTap(plainText));
    }, [plainText]);

    function destroyDocument() {
        if (confirm(`Delete page "${document.title}"?`)) {
            router.delete(`/documents/${document.id}`);
        }
    }

    function handleTagToggle(tagId) {
        if (data.tags.includes(tagId)) {
            setData('tags', data.tags.filter((id) => id !== tagId));
        } else {
            setData('tags', [...data.tags, tagId]);
        }
    }

    function submit(e) {
        e.preventDefault();
        patch(`/documents/${document.id}`, {
            onSuccess: () => setIsEditing(false),
        });
    }

    // Helper to render wiki-links dynamically
    function renderTextWithWikiLinks(text, outgoingLinks) {
        if (!text) return '';
        const parts = text.split(/(\[\[[^\]]+\]\])/g);

        return parts.map((part, index) => {
            if (part.startsWith('[[') && part.endsWith(']]')) {
                const title = part.slice(2, -2).trim();
                const linkObj = outgoingLinks.find(
                    (l) => l.target_title.toLowerCase() === title.toLowerCase()
                );

                if (linkObj && linkObj.target) {
                    return (
                        <Link
                            key={index}
                            href={`/documents/${linkObj.target.id}`}
                            className="font-medium text-sage-600 underline decoration-sage-400 decoration-1 underline-offset-2 hover:text-sage-800 transition-colors"
                        >
                            {title}
                        </Link>
                    );
                } else {
                    return (
                        <span
                            key={index}
                            className="font-medium text-text-tertiary border-b border-dashed border-text-tertiary cursor-help"
                            title="Page does not exist yet inside this workspace"
                        >
                            {title}
                        </span>
                    );
                }
            }
            return part;
        });
    }

    // Custom TipTap renderer
    function TipTapRenderer({ content, outgoingLinks = [] }) {
        if (!content || !content.content || content.content.length === 0) {
            return <p className="text-text-tertiary italic">No content available on this page.</p>;
        }

        return (
            <div className="space-y-4">
                {content.content.map((node, index) => {
                    if (node.type === 'paragraph') {
                        const textContent = node.content?.map((c) => {
                            if (c.type === 'text') {
                                return renderTextWithWikiLinks(c.text, outgoingLinks);
                            }
                            return null;
                        });
                        return (
                            <p key={index} className="text-text-primary leading-relaxed text-base">
                                {textContent}
                            </p>
                        );
                    }
                    return null;
                })}
            </div>
        );
    }

    return (
        <AppLayout>
            <Head title={document.title} />

            {/* Breadcrumb Navigation */}
            <div className="flex items-center justify-between">
                <Link
                    href={`/workspaces/${document.workspace.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors duration-150 hover:text-foreground"
                >
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                    {document.workspace.name}
                </Link>
            </div>

            {/* Edit / Normal Header */}
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                {!isEditing ? (
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{document.title}</h1>
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
                ) : (
                    <div className="flex-1">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Editing Page</h1>
                        <p className="mt-1 text-sm text-text-secondary">Modify title, tags, or page content below.</p>
                    </div>
                )}

                <div className="flex items-center gap-2 self-start">
                    {!isEditing ? (
                        <>
                            <Button
                                variant="outline"
                                className="border-border hover:bg-surface-hover hover:text-foreground"
                                onClick={() => setIsEditing(true)}
                            >
                                <Edit3 className="h-4 w-4" strokeWidth={1.5} />
                                Edit page
                            </Button>
                            <Button
                                variant="outline"
                                className="border-border text-danger hover:bg-danger/10 hover:text-danger hover:border-danger/20"
                                onClick={destroyDocument}
                            >
                                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                Delete
                            </Button>
                        </>
                    ) : null}
                </div>
            </div>

            {/* Static Tags List */}
            {!isEditing && document.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                    {document.tags.map((tag) => (
                        <Badge key={tag.id} variant="default">
                            <Tag className="mr-1 h-3 w-3 text-sage-600/70" strokeWidth={1.5} />
                            {tag.name}
                        </Badge>
                    ))}
                </div>
            )}

            {/* Main Content Layout */}
            {isEditing ? (
                <Card className="mt-6">
                    <CardContent className="p-6">
                        <form onSubmit={submit} className="space-y-6">
                            {/* Edit Title */}
                            <div>
                                <Label htmlFor="edit-title" className="text-sm font-semibold">Title</Label>
                                <Input
                                    id="edit-title"
                                    type="text"
                                    value={data.title}
                                    onChange={(e) => setData('title', e.target.value)}
                                    className="mt-1.5 text-lg font-medium"
                                    placeholder="Enter page title"
                                    required
                                />
                                {errors.title && <p className="mt-1.5 text-xs text-danger">{errors.title}</p>}
                            </div>

                            {/* Edit Tags */}
                            {allTags.length > 0 && (
                                <div>
                                    <Label className="text-sm font-semibold">Tags</Label>
                                    <p className="text-xs text-text-secondary mt-0.5">Toggle labels applicable to this document.</p>
                                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                                        {allTags.map((tag) => {
                                            const isSelected = data.tags.includes(tag.id);
                                            return (
                                                <button
                                                    key={tag.id}
                                                    type="button"
                                                    onClick={() => handleTagToggle(tag.id)}
                                                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-all border ${
                                                        isSelected
                                                            ? 'bg-sage-400 border-sage-500 text-text-inverse shadow-sm'
                                                            : 'bg-surface border-border text-text-secondary hover:bg-surface-hover hover:text-foreground'
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

                            {/* Edit Content */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="edit-content" className="text-sm font-semibold">Content</Label>
                                    <span className="text-[11px] text-text-tertiary">Separate paragraphs with double enter</span>
                                </div>
                                <textarea
                                    id="edit-content"
                                    rows={12}
                                    value={plainText}
                                    onChange={(e) => setPlainText(e.target.value)}
                                    placeholder="Write your documentation here... Add double square brackets around page titles to link them together, e.g. [[Local Environment Setup]]"
                                    className="mt-1.5 w-full rounded-md border border-border bg-surface px-4 py-3 text-base text-foreground font-sans leading-relaxed outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-sage-400 focus-visible:ring-[3px] focus-visible:ring-sage-200"
                                />
                                <div className="mt-1.5 flex items-center justify-between text-xs text-text-tertiary">
                                    <span>Supports [[Wiki Links]] for internal cross-references.</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3 border-t border-border/60 pt-5">
                                <Button type="submit" disabled={processing} className="bg-sage-400 hover:bg-sage-500 text-text-inverse">
                                    <Save className="h-4 w-4" strokeWidth={1.5} />
                                    Save changes
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-border hover:bg-surface-hover"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setPlainText(fromTipTap(document.content));
                                    }}
                                >
                                    <X className="h-4 w-4" strokeWidth={1.5} />
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : (
                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
                    {/* Main Document Body */}
                    <Card className="flex flex-col p-6 sm:p-8 min-h-[400px]">
                        <TipTapRenderer content={document.content} outgoingLinks={document.outgoing_links} />
                    </Card>

                    {/* Sidebar Links & Connections */}
                    <aside className="space-y-6">
                        {/* Outgoing Links Card */}
                        <Card className="overflow-hidden">
                            <CardHeader className="bg-surface-hover border-b border-border/40 py-3 px-4">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                                    <Link2 className="h-3.5 w-3.5 text-sage-600" strokeWidth={1.5} />
                                    Outgoing Links
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                {document.outgoing_links.length === 0 ? (
                                    <p className="text-xs text-text-tertiary py-1">This page links to no other pages.</p>
                                ) : (
                                    <ul className="space-y-2.5">
                                        {document.outgoing_links.map((link) => (
                                            <li key={link.id} className="flex items-center text-sm">
                                                <ArrowRight className="mr-2 h-3.5 w-3.5 text-text-tertiary shrink-0" strokeWidth={1.5} />
                                                {link.target ? (
                                                    <Link
                                                        href={`/documents/${link.target.id}`}
                                                        className="font-medium text-sage-600 hover:text-sage-800 hover:underline transition-colors truncate"
                                                    >
                                                        {link.target.title}
                                                    </Link>
                                                ) : (
                                                    <span className="text-text-secondary italic truncate" title="Target page does not exist yet.">
                                                        {link.target_title}{' '}
                                                        <span className="text-[10px] rounded-sm bg-border-subtle px-1 text-text-tertiary font-sans not-italic">
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

                        {/* Backlinks Card */}
                        <Card className="overflow-hidden">
                            <CardHeader className="bg-surface-hover border-b border-border/40 py-3 px-4">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                                    <FileText className="h-3.5 w-3.5 text-sage-600" strokeWidth={1.5} />
                                    Incoming Backlinks
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                {document.backlinks.length === 0 ? (
                                    <p className="text-xs text-text-tertiary py-1">No pages link here yet.</p>
                                ) : (
                                    <ul className="space-y-2.5">
                                        {document.backlinks.map((link) => (
                                            <li key={link.id} className="flex items-center text-sm">
                                                <ArrowRight className="mr-2 h-3.5 w-3.5 text-text-tertiary shrink-0" strokeWidth={1.5} />
                                                <Link
                                                    href={`/documents/${link.source.id}`}
                                                    className="font-medium text-sage-600 hover:text-sage-800 hover:underline transition-colors truncate"
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
            )}
        </AppLayout>
    );
}
