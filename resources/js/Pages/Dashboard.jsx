import { Head, Link, usePage } from '@inertiajs/react';
import { FolderOpen, Tag } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';

export default function Dashboard() {
    const { auth } = usePage().props;

    return (
        <AppLayout>
            <Head title="Dashboard" />

            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Welcome, {auth.user.name}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
                User #{auth.user.id} &middot; {auth.user.email}
            </p>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Link
                    href="/workspaces"
                    className="group flex items-start gap-3 rounded-md border border-border bg-card p-5 transition-colors duration-150 hover:bg-surface-hover"
                >
                    <FolderOpen className="mt-0.5 h-5 w-5 text-sage-600" strokeWidth={1.5} />
                    <div>
                        <h3 className="font-semibold text-foreground">Workspaces</h3>
                        <p className="mt-1 text-sm text-text-secondary">
                            Browse and organise your documentation.
                        </p>
                    </div>
                </Link>

                <Link
                    href="/tags"
                    className="group flex items-start gap-3 rounded-md border border-border bg-card p-5 transition-colors duration-150 hover:bg-surface-hover"
                >
                    <Tag className="mt-0.5 h-5 w-5 text-sage-600" strokeWidth={1.5} />
                    <div>
                        <h3 className="font-semibold text-foreground">Tags</h3>
                        <p className="mt-1 text-sm text-text-secondary">
                            Cross-cutting labels across workspaces.
                        </p>
                    </div>
                </Link>
            </div>
        </AppLayout>
    );
}
