import React, { useState, useEffect } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { ChevronLeft, FileText, GripVertical, Plus, Trash2 } from 'lucide-react';
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    arrayMove,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Non-draggable child node (depth > 0). */
function TreeNode({ node, depth }) {
    return (
        <li>
            <Link
                href={`/documents/${node.id}`}
                style={{ paddingLeft: `${depth * 16 + 28}px` }}
                className="flex items-center gap-2 rounded-sm py-1.5 pr-2 text-sm text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-foreground"
            >
                <FileText className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.5} />
                <span className="truncate">{node.title}</span>
            </Link>
            {node.children.length > 0 && (
                <ul>
                    {node.children.map((child) => (
                        <TreeNode key={child.id} node={child} depth={depth + 1} />
                    ))}
                </ul>
            )}
        </li>
    );
}

/** Draggable root-level node. Children are rendered as regular TreeNodes. */
function SortableRootNode({ node }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: String(node.id) });

    return (
        <li
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.4 : 1,
            }}
        >
            <div className="flex items-center gap-1 rounded-sm pr-2 text-sm text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-foreground">
                {/* Drag handle */}
                <button
                    type="button"
                    {...listeners}
                    {...attributes}
                    className="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center text-text-tertiary opacity-0 group-hover:opacity-100 focus:opacity-100 active:cursor-grabbing"
                    tabIndex={-1}
                    aria-label="Drag to reorder"
                >
                    <GripVertical className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                <Link
                    href={`/documents/${node.id}`}
                    className="flex flex-1 items-center gap-2 py-1.5"
                >
                    <FileText className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.5} />
                    <span className="truncate">{node.title}</span>
                </Link>
            </div>
            {node.children.length > 0 && (
                <ul>
                    {node.children.map((child) => (
                        <TreeNode key={child.id} node={child} depth={1} />
                    ))}
                </ul>
            )}
        </li>
    );
}

function flatten(nodes, depth = 0, acc = []) {
    for (const node of nodes) {
        acc.push({ id: node.id, label: `${'  '.repeat(depth)}${node.title}` });
        flatten(node.children, depth + 1, acc);
    }
    return acc;
}

export default function WorkspaceShow({ workspace, tree }) {
    const [rootNodes, setRootNodes] = useState(tree);

    // Sync local state when the server-side tree prop changes (after reorder confirm).
    useEffect(() => {
        setRootNodes(tree);
    }, [tree]);

    const options = flatten(rootNodes);
    const { data, setData, post, processing, errors, reset } = useForm({
        title: '',
        parent_id: '',
        workspace_id: workspace.id,
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
    );

    function handleDragEnd({ active, over }) {
        if (!over || active.id === over.id) return;

        const oldIndex = rootNodes.findIndex((n) => String(n.id) === active.id);
        const newIndex = rootNodes.findIndex((n) => String(n.id) === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(rootNodes, oldIndex, newIndex);
        setRootNodes(reordered);

        router.patch(
            '/documents/reorder',
            { ids: reordered.map((n) => n.id) },
            { preserveState: true, preserveScroll: true }
        );
    }

    function submit(e) {
        e.preventDefault();
        post('/documents', { onSuccess: () => reset('title', 'parent_id') });
    }

    function destroyWorkspace() {
        if (confirm(`Delete workspace "${workspace.name}" and all its pages?`)) {
            router.delete(`/workspaces/${workspace.id}`);
        }
    }

    return (
        <AppLayout>
            <Head title={workspace.name} />
            <Link
                href="/workspaces"
                className="inline-flex items-center gap-1 text-sm text-text-secondary transition-colors duration-150 hover:text-foreground"
            >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                Workspaces
            </Link>
            <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        {workspace.name}
                    </h1>
                    {workspace.description && (
                        <p className="mt-1 text-sm text-text-secondary">{workspace.description}</p>
                    )}
                </div>
                <Button
                    variant="outline"
                    className="border-border text-danger hover:bg-danger/10 hover:border-danger/20 hover:text-danger"
                    onClick={destroyWorkspace}
                >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    Delete
                </Button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
                {/* Tree sidebar with drag-reorder */}
                <Card className="p-2">
                    <p className="px-2 py-1 text-xs font-medium uppercase tracking-[0.05em] text-text-tertiary">
                        Pages
                    </p>
                    {rootNodes.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-text-tertiary">No pages yet.</p>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={rootNodes.map((n) => String(n.id))}
                                strategy={verticalListSortingStrategy}
                            >
                                <ul className="group mt-1">
                                    {rootNodes.map((node) => (
                                        <SortableRootNode key={node.id} node={node} />
                                    ))}
                                </ul>
                            </SortableContext>
                        </DndContext>
                    )}
                </Card>

                {/* New page form */}
                <section>
                    <Card>
                        <CardHeader>
                            <CardTitle>New page</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submit} className="space-y-4">
                                <div>
                                    <Label htmlFor="title">Title</Label>
                                    <Input
                                        id="title"
                                        type="text"
                                        value={data.title}
                                        onChange={(e) => setData('title', e.target.value)}
                                        placeholder="Page title"
                                    />
                                    {errors.title && (
                                        <p className="mt-1.5 text-xs text-danger">{errors.title}</p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="parent_id">
                                        Parent page{' '}
                                        <span className="text-text-tertiary">(optional)</span>
                                    </Label>
                                    <select
                                        id="parent_id"
                                        value={data.parent_id}
                                        onChange={(e) => setData('parent_id', e.target.value)}
                                        className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-sage-400 focus-visible:ring-[3px] focus-visible:ring-sage-200"
                                    >
                                        <option value="">— None (top level) —</option>
                                        {options.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <Button type="submit" disabled={processing}>
                                    <Plus className="h-4 w-4" strokeWidth={1.5} />
                                    Create page
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </section>
            </div>
        </AppLayout>
    );
}
