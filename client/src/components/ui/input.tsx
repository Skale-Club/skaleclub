import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // Base classes are the ORIGINAL public styling (unchanged on the public
    // site). The `[.admin-theme_&]:` variants apply the xphere shape + accent
    // focus ring ONLY under html.admin-theme — they generate CSS that never
    // matches outside /admin, so the landing stays byte-identical.
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "[.admin-theme_&]:rounded-[8px] [.admin-theme_&]:transition-[border-color,box-shadow] [.admin-theme_&]:duration-150 [.admin-theme_&]:focus-visible:border-ring [.admin-theme_&]:focus-visible:ring-2 [.admin-theme_&]:focus-visible:ring-[var(--accent-ring)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
