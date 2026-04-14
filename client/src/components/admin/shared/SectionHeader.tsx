import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, title, description, action, icon, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-6 border-b",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  ),
);
SectionHeader.displayName = "SectionHeader";
