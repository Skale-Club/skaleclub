import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { UsersSection } from './UsersSection';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { BlogSection } from '@/components/admin/BlogSection';
import { ChatSection } from '@/components/admin/ChatSection';
import { CompanySettingsSection } from '@/components/admin/CompanySettingsSection';
import { DashboardSection } from '@/components/admin/DashboardSection';
import { FaqsSection } from '@/components/admin/FaqsSection';
import { PortfolioSection } from '@/components/admin/PortfolioSection';
import { WebsiteSettingsSection } from '@/components/admin/WebsiteSettingsSection';
import { IntegrationsSection } from '@/components/admin/IntegrationsSection';
import { LeadsSection } from '@/components/admin/LeadsSection';
import { FormsSection } from '@/components/admin/forms/FormsSection';
import { SEOSection } from '@/components/admin/SEOSection';
import { LinksSection } from '@/components/admin/LinksSection';
import { VCardsManager } from '@/components/admin/VCardsManager';
import { XpotSalesSection } from '@/components/admin/XpotSalesSection';
import { EstimatesSection } from '@/components/admin/EstimatesSection';
import { PresentationsSection } from '@/components/admin/PresentationsSection';
import { SkaleHubSection } from '@/components/admin/SkaleHubSection';
import { NotificationsSection } from '@/components/admin/NotificationsSection';
import { SIDEBAR_MENU_ITEMS } from '@/components/admin/shared/constants';
import { SectionHeader } from '@/components/admin/shared';
import type { AdminSection, CompanySettingsData } from '@/components/admin/shared/types';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Loader2 } from '@/components/ui/loader';

const menuItems = SIDEBAR_MENU_ITEMS;

