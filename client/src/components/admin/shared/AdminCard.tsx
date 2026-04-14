import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const adminCardVariants = cva(
  "rounded-2xl border text-card-foreground transition-colors",
  {
    variants: {
      padding: {
        compact: "p-4",
        default: "p-6",
        hero: "p-8",
      },
      tone: {
        default: "bg-card",
        muted: "bg-muted/40",
        accent: "bg-primary/5",
      },
    },
    defaultVariants: {
      padding: "default",
      tone: "default",
    },
  },
);

export interface AdminCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof adminCardVariants> {}

export const AdminCard = React.forwardRef<HTMLDivElement, AdminCardProps>(
  ({ className, padding, tone, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(adminCardVariants({ padding, tone }), className)}
      {...props}
    />
  ),
);
AdminCard.displayName = "AdminCard";
