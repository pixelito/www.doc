import { Head, Link, useForm } from '@inertiajs/react';
import { FolderOpen, Plus } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function WorkspacesIndex({ workspaces }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        description: '',
    });

    function submit(e) {
        e.preventDefault();
        post('/workspaces', { onSuccess: () => reset() });
    }

    return (
        <AppLayout>
            <Head title="Workspaces" />
            <PageHeader
                title="Workspaces"
                description="Top-level containers for your documentation. Kept few and flat."
            />
            <Card className="mt-6 p-4">
                <form onSubmit={submit} className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-[200px]">
                        <Input
                            type="text"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="Workspace name (e.g. Network)"
                        />
                        {errors.name && <p className="mt-1.5 text-xs text-danger">{errors.name}</p>}
                    </div>
                    <div className="flex-[2] min-w-[200px]">
                        <Input
                            type="text"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Description (optional)"
                        />
                    </div>
                    <Button type="submit" disabled={processing}>
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                        Add
                    </Button>
                </form>
            </Card>
            {workspaces.length === 0 ? (
                <EmptyState
                    className="mt-8"
                    icon={FolderOpen}
                    title="No workspaces yet."
                    description="Create your first above."
                />
            ) : (
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {workspaces.map((w) => (
                        <Link key={w.id} href={`/workspaces/${w.id}`} className="group">
                            <Card className="p-4 transition-colors duration-150 hover:bg-surface-hover">
                                <h3 className="font-semibold text-foreground">{w.name}</h3>
                                {w.description && <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{w.description}</p>}
                                <p className="mt-3 text-xs text-text-tertiary">{w.documents_count} {w.documents_count === 1 ? 'page' : 'pages'}</p>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </AppLayout>
    );
}