function AdminContent() {
  const { toast } = useToast();
  const { isAdmin, email, loading, signOut } = useAdminAuth();
  const [location, setLocation] = useLocation();
  const activeSection = useMemo((): AdminSection => {
    const segment = location.replace(/^\/admin\/?/, '').split('/')[0] || 'dashboard';
    const slugMap: Record<string, AdminSection> = {
      dashboard: 'dashboard',
      company: 'company',
      website: 'website',
      portfolio: 'portfolio',
      leads: 'leads',
      forms: 'forms',
      chat: 'chat',
      faqs: 'faqs',
      users: 'users',
      blog: 'blog',
      seo: 'seo',
      integrations: 'integrations',
      links: 'links',
      vcards: 'vcards',
      'field-sales': 'fieldSales',
      estimates: 'estimates',
      presentations: 'presentations',
      'skale-hub': 'skaleHub',
      notifications: 'notifications',
    };
    return slugMap[segment] || 'dashboard';
  }, [location]);
  const [blogResetSignal, setBlogResetSignal] = useState(0);
  const [sectionsOrder, setSectionsOrder] = useState<AdminSection[]>(menuItems.map(item => item.id));

  useEffect(() => {
    if (!loading && !isAdmin) {
      setLocation('/admin/login');
    }
  }, [loading, isAdmin, setLocation]);

  const updateSectionOrder = useCallback(async (newOrder: AdminSection[], previousOrder?: AdminSection[]) => {
    try {
      await apiRequest('PUT', '/api/company-settings', { sectionsOrder: newOrder });
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
    } catch (error: any) {
      if (previousOrder) {
        setSectionsOrder(previousOrder);
      }
      toast({
        title: 'Error saving section order',
        description: error.message,
        variant: 'destructive'
      });
    }
  }, [toast]);

  const handleSectionSelect = useCallback((section: AdminSection) => {
    if (section === 'blog') {
      if (activeSection === 'blog') {
        setBlogResetSignal(prev => prev + 1);
      } else {
        setLocation('/admin/blog');
      }
      return;
    }
    const slugMap: Record<AdminSection, string> = {
      dashboard: 'dashboard',
      company: 'company',
      website: 'website',
      portfolio: 'portfolio',
      leads: 'leads',
      forms: 'forms',
      chat: 'chat',
      faqs: 'faqs',
      users: 'users',
      blog: 'blog',
      seo: 'seo',
      integrations: 'integrations',
      links: 'links',
      vcards: 'vcards',
      fieldSales: 'field-sales',
      estimates: 'estimates',
      presentations: 'presentations',
      skaleHub: 'skale-hub',
      notifications: 'notifications',
    };
    setLocation(`/admin/${slugMap[section]}`);
  }, [activeSection, setLocation]);

  const handleSidebarDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sectionsOrder.indexOf(active.id as AdminSection);
    const newIndex = sectionsOrder.indexOf(over.id as AdminSection);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sectionsOrder, oldIndex, newIndex);
    setSectionsOrder(reordered);
    void updateSectionOrder(reordered, sectionsOrder);
  }, [sectionsOrder, updateSectionOrder]);

  const { data: companySettings } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings']
  });

  useEffect(() => {
    if (companySettings?.companyName && isAdmin) {
      const currentItem = menuItems.find(item => item.id === activeSection);
      if (currentItem) {
        document.title = `${companySettings.companyName} | ${currentItem.title}`;
      } else {
        document.title = `${companySettings.companyName} | Admin`;
      }
    }
  }, [companySettings?.companyName, activeSection, isAdmin]);

  useEffect(() => {
    if (companySettings?.sectionsOrder && companySettings.sectionsOrder.length > 0) {
      const savedOrder = companySettings.sectionsOrder as AdminSection[];
      const allSectionIds = menuItems.map(item => item.id);
      const validSaved = savedOrder.filter(id => allSectionIds.includes(id));
      const missingSections = allSectionIds.filter(id => !validSaved.includes(id));
      setSectionsOrder([...validSaved, ...missingSections]);
    }
  }, [companySettings?.sectionsOrder]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const handleLogout = async () => {
    await signOut();
    setLocation('/admin/login');
  };

  return (
    <div className="flex min-h-screen md:h-screen w-full bg-background relative overflow-x-hidden">
      <AdminSidebar
        activeSection={activeSection}
        sectionsOrder={sectionsOrder}
        companySettings={companySettings}
        email={email}
        onSectionSelect={handleSectionSelect}
        onDragEnd={handleSidebarDragEnd}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-w-0 flex flex-col bg-background md:h-screen md:overflow-hidden" id="admin-top">
        <AdminHeader title={companySettings?.companyName || 'Admin Panel'} />

        {/* Chat gets its own flex wrapper so it can fill the remaining height */}
        {activeSection === 'chat' && (
          <div className="flex-1 min-h-0 flex flex-col p-6 pb-6 md:p-8 md:pb-8">
            <ChatSection />
          </div>
        )}

        {/* All other sections scroll normally */}
        {activeSection !== 'chat' && (
          <div className="flex-1 overflow-y-auto min-h-0 p-6 pb-16 md:p-8 md:pb-10">
            {(() => {
              const sectionsWithOwnHeader: AdminSection[] = ['leads', 'forms', 'faqs', 'users', 'blog', 'portfolio', 'links', 'vcards', 'fieldSales', 'estimates', 'company', 'website', 'seo', 'integrations', 'presentations', 'skaleHub', 'notifications'];
              if (sectionsWithOwnHeader.includes(activeSection)) return null;
              // Dashboard renders its own SectionHeader (with form selector action)
              if (activeSection === 'dashboard') return null;
              const currentItem = menuItems.find(item => item.id === activeSection);
              return currentItem ? (
                <SectionHeader
                  title={currentItem.title}
                  description={currentItem.description}
                  icon={<currentItem.icon className="w-5 h-5" />}
                />
              ) : null;
            })()}
            {activeSection === 'dashboard' && <DashboardSection onNavigate={handleSectionSelect} />}
            {activeSection === 'leads' && <LeadsSection />}
            {activeSection === 'forms' && <FormsSection />}
            {activeSection === 'website' && <WebsiteSettingsSection />}
            {activeSection === 'portfolio' && <PortfolioSection />}
            {activeSection === 'company' && <CompanySettingsSection />}
            {activeSection === 'seo' && <SEOSection />}
            {activeSection === 'faqs' && <FaqsSection />}
            {activeSection === 'users' && <UsersSection />}
            {activeSection === 'integrations' && <IntegrationsSection />}
            {activeSection === 'blog' && <BlogSection resetSignal={blogResetSignal} />}
            {activeSection === 'links' && <LinksSection />}
            {activeSection === 'vcards' && <VCardsManager />}
            {activeSection === 'fieldSales' && <XpotSalesSection />}
            {activeSection === 'estimates' && <EstimatesSection />}
            {activeSection === 'presentations' && <PresentationsSection />}
            {activeSection === 'skaleHub' && <SkaleHubSection />}
            {activeSection === 'notifications' && <NotificationsSection />}
          </div>
        )}
      </main>
    </div>
  );
}

export default function Admin() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <AdminContent />
    </SidebarProvider>
  );
}





