import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  // Base = original public styling (unchanged). The `[.admin-theme_&]:`
  // variants add the xphere shape + accent focus ring ONLY inside /admin.
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors duration-200",
        "[.admin-theme_&]:rounded-[8px] [.admin-theme_&]:focus-visible:border-ring [.admin-theme_&]:focus-visible:ring-2 [.admin-theme_&]:focus-visible:ring-[var(--accent-ring)]",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
