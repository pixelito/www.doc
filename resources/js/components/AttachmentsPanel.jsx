import React, { useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    IconPaperclip, IconDownload, IconUpload, IconX, IconFile, IconPlus,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

const MAX_BYTES = 25 * 1024 * 1024; // mirrors the server's 25 MB cap

function humanSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** i;
    return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/**
 * Modal for staging a single attachment: pick a file, then give it a display name
 * (used as the download filename). Mirrors the export modal's shape. The file is
 * only staged here — it's uploaded when the page is saved.
 */
// Split a filename into its editable base and its (fixed) extension, e.g.
// "report.final.pdf" → { base: "report.final", ext: ".pdf" }. A leading dot
// (dotfiles like ".env") is treated as having no extension.
function splitName(filename) {
    const dot = filename.lastIndexOf('.');
    return dot > 0
        ? { base: filename.slice(0, dot), ext: filename.slice(dot) }
        : { base: filename, ext: '' };
}

function AddAttachmentModal({ open, onClose, onAdd }) {
    const inputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [baseName, setBaseName] = useState('');
    const [ext, setExt] = useState('');
    const [dragActive, setDragActive] = useState(false);

    // Reset every time the modal closes so the next open starts fresh.
    useEffect(() => {
        if (!open) { setFile(null); setBaseName(''); setExt(''); setDragActive(false); }
    }, [open]);

    function chooseFile(fileList) {
        const picked = Array.from(fileList ?? [])[0];
        if (!picked) return;
        if (picked.size > MAX_BYTES) {
            toast.error(`"${picked.name}" is larger than 25 MB.`);
            return;
        }
        const { base, ext: extension } = splitName(picked.name);
        setFile(picked);
        setBaseName(base);
        setExt(extension);
    }

    function confirm() {
        if (!file || !baseName.trim()) return;
        onAdd({ file, name: baseName.trim() + ext });
        onClose();
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Add attachment</DialogTitle>
                    <DialogDescription>
                        Choose a file and give it a name. It's attached when you save the page.
                    </DialogDescription>
                </DialogHeader>

                {!file ? (
                    <>
                        <input
                            ref={inputRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => { chooseFile(e.target.files); e.target.value = ''; }}
                        />
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => inputRef.current?.click()}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
                            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={(e) => { e.preventDefault(); setDragActive(false); chooseFile(e.dataTransfer.files); }}
                            className={`mt-1 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-8 text-center transition-colors ${
                                dragActive
                                    ? 'border-accent-400 bg-accent-50'
                                    : 'border-border hover:border-accent-300 hover:bg-surface-hover'
                            }`}
                        >
                            <IconUpload className="h-5 w-5 text-text-tertiary" stroke={1.5} />
                            <p className="text-sm text-text-secondary">
                                <span className="font-medium text-accent-600">Drag a file here or browse</span>
                            </p>
                            <p className="text-[11px] text-text-tertiary">Up to 25 MB</p>
                        </div>
                    </>
                ) : (
                    <div className="space-y-3 py-1">
                        <div className="flex items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2">
                            <IconFile className="h-4 w-4 shrink-0 text-text-tertiary" stroke={1.5} />
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{file.name}</span>
                            <span className="shrink-0 text-xs text-text-tertiary">{humanSize(file.size)}</span>
                            <button
                                type="button"
                                onClick={() => { setFile(null); setName(''); }}
                                title="Choose a different file"
                                className="shrink-0 rounded-sm p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-foreground"
                            >
                                <IconX className="h-3.5 w-3.5" stroke={1.5} />
                            </button>
                        </div>
                        <div>
                            <label htmlFor="attachment-name" className="mb-1.5 block text-sm font-medium text-foreground">
                                Name
                            </label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="attachment-name"
                                    value={baseName}
                                    autoFocus
                                    onChange={(e) => setBaseName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirm(); } }}
                                    placeholder="Attachment name"
                                    className="flex-1"
                                />
                                {ext && (
                                    // Same look as the input, but a static (non-editable) field:
                                    // disabled fill + muted text, no focus ring.
                                    <span className="flex h-9 shrink-0 items-center rounded-sm border border-border bg-canvas px-3 text-sm text-text-tertiary">
                                        {ext}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="outline" onClick={onClose}>Cancel</Button>
                            <Button
                                className="bg-accent-400 hover:bg-accent-500 text-text-inverse"
                                onClick={confirm}
                                disabled={!baseName.trim()}
                            >
                                <IconPlus stroke={1.5} />
                                Add
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * Files attached to a page. Controlled component: in edit mode the parent holds
 * the staged changes (new files + ids marked for removal) so nothing persists
 * until the page is saved — Cancel discards them, Save commits them. Read mode is
 * a plain download list (hidden when there are none).
 *
 * Each pending upload is a { file, name } pair — the name is the chosen display /
 * download filename, set in the add modal.
 */
export default function AttachmentsPanel({
    documentId,
    attachments = [],
    editable = false,
    pendingUploads = [],
    pendingRemovals = [],
    onAddUpload,
    onRemoveExisting,
    onUndoRemove,
    onRemovePending,
}) {
    const [modalOpen, setModalOpen] = useState(false);

    // Read mode with nothing attached: render nothing at all.
    if (!editable && attachments.length === 0) return null;

    const liveCount = attachments.filter((a) => !pendingRemovals.includes(a.id)).length + pendingUploads.length;
    const hasRows = attachments.length > 0 || pendingUploads.length > 0;

    return (
        <section className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">
                    <IconPaperclip className="h-3.5 w-3.5" stroke={1.5} />
                    Attachments ({liveCount})
                </h2>
                {editable && (
                    <Button
                        variant="outline"
                        className="border-border hover:bg-surface-hover"
                        onClick={() => setModalOpen(true)}
                    >
                        <IconPlus stroke={1.5} />
                        Add attachment
                    </Button>
                )}
            </div>

            {hasRows && (
                <div className="overflow-hidden rounded-md border border-border bg-card">
                    {attachments.map((att, idx) => {
                        const removing = pendingRemovals.includes(att.id);
                        const href = `/documents/${documentId}/attachments/${att.id}`;
                        return (
                            <div
                                key={att.id}
                                className={`flex items-center gap-3 px-4 py-2.5${idx > 0 ? ' border-t border-border-subtle' : ''}`}
                            >
                                <IconFile className={`h-4 w-4 shrink-0 text-text-tertiary${removing ? ' opacity-40' : ''}`} stroke={1.5} />
                                {removing ? (
                                    <>
                                        <span className="min-w-0 flex-1 truncate text-sm text-text-tertiary line-through">{att.original_name}</span>
                                        <span className="shrink-0 text-xs text-text-tertiary">Will be removed</span>
                                        <button
                                            type="button"
                                            onClick={() => onUndoRemove(att.id)}
                                            className="shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-medium text-accent-600 transition-colors hover:bg-surface-hover"
                                        >
                                            Undo
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div
                                            className="flex min-w-0 flex-1 items-baseline gap-2"
                                        >
                                            <span className="truncate text-sm font-medium text-foreground">{att.original_name}</span>
                                            <span className="shrink-0 text-xs text-text-tertiary">{humanSize(att.size)}</span>
                                        </div>
                                        <a
                                            href={href}
                                            title="Download"
                                            className="shrink-0 rounded-sm p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-accent-600"
                                        >
                                            <IconDownload className="h-4 w-4" stroke={1.5} />
                                        </a>
                                        {editable && (
                                            <button
                                                type="button"
                                                onClick={() => onRemoveExisting(att.id)}
                                                title="Remove"
                                                className="shrink-0 rounded-sm p-1 text-text-tertiary transition-colors hover:bg-danger-surface hover:text-danger"
                                            >
                                                <IconX className="h-4 w-4" stroke={1.5} />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}

                    {editable && pendingUploads.map((item, i) => (
                        <div
                            key={`pending-${i}`}
                            className={`flex items-center gap-3 px-4 py-2.5${attachments.length > 0 || i > 0 ? ' border-t border-border-subtle' : ''}`}
                        >
                            <IconFile className="h-4 w-4 shrink-0 text-text-tertiary" stroke={1.5} />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.name}</span>
                            <span className="shrink-0 text-xs text-text-tertiary">{humanSize(item.file.size)}</span>
                            <span className="shrink-0 rounded-sm bg-accent-100 px-1.5 py-0.5 text-[10px] font-medium text-accent-600">New</span>
                            <button
                                type="button"
                                onClick={() => onRemovePending(i)}
                                title="Remove"
                                className="shrink-0 rounded-sm p-1 text-text-tertiary transition-colors hover:bg-danger-surface hover:text-danger"
                            >
                                <IconX className="h-4 w-4" stroke={1.5} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {editable && !hasRows && (
                <p className="text-xs text-text-tertiary">No files attached yet.</p>
            )}

            <AddAttachmentModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onAdd={onAddUpload}
            />
        </section>
    );
}
