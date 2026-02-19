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
import { ArrowLeft, GripVertical, LogOut } from 'lucide-react';
import { Link } from 'wouter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { SIDEBAR_MENU_ITEMS, type SidebarMenuItem as SidebarEntry } from './shared/constants';
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
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const { isMobile, setOpenMobile } = useSidebar();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <SidebarMenuItem ref={setNodeRef} style={style}>
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => {
          onSelect();
          if (isMobile) setOpenMobile(false);
        }}
        className="w-full text-sidebar-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group/item transition-all duration-200"
        data-testid={`menu-${item.id}`}
      >
        <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 opacity-0 group-hover/item:opacity-100 text-muted-foreground/60 group-hover/item:text-sidebar-accent-foreground transition-all" />
        </span>
        <item.icon className="w-4 h-4" />
        <span className="font-medium">{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
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
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="p-4 border-b border-sidebar-border bg-sidebar">
        <div className="flex flex-col gap-4">
          <Link href="/" className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors group">
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
            <span className="font-semibold text-lg text-primary truncate">
              {companySettings?.companyName || 'Admin Panel'}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2 bg-sidebar">
        <SidebarGroup>
          <SidebarGroupContent>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sectionsOrder} strategy={verticalListSortingStrategy}>
                <SidebarMenu>
                  {sectionsOrder.map((sectionId) => {
                    const item = SIDEBAR_MENU_ITEMS.find((entry) => entry.id === sectionId);
                    if (!item) return null;

                    return (
                      <SidebarSortableItem
                        key={item.id}
                        item={item}
                        isActive={activeSection === item.id}
                        onSelect={() => onSectionSelect(item.id)}
                      />
                    );
                  })}
                </SidebarMenu>
              </SortableContext>
            </DndContext>
          </SidebarGroupContent>
        </SidebarGroup>
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
