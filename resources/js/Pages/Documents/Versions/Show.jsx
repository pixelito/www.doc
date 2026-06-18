import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { IconChevronRight, IconHistory, IconArrowBack } from '@tabler/icons-react';
import DocsLayout from '@/Layouts/DocsLayout';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const CSRF = () => document.querySelector('meta[name="csrf-token"]')?.content ?? '';

function timeAgo(ts) {
    const d = new Date(ts.replace(' ', 'T') + 'Z');
    return d.toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function VersionShow({ document: doc, workspace, version }) {
    const [restoreOpen, setRestoreOpen] = useState(false);

    function confirmRestore() {
        setRestoreOpen(false);
        router.post(
            `/documents/${doc.id}/versions/${version.id}/restore`,
            {},
            { headers: { 'X-CSRF-TOKEN': CSRF() } }
        );
    }

    return (
        <>
        <DocsLayout>
            <Head title={`Version — ${version.title}`} />

            {/* Breadcrumb */}
            <nav className="mb-5 flex items-center gap-1.5 text-sm text-text-secondary">
                <Link href="/workspaces" className="hover:text-foreground">Workspaces</Link>
                <IconChevronRight className="h-3.5 w-3.5" stroke={1.5} />
                <Link href={`/workspaces/${workspace.id}`} className="hover:text-foreground">{workspace.name}</Link>
                <IconChevronRight className="h-3.5 w-3.5" stroke={1.5} />
                <Link href={`/documents/${doc.id}`} className="hover:text-foreground">{doc.title}</Link>
                <IconChevronRight className="h-3.5 w-3.5" stroke={1.5} />
                <Link href={`/documents/${doc.id}/versions`} className="hover:text-foreground">History</Link>
                <IconChevronRight className="h-3.5 w-3.5" stroke={1.5} />
                <span className="text-foreground">Version</span>
            </nav>

            {/* Snapshot banner */}
            <div className="mb-4 flex items-center justify-between gap-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="text-sm text-amber-800">
                    <span className="font-medium">Read-only snapshot</span>
                    {' · '}Saved {timeAgo(version.created_at)}
                    {version.creator && <> by <span className="font-medium">{version.creator.name}</span></>}
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/documents/${doc.id}/versions`}>
                            <IconHistory className="h-3.5 w-3.5" stroke={1.5} />
                            All versions
                        </Link>
                    </Button>
                    <Button size="sm" onClick={() => setRestoreOpen(true)}>
                        <IconArrowBack className="h-3.5 w-3.5" stroke={1.5} />
                        Restore this version
                    </Button>
                </div>
            </div>

            {/* Content card */}
            <div className="overflow-hidden rounded-md border border-border bg-card">
                {/* Title */}
                <div className="border-b border-border px-8 py-5">
                    <h1 className="text-2xl font-semibold text-foreground">{version.title}</h1>
                </div>

                {/* Body — same CSS classes as the live read-only TipTap view */}
                <div className="tiptap-read-area">
                    <div
                        className="tiptap"
                        dangerouslySetInnerHTML={{
                            __html: version.content_html ?? '<p class="text-text-tertiary text-sm">No content.</p>',
                        }}
                    />
                </div>
            </div>
        </DocsLayout>

        <ConfirmDialog
            open={restoreOpen}
            title="Restore this version?"
            message={`The current content will be saved as a new version first, then this snapshot from ${timeAgo(version.created_at)} will become the active content.`}
            confirmLabel="Restore"
            cancelLabel="Cancel"
            variant="primary"
            onConfirm={confirmRestore}
            onCancel={() => setRestoreOpen(false)}
        />
        </>
    );
}
