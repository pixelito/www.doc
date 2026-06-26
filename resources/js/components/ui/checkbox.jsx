import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Sage-themed checkbox — a native `<input type="checkbox">` with the OS
 * appearance replaced by the design-system look (see `.ui-checkbox` in app.css:
 * 1px border, sage-400 fill, text-inverse check, sage-200 focus ring). Use it as
 * a controlled input: `<Checkbox checked={x} onChange={...} />`.
 */
const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
    <input
        type="checkbox"
        ref={ref}
        className={cn('ui-checkbox', className)}
        {...props}
    />
));
Checkbox.displayName = 'Checkbox';

export { Checkbox };
