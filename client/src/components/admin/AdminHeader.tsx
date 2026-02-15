import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';

interface AdminHeaderProps {
  title: string;
}

export function AdminHeader({ title }: AdminHeaderProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="md:hidden sticky top-0 z-50 bg-card border-b border-border p-4 flex items-center gap-4">
      <SidebarTrigger className="bg-card shadow-sm border border-border rounded-lg p-2 h-10 w-10 shrink-0" />
      <button type="button" className="font-semibold text-primary select-none text-left" onClick={toggleSidebar}>
        {title}
      </button>
    </header>
  );
}
