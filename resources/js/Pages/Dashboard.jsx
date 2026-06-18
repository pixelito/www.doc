import { Head, Link, usePage } from '@inertiajs/react';
import { IconFolderOpen, IconTag } from '@tabler/icons-react';
import AppLayout from '@/Layouts/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';

export default function Dashboard() {
    const { auth } = usePage().props;

    return (
        <AppLayout>
            <Head title="Dashboard" />
            <PageHeader title={`Welcome, ${auth.user.name}`} />
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Link href="/workspaces" className="group">
                    <Card className="flex items-start gap-3 p-5 transition-colors duration-150 hover:bg-surface-hover">
                        <IconFolderOpen className="mt-0.5 h-5 w-5 text-sage-600" stroke={1.5} />
                        <div>
                            <h3 className="font-semibold text-foreground">Workspaces</h3>
                            <p className="mt-1 text-sm text-text-secondary">Browse and organise your documentation.</p>
                        </div>
                    </Card>
                </Link>
                <Link href="/tags" className="group">
                    <Card className="flex items-start gap-3 p-5 transition-colors duration-150 hover:bg-surface-hover">
                        <IconTag className="mt-0.5 h-5 w-5 text-sage-600" stroke={1.5} />
                        <div>
                            <h3 className="font-semibold text-foreground">Tags</h3>
                            <p className="mt-1 text-sm text-text-secondary">Cross-cutting labels across workspaces.</p>
                        </div>
                    </Card>
                </Link>
            </div>
        </AppLayout>
    );
}
