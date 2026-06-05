import { useCallback, useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface SubNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface SubSidebarProps {
  /** Navigation items to render in the rail. */
  items: SubNavItem[];
  /** Currently active item id (controlled). */
  value: string;
  /** Called when the user selects an item. */
  onValueChange: (id: string) => void;
  /** When provided, the collapsed state persists in localStorage under this key. */
  storageKey?: string;
  className?: string;
}

function readCollapsed(storageKey?: string): boolean {
  if (!storageKey || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`subsidebar:${storageKey}:collapsed`) === "1";
  } catch {
    return false;
  }
}

/**
 * Vertical, collapsible navigation rail for admin sections — a shared
 * replacement for horizontal tab strips. Controlled via `value` /
 * `onValueChange`. When collapsed it shrinks to an icon rail with tooltips.
 */
export function SubSidebar({
  items,
  value,
  onValueChange,
  storageKey,
  className,
}: SubSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey));

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `subsidebar:${storageKey}:collapsed`,
        collapsed ? "1" : "0",
      );
    } catch {
      /* ignore persistence failures (private mode, etc.) */
    }
  }, [collapsed, storageKey]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  return (
    <TooltipProvider delayDuration={0}>
      <nav
        aria-label="Section navigation"
        data-collapsed={collapsed || undefined}
        className={cn(
          "shrink-0 self-start rounded-2xl border bg-muted/40 p-1.5 transition-[width] duration-200",
          collapsed ? "w-14" : "w-56",
          className,
        )}
      >
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = item.id === value;
            const button = (
              <button
                type="button"
                onClick={() => onValueChange(item.id)}
                aria-current={active ? "page" : undefined}
                title={collapsed ? undefined : item.label}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                  collapsed && "justify-center px-0",
                  active
                    ? "border-border bg-card text-foreground shadow-sm"
                    : "border-transparent text-muted-foreground hover:bg-card/50 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );

            return (
              <li key={item.id}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  button
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-1.5 border-t pt-1.5">
          <button
            type="button"
            onClick={toggle}
            title={collapsed ? "Expand" : "Collapse"}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-card/50 hover:text-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                <span className="truncate">Collapse</span>
              </>
            )}
          </button>
        </div>
      </nav>
    </TooltipProvider>
  );
}
