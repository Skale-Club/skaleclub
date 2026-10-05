import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, ChevronDown, GripVertical, LogOut } from 'lucide-react';
import { Link } from 'wouter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  SIDEBAR_GROUPS,
  SIDEBAR_MENU_ITEMS,
  type SidebarGroupId,
  type SidebarMenuItem as SidebarEntry,
} from './shared/constants';
import type { AdminSection, CompanySettingsData } from './shared/types';

interface AdminSidebarProps {
  activeSection: AdminSection;
  sectionsOrder: AdminSection[];
  companySettings?: CompanySettingsData;
  email?: string | null;
  onSectionSelect: (section: AdminSection) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onLogout: () => void | Promise<void>;
}

function SidebarSortableItem({
  item,
  isActive,
  onSelect,
}: {
  item: SidebarEntry;
  isActive: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const { isMobile, setOpenMobile } = useSidebar();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className="group/item group/menu-item relative touch-none"
    >
      {/* xphere active indicator: a solid accent bar on the left edge */}
      {isActive && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 z-10 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
        />
      )}
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => {
          onSelect();
          if (isMobile) setOpenMobile(false);
        }}
        className="w-full text-sidebar-foreground data-[active=true]:bg-accent-muted data-[active=true]:text-primary data-[active=true]:font-semibold hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
        data-testid={`menu-${item.id}`}
      >
        <span
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${item.title}`}
          className={cn(
            "shrink-0 cursor-grab opacity-0 transition-opacity group-hover/item:opacity-100",
            isActive ? "text-primary/60" : "text-muted-foreground/60"
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </span>
        <item.icon className="w-4 h-4" />
        <span className="font-medium">{item.title}</span>
      </SidebarMenuButton>
    </li>
  );
}

export function AdminSidebar({
  activeSection,
  sectionsOrder,
  companySettings,
  email,
  onSectionSelect,
  onDragEnd,
  onLogout,
}: AdminSidebarProps) {
  const activeGroup = SIDEBAR_MENU_ITEMS.find((item) => item.id === activeSection)?.group ?? 'workspace';
  const [openGroups, setOpenGroups] = useState<Set<SidebarGroupId>>(
    () => new Set<SidebarGroupId>([activeGroup]),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const orderedGroups = useMemo(() => {
    const orderIndex = new Map(sectionsOrder.map((id, index) => [id, index]));

    return SIDEBAR_GROUPS.map((group) => ({
      ...group,
      items: SIDEBAR_MENU_ITEMS
        .filter((item) => item.group === group.id)
        .sort((a, b) => (orderIndex.get(a.id) ?? 999) - (orderIndex.get(b.id) ?? 999)),
    }));
  }, [sectionsOrder]);

  useEffect(() => {
    setOpenGroups((current) => {
      if (current.has(activeGroup)) return current;
      const next = new Set(current);
      next.add(activeGroup);
      return next;
    });
  }, [activeGroup]);

  const toggleGroup = (groupId: SidebarGroupId) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="p-4 border-b border-sidebar-border bg-sidebar">
        <div className="flex flex-col gap-4">
          <Link href="/" className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary dark:hover:text-white transition-colors group">
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            Back to website
          </Link>
          <div className="flex items-center gap-3">
            {companySettings?.logoIcon ? (
              <img
                src={companySettings.logoIcon}
                alt={companySettings.companyName || 'Logo'}
                className="w-10 h-10 object-contain"
                data-testid="img-admin-logo"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                {companySettings?.companyName?.[0] || 'A'}
              </div>
            )}
            <span className="font-semibold text-lg text-primary dark:text-white truncate">
              {companySettings?.companyName || 'Admin Panel'}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1 bg-sidebar px-2 py-3">
        {orderedGroups.map((group) => {
          const isOpen = openGroups.has(group.id);
          const containsActiveItem = group.id === activeGroup;

          return (
            <SidebarGroup key={group.id} className="p-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`sidebar-group-${group.id}`}
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  'flex h-8 w-full items-center justify-between rounded-md px-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                  containsActiveItem && 'text-foreground',
                )}
                data-testid={`sidebar-group-${group.id}`}
              >
                <span>{group.title}</span>
                <ChevronDown
                  aria-hidden
                  className={cn('h-3.5 w-3.5 transition-transform duration-200', isOpen && 'rotate-180')}
                />
              </button>

              {isOpen && (
                <SidebarGroupContent id={`sidebar-group-${group.id}`} className="pb-1">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={group.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                      <SidebarMenu>
                        {group.items.map((item) => (
                          <SidebarSortableItem
                            key={item.id}
                            item={item}
                            isActive={activeSection === item.id}
                            onSelect={() => onSectionSelect(item.id)}
                          />
                        ))}
                      </SidebarMenu>
                    </SortableContext>
                  </DndContext>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border mt-auto bg-sidebar">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="text-muted-foreground text-xs">Logged in as</p>
              <p className="font-medium truncate text-foreground">{email}</p>
            </div>
            <ThemeToggle variant="icon" className="text-muted-foreground hover:text-foreground" />
          </div>
          <Button variant="default" className="w-full" onClick={onLogout} data-testid="button-logout">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
