import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { router } from '@inertiajs/react';
import { IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

/**
 * Modal for creating a new page, following the design-system dialog pattern.
 *
 * Props:
 *   open             – controlled visibility
 *   onClose          – called on cancel / success / backdrop click
 *   workspaceId      – always required
 *   parentOptions    – [{ id, label }] for the parent select
 *   initialParentId  – pre-select a parent (e.g. when clicking + on a row)
 */
export default function NewPageModal({ open, onClose, workspaceId, parentOptions = [], initialParentId = '' }) {
    const [title, setTitle]    = useState('');
    const [parentId, setParentId] = useState(initialParentId);
    const [error, setError]    = useState('');
    const [busy, setBusy]      = useState(false);

    // Sync parent selection and reset title whenever the modal opens
    useEffect(() => {
        if (open) {
            setTitle('');
            setParentId(initialParentId);
            setError('');
        }
    }, [open, initialParentId]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    function handleSubmit(e) {
        e.preventDefault();
        if (!title.trim()) { setError('Title is required.'); return; }
        setBusy(true);
        router.post('/documents', {
            title: title.trim(),
            workspace_id: workspaceId,
            parent_id: parentId || null,
        }, {
            onSuccess: () => { setBusy(false); onClose(); },
            onError: (errs) => { setBusy(false); setError(errs.title ?? 'Something went wrong.'); },
        });
    }

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(31, 37, 32, 0.42)' }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="w-full max-w-md overflow-hidden rounded-[14px] bg-surface"
                style={{ boxShadow: '0 16px 40px rgba(31, 37, 32, 0.18)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                    <h2 className="text-[15px] font-medium text-foreground">New page</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-7 w-7 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-surface-hover hover:text-foreground"
                    >
                        <IconX className="h-4 w-4" stroke={1.5} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 px-5 py-5">

                        {/* Title */}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-foreground">
                                Title
                            </label>
                            <input
                                autoFocus
                                type="text"
                                value={title}
                                onChange={(e) => { setTitle(e.target.value); setError(''); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(e); } }}
                                placeholder="e.g. VPN setup"
                                className="h-9 w-full rounded-sm border border-border bg-canvas px-3 text-sm text-foreground placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus:border-sage-400 focus:ring-[3px] focus:ring-sage-200"
                            />
                            {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
                        </div>

                        {/* Parent page */}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-foreground">
                                Parent page{' '}
                                <span className="font-normal text-text-tertiary">(optional)</span>
                            </label>
                            <select
                                value={parentId}
                                onChange={(e) => setParentId(e.target.value)}
                                className="ui-select h-9 w-full rounded-sm border border-border bg-canvas px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus:border-sage-400 focus:ring-[3px] focus:ring-sage-200"
                            >
                                <option value="">None — top-level page</option>
                                {parentOptions.map((o) => (
                                    <option key={o.id} value={o.id}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-2 border-t border-border-subtle bg-canvas px-5 py-3.5">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={busy || !title.trim()}>
                            {busy ? 'Creating…' : 'Create page'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
