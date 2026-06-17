import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, Trash2 } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export default function DocumentShow({ document, versionsCount }) {
    function destroyDocument() {
        if (confirm(`Delete page "${document.title}"?`)) {
            router.delete(`/documents/${document.id}`);
        }
    }

    return (
        <AppLayout>
            <Head title={document.title} />
            <Link href={`/workspaces/${document.workspace.id}`} className="inline-flex items-center gap-1 text-sm text-text-secondary transition-colors duration-150 hover:text-foreground">
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                {document.workspace.name}
            </Link>
            <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">{document.title}</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        {versionsCount} {versionsCount === 1 ? 'version' : 'versions'}
                        {document.updater ? ` · last edited by ${document.updater.name}` : ''}
                    </p>
                </div>
                <Button variant="outline" className="text-danger hover:text-danger" onClick={destroyDocument}>
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    Delete
                </Button>
            </div>
            {document.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {document.tags.map((tag) => (<Badge key={tag.id}>{tag.name}</Badge>))}
                </div>
            )}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
                <Card className="p-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.05em] text-text-tertiary">Content (canonical JSON)</p>
                    <pre className="overflow-x-auto rounded-sm bg-surface-hover p-3 font-mono text-xs leading-relaxed text-text-primary">
                        {JSON.stringify(document.content, null, 2)}
                    </pre>
                </Card>
                <aside className="space-y-6">
                    <Card className="p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.05em] text-text-tertiary">Backlinks</p>
                        {document.backlinks.length === 0 ? (
                            <p className="text-sm text-text-tertiary">No pages link here yet.</p>
                        ) : (
                            <ul className="space-y-1">
                                {document.backlinks.map((link) => (
                                    <li key={link.id}>
                                        <Link href={`/documents/${link.source.id}`} className="text-sm text-sage-600 transition-colors duration-150 hover:underline">
                                            {link.source.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                    <Card className="p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.05em] text-text-tertiary">Links out</p>
                        {document.outgoing_links.length === 0 ? (
                            <p className="text-sm text-text-tertiary">This page links nowhere yet.</p>
                        ) : (
                            <ul className="space-y-1">
                                {document.outgoing_links.map((link) => (
                                    <li key={link.id} className="text-sm">
                                        {link.target ? (
                                            <Link href={`/documents/${link.target.id}`} className="text-sage-600 transition-colors duration-150 hover:underline">
                                                {link.target.title}
                                            </Link>
                                        ) : (
                                            <span className="text-text-tertiary">
                                                {link.target_title}{' '}
                                                <span className="text-[11px]">(unresolved)</span>
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </aside>
            </div>
        </AppLayout>
    );
}
