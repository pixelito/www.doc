import { useState, useRef } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { IconUpload, IconFileTypePdf, IconFileTypeDocx, IconLoader2, IconCircleCheck, IconAlertCircle, IconChevronRight } from '@tabler/icons-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CSRF = () => document.querySelector('meta[name="csrf-token"]')?.content ?? '';

function FileDrop({ onFile, file }) {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef(null);

    function handle(f) {
        if (!f) return;
        const ext = f.name.split('.').pop().toLowerCase();
        if (!['docx', 'pdf'].includes(ext)) return;
        onFile(f);
    }

    function onDrop(e) {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files[0]);
    }

    const ext = file ? file.name.split('.').pop().toLowerCase() : null;
    const Icon = ext === 'pdf' ? IconFileTypePdf : ext === 'docx' ? IconFileTypeDocx : IconUpload;

    return (
        <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={[
                'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed px-6 py-10 transition-colors duration-150',
                dragging ? 'border-sage-400 bg-sage-50' : 'border-border hover:border-sage-300 hover:bg-surface-hover',
            ].join(' ')}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".docx,.pdf"
                className="hidden"
                onChange={(e) => handle(e.target.files[0])}
            />
            <Icon className="h-8 w-8 text-text-tertiary" stroke={1.5} />
            {file ? (
                <div className="text-center">
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">{(file.size / 1024).toFixed(0)} KB — click to change</p>
                </div>
            ) : (
                <div className="text-center">
                    <p className="text-sm text-foreground">Drop a <strong>.docx</strong> or <strong>.pdf</strong> here</p>
                    <p className="mt-0.5 text-xs text-text-secondary">or click to browse — max 50 MB</p>
                </div>
            )}
        </div>
    );
}

export default function Import({ workspace }) {
    const [file, setFile]       = useState(null);
    const [title, setTitle]     = useState('');
    const [status, setStatus]   = useState('idle'); // idle | uploading | processing | done | failed
    const [error, setError]     = useState(null);
    const [docId, setDocId]     = useState(null);
    const pollRef               = useRef(null);

    function stopPolling() {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }

    function startPolling(jobId) {
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/imports/${jobId}`, {
                    headers: { 'X-CSRF-TOKEN': CSRF(), Accept: 'application/json' },
                });
                const data = await res.json();

                if (data.status === 'done') {
                    stopPolling();
                    setDocId(data.document_id);
                    setStatus('done');
                } else if (data.status === 'failed') {
                    stopPolling();
                    setError(data.error ?? 'Import failed. Please try again.');
                    setStatus('failed');
                }
            } catch {
                // network hiccup — keep polling
            }
        }, 1500);
    }

    async function submit(e) {
        e.preventDefault();
        if (!file) return;

        setStatus('uploading');
        setError(null);

        const form = new FormData();
        form.append('file', file);
        form.append('_token', CSRF());
        if (title.trim()) form.append('title', title.trim());

        try {
            const res = await fetch(`/workspaces/${workspace.id}/imports`, {
                method: 'POST',
                headers: { Accept: 'application/json' },
                body: form,
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                const msg  = body.message ?? Object.values(body.errors ?? {})[0]?.[0] ?? 'Upload failed.';
                setError(msg);
                setStatus('failed');
                return;
            }

            const { job_id } = await res.json();
            setStatus('processing');
            startPolling(job_id);
        } catch {
            setError('Network error — please try again.');
            setStatus('failed');
        }
    }

    const isPdf = file?.name.endsWith('.pdf');

    return (
        <AppLayout>
            <Head title={`Import — ${workspace.name}`} />

            {/* Breadcrumb */}
            <nav className="mb-5 flex items-center gap-1.5 text-sm text-text-secondary">
                <Link href="/workspaces" className="hover:text-foreground">Workspaces</Link>
                <IconChevronRight className="h-3.5 w-3.5" stroke={1.5} />
                <Link href={`/workspaces/${workspace.id}`} className="hover:text-foreground">{workspace.name}</Link>
                <IconChevronRight className="h-3.5 w-3.5" stroke={1.5} />
                <span className="text-foreground">Import</span>
            </nav>

            <div className="mx-auto max-w-xl">
                <h1 className="mb-1 text-xl font-semibold text-foreground">Import document</h1>
                <p className="mb-6 text-sm text-text-secondary">
                    Upload a <strong>.docx</strong> or <strong>.pdf</strong> file to create a new page in <em>{workspace.name}</em>.
                </p>

                {/* Idle / uploading form */}
                {(status === 'idle' || status === 'failed') && (
                    <form onSubmit={submit} className="space-y-4">
                        <FileDrop file={file} onFile={(f) => {
                            setFile(f);
                            if (!title) {
                                const base = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
                                setTitle(base.charAt(0).toUpperCase() + base.slice(1));
                            }
                        }} />

                        <div>
                            <label className="mb-1 block text-sm font-medium text-foreground">
                                Title <span className="text-text-tertiary font-normal">(optional — auto-detected)</span>
                            </label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Document title"
                            />
                        </div>

                        {isPdf && (
                            <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                                <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" stroke={1.5} />
                                <span>PDF import extracts text only — formatting is not preserved.</span>
                            </div>
                        )}

                        {error && (
                            <p className="text-sm text-danger">{error}</p>
                        )}

                        <div className="flex gap-3">
                            <Button type="submit" disabled={!file}>
                                <IconUpload className="h-4 w-4" stroke={1.5} />
                                Import
                            </Button>
                            <Button variant="ghost" asChild>
                                <Link href={`/workspaces/${workspace.id}`}>Cancel</Link>
                            </Button>
                        </div>
                    </form>
                )}

                {/* Processing state */}
                {(status === 'uploading' || status === 'processing') && (
                    <div className="flex flex-col items-center gap-4 py-12 text-center">
                        <IconLoader2 className="h-8 w-8 animate-spin text-sage-500" stroke={1.5} />
                        <div>
                            <p className="font-medium text-foreground">
                                {status === 'uploading' ? 'Uploading…' : 'Converting…'}
                            </p>
                            <p className="mt-0.5 text-sm text-text-secondary">
                                {status === 'uploading'
                                    ? 'Sending file to the server.'
                                    : 'Parsing document — this usually takes a few seconds.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Done state */}
                {status === 'done' && (
                    <div className="flex flex-col items-center gap-4 py-12 text-center">
                        <IconCircleCheck className="h-10 w-10 text-sage-500" stroke={1.5} />
                        <div>
                            <p className="font-semibold text-foreground">Import complete!</p>
                            <p className="mt-0.5 text-sm text-text-secondary">Your document is ready to edit.</p>
                        </div>
                        <Button onClick={() => router.visit(`/documents/${docId}`)}>
                            Open document
                        </Button>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
