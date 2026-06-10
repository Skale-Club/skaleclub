import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import type { CompanySettingsData } from './shared/types';

interface AdminHeaderProps {
  title: string;
  companySettings?: CompanySettingsData;
}

export function AdminHeader({ title, companySettings }: AdminHeaderProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="md:hidden sticky top-0 z-50 h-14 bg-background border-b border-border px-4 flex items-center gap-3">
      <SidebarTrigger className="bg-background shadow-sm border border-border rounded-lg p-2 h-10 w-10 shrink-0" />
      {companySettings?.logoIcon ? (
        <img
          src={companySettings.logoIcon}
          alt={companySettings.companyName || 'Logo'}
          className="w-7 h-7 object-contain shrink-0"
        />
      ) : (
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
          {companySettings?.companyName?.[0] || title[0]}
        </div>
      )}
      <button type="button" className="font-semibold text-foreground select-none text-left truncate" onClick={toggleSidebar}>
        {title}
      </button>
    </header>
  );
}
