import { cn } from "@/lib/utils";

interface DotsLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function DotsLoader({ size = "md", className }: DotsLoaderProps) {
  const sizeClasses = {
    sm: { dot: "w-2 h-2", gap: "gap-1" },
    md: { dot: "w-3 h-3", gap: "gap-2" },
    lg: { dot: "w-4 h-4", gap: "gap-3" },
  };

  const { dot, gap } = sizeClasses[size];

  return (
    <div
      className={cn("flex items-center", gap, className)}
      role="status"
      aria-label="Loading"
    >
      <div className={cn(dot, "rounded-full bg-primary animate-dot-pulse [animation-delay:0ms]")} />
      <div className={cn(dot, "rounded-full bg-primary animate-dot-pulse [animation-delay:150ms]")} />
      <div className={cn(dot, "rounded-full bg-primary animate-dot-pulse [animation-delay:300ms]")} />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <DotsLoader size="lg" />
    </div>
  );
}

// Keep Spinner for other use cases
interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-3",
    lg: "h-12 w-12 border-4",
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-solid border-primary border-t-transparent",
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
