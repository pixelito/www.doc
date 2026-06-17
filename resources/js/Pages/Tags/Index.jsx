import { Head, useForm, router } from '@inertiajs/react';
import { Plus, Trash2, Tag as TagIcon } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';

export default function TagsIndex({ tags }) {
    const { data, setData, post, processing, errors, reset } = useForm({ name: '' });

    function submit(e) {
        e.preventDefault();
        post('/tags', { onSuccess: () => reset() });
    }

    function destroyTag(tag) {
        if (confirm(`Delete tag "${tag.name}"?`)) {
            router.delete(`/tags/${tag.id}`);
        }
    }

    return (
        <AppLayout>
            <Head title="Tags" />
            <PageHeader
                title="Tags"
                description="Cross-cutting labels that span workspaces."
            />
            <Card className="mt-6 p-4">
                <form onSubmit={submit} className="flex items-start gap-3">
                    <div className="flex-1">
                        <Input
                            type="text"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="Tag name (e.g. production)"
                        />
                        {errors.name && <p className="mt-1.5 text-xs text-danger">{errors.name}</p>}
                    </div>
                    <Button type="submit" disabled={processing}>
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                        Add
                    </Button>
                </form>
            </Card>
            {tags.length === 0 ? (
                <EmptyState
                    className="mt-8"
                    icon={TagIcon}
                    title="No tags yet."
                />
            ) : (
                <Card className="mt-6">
                    <ul className="divide-y divide-border-subtle">
                        {tags.map((tag) => (
                            <li key={tag.id} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Badge>{tag.name}</Badge>
                                    <span className="text-xs text-text-tertiary">{tag.documents_count} {tag.documents_count === 1 ? 'page' : 'pages'}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => destroyTag(tag)}
                                    aria-label={`Delete ${tag.name}`}
                                    className="text-text-tertiary hover:text-danger"
                                >
                                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </AppLayout>
    );
}
