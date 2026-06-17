import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-[3px] focus:ring-sage-200",
  {
    variants: {
      variant: {
        default:
          "bg-sage-100 text-sage-600",
        secondary:
          "bg-surface-hover text-text-secondary",
        destructive:
          "bg-danger/10 text-danger",
        outline: "border border-border text-text-secondary",
        solid: "bg-sage-400 text-text-inverse",
        muted: "bg-border-subtle text-text-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<span className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
