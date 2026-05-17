import { AdminCard } from "@/components/admin/shared";

interface SectionSkeletonProps {
  rows?: number;
}

export function SectionSkeleton({ rows = 4 }: SectionSkeletonProps) {
  return (
    <AdminCard>
      <div className="space-y-4 animate-pulse" data-testid="section-skeleton">
        <div className="h-6 w-1/3 rounded bg-zinc-700/40" />
        <div className="h-4 w-2/3 rounded bg-zinc-800/60" />

        <div className="space-y-3 pt-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-full rounded border bg-zinc-800/40"
            />
          ))}
        </div>
      </div>
    </AdminCard>
  );
}
