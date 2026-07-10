import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { router } from '@inertiajs/react';
import { IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { useScrollLock } from '@/hooks/useScrollLock';

/**
 * Modal for creating a new workspace, mirroring the NewPageModal dialog pattern.
 *
 * Props:
 *   open     – controlled visibility
 *   onClose  – called on cancel / success / backdrop click
 */
export default function NewWorkspaceModal({ open, onClose }) {
    const [name, setName]               = useState('');
    const [description, setDescription] = useState('');
    const [error, setError]             = useState('');
    const [busy, setBusy]               = useState(false);

    // Reset fields whenever the modal opens
    useEffect(() => {
        if (open) {
            setName('');
            setDescription('');
            setError('');
        }
    }, [open]);

    // Lock body scroll while open.
    useScrollLock(open);

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
        if (!name.trim()) { setError('Name is required.'); return; }
        setBusy(true);
        router.post('/workspaces', {
            name: name.trim(),
            description: description.trim() || null,
        }, {
            onSuccess: () => { setBusy(false); onClose(); },
            onError: (errs) => { setBusy(false); setError(errs.name ?? 'Something went wrong.'); },
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
                style={{ boxShadow: 'var(--shadow-lg)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                    <h2 className="text-[15px] font-medium text-foreground">New workspace</h2>
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

                        {/* Name */}
                        <div>
                            <label htmlFor="workspace-name" className="mb-1.5 block text-xs font-medium text-foreground">
                                Name
                            </label>
                            <input
                                id="workspace-name"
                                autoFocus
                                type="text"
                                value={name}
                                onChange={(e) => { setName(e.target.value); setError(''); }}
                                placeholder="e.g. Network"
                                className="h-9 w-full rounded-sm border border-border bg-canvas px-3 text-sm text-foreground placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent-400 focus:ring-[3px] focus:ring-accent-200"
                            />
                            {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
                        </div>

                        {/* Description */}
                        <div>
                            <label htmlFor="workspace-description" className="mb-1.5 block text-xs font-medium text-foreground">
                                Description{' '}
                                <span className="font-normal text-text-tertiary">(optional)</span>
                            </label>
                            <input
                                id="workspace-description"
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What lives in this workspace?"
                                className="h-9 w-full rounded-sm border border-border bg-canvas px-3 text-sm text-foreground placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent-400 focus:ring-[3px] focus:ring-accent-200"
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-2 border-t border-border-subtle bg-canvas px-5 py-3.5">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={busy || !name.trim()}>
                            {busy ? 'Creating…' : 'Create workspace'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
