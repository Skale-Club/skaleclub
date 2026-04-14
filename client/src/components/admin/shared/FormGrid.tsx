import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3;
  gap?: "sm" | "default";
}

const colsClass: Record<1 | 2 | 3, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

const gapClass = {
  sm: "gap-3",
  default: "gap-4",
} as const;

export const FormGrid = React.forwardRef<HTMLDivElement, FormGridProps>(
  ({ className, cols = 2, gap = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("grid", colsClass[cols], gapClass[gap], className)}
      {...props}
    />
  ),
);
FormGrid.displayName = "FormGrid";
