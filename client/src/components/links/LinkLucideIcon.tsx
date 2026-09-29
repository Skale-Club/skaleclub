import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { LucideProps } from "lucide-react";

type IconComponent = ComponentType<LucideProps>;
const cache = new Map<string, IconComponent | null>();

/** "ArrowUpRight" -> "arrow-up-right"; "Building2" -> "building-2". */
function toKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Renders one lucide icon by its stored PascalCase name, loading only that icon on
 * demand (lucide-react 0.453 has no `lucide-react/dynamic`, so this uses
 * `dynamicIconImports`). Shows `fallback` while loading or when the name is unknown.
 */
export default function LinkLucideIcon({
  name,
  className,
  fallback,
}: {
  name: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [Icon, setIcon] = useState<IconComponent | null>(() => cache.get(name) ?? null);

  useEffect(() => {
    if (cache.has(name)) {
      setIcon(() => cache.get(name) ?? null);
      return;
    }
    let cancelled = false;
    import("lucide-react/dynamicIconImports")
      .then(async ({ default: imports }) => {
        const loader = (imports as Record<string, () => Promise<{ default: IconComponent }>>)[toKebab(name)];
        const mod = loader ? await loader() : null;
        cache.set(name, mod?.default ?? null);
        if (!cancelled) setIcon(() => mod?.default ?? null);
      })
      .catch(() => cache.set(name, null));
    return () => {
      cancelled = true;
    };
  }, [name]);

  return Icon ? <Icon className={className} /> : <>{fallback}</>;
}
