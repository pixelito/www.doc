import { cn } from '@/lib/utils';

export function EmptyState({ icon: Icon, title, description, children, className }) {
    return (
        <div className={cn('rounded-md border border-dashed border-border bg-surface p-12 text-center', className)}>
            {Icon && <Icon className="mx-auto h-6 w-6 text-text-tertiary" stroke={1.5} />}
            {title && <p className="mt-2 text-sm font-medium text-text-secondary">{title}</p>}
            {description && <p className="mt-1 text-sm text-text-tertiary">{description}</p>}
            {children && <div className="mt-4">{children}</div>}
        </div>
    );
}
