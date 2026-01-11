import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAdminAuth } from '@/context/AuthContext';
import { useLocation, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { renderMarkdown } from '@/lib/markdown';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
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
  SidebarProvider,
  SidebarTrigger,
  useSidebar
} from '@/components/ui/sidebar';
import { 
  Loader2, 
  Plus, 
  Pencil, 
  Trash2, 
  LogOut, 
  FolderOpen, 
  Package, 
  Calendar, 
  Clock, 
  DollarSign, 
  User, 
  MapPin, 
  Image, 
  LayoutDashboard, 
  Building2, 
  GripVertical,
  ArrowLeft,
  Check,
  Users,
  Puzzle,
  Globe,
  Search,
  ChevronDown,
  LayoutGrid,
  List,
  MessageSquare,
  Star,
  Shield,
  Sparkles,
  Heart,
  BadgeCheck,
  ThumbsUp,
  Trophy
} from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import type { Category, Service, Booking, Subcategory, Faq, BlogPost, HomepageContent } from '@shared/schema';
import { HelpCircle, FileText, AlertCircle } from 'lucide-react';
import heroImage from '@assets/Persona-Mobile_1767749022412.png';

type AdminSection = 'dashboard' | 'categories' | 'services' | 'bookings' | 'hero' | 'company' | 'seo' | 'faqs' | 'users' | 'availability' | 'chat' | 'integrations' | 'blog';

const menuItems = [
  { id: 'dashboard' as AdminSection, title: 'Dashboard', icon: LayoutDashboard },
  { id: 'company' as AdminSection, title: 'Company Infos', icon: Building2 },
  { id: 'hero' as AdminSection, title: 'Website', icon: Image },
  { id: 'categories' as AdminSection, title: 'Categories', icon: FolderOpen },
  { id: 'services' as AdminSection, title: 'Services', icon: Package },
  { id: 'bookings' as AdminSection, title: 'Bookings', icon: Calendar },
  { id: 'availability' as AdminSection, title: 'Availability', icon: Clock },
  { id: 'chat' as AdminSection, title: 'Chat', icon: MessageSquare },
  { id: 'faqs' as AdminSection, title: 'FAQs', icon: HelpCircle },
  { id: 'users' as AdminSection, title: 'Users', icon: Users },
  { id: 'blog' as AdminSection, title: 'Blog', icon: FileText },
  { id: 'seo' as AdminSection, title: 'SEO', icon: Search },
  { id: 'integrations' as AdminSection, title: 'Integrations', icon: Puzzle },
];

const DEFAULT_CHAT_OBJECTIVES: IntakeObjective[] = [
  { id: 'zipcode', label: 'Zip code', description: 'Ask for zip/postal code to validate service area', enabled: true },
  { id: 'name', label: 'Name', description: 'Capture the customer name', enabled: true },
  { id: 'phone', label: 'Phone', description: 'Collect phone for confirmations', enabled: true },
  { id: 'serviceType', label: 'Service type', description: 'Which service they want to book', enabled: true },
  { id: 'serviceDetails', label: 'Service details', description: 'Extra info (rooms, size, notes)', enabled: true },
  { id: 'date', label: 'Date & time', description: 'Pick a date/time slot from availability', enabled: true },
  { id: 'address', label: 'Address', description: 'Full address with street, unit, city, state', enabled: true },
];

function AdminContent() {
  const { toast } = useToast();
  const { isAdmin, email, firstName, lastName, loading, signOut } = useAdminAuth();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [sectionsOrder, setSectionsOrder] = useState<AdminSection[]>(menuItems.map(item => item.id));
  const { toggleSidebar } = useSidebar();
  const sidebarSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!loading && !isAdmin) {
      setLocation('/admin/login');
    }
  }, [loading, isAdmin, setLocation]);

  const updateSectionOrder = useCallback(async (newOrder: AdminSection[]) => {
    setSectionsOrder(newOrder);
    try {
      await apiRequest('PUT', '/api/company-settings', { sectionsOrder: newOrder });
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
    } catch (error: any) {
      toast({ 
        title: 'Error saving section order', 
        description: error.message,
        variant: 'destructive'
      });
    }
  }, [toast]);

  const handleSidebarDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSectionsOrder(prev => {
      const oldIndex = prev.indexOf(active.id as AdminSection);
      const newIndex = prev.indexOf(over.id as AdminSection);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);
      updateSectionOrder(reordered);
      return reordered;
    });
  };

  const { data: companySettings } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings']
  });

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
    <div className="flex h-screen w-full bg-slate-50 relative overflow-x-hidden">
      <Sidebar className="border-r border-gray-200 bg-white">
        <SidebarHeader className="p-4 border-b border-gray-100 bg-[#ffffff]">
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
                  className="w-10 h-10 rounded-lg object-contain bg-white p-1 border border-gray-100"
                  data-testid="img-admin-logo"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg">
                  {companySettings?.companyName?.[0] || 'A'}
                </div>
              )}
              <span className="font-semibold text-lg text-primary truncate">
                {companySettings?.companyName || 'Admin Panel'}
              </span>
            </div>
          </div>
        </SidebarHeader>
        
        <SidebarContent className="p-2 bg-[#ffffff]">
          <SidebarGroup>
            <SidebarGroupContent>
              <DndContext
                sensors={sidebarSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleSidebarDragEnd}
              >
                <SortableContext items={sectionsOrder} strategy={verticalListSortingStrategy}>
                  <SidebarMenu>
                    {sectionsOrder.map((sectionId) => {
                      const item = menuItems.find(i => i.id === sectionId)!;
                      return (
                        <SidebarSortableItem
                          key={item.id}
                          item={item}
                          isActive={activeSection === item.id}
                          onSelect={() => setActiveSection(item.id)}
                        />
                      );
                    })}
                  </SidebarMenu>
                </SortableContext>
              </DndContext>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-4 border-t border-gray-100 mt-auto bg-[#ffffff]">
          <div className="space-y-3">
            <div className="text-sm">
              <p className="text-muted-foreground text-xs">Logged in as</p>
              <p className="font-medium truncate">{email}</p>
            </div>
            <Button 
              variant="default" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0" 
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

        <main className="flex-1 min-w-0 overflow-auto relative" id="admin-top">
        <header className="md:hidden sticky top-0 z-50 bg-white border-b border-gray-200 p-4 flex items-center gap-4">
          <SidebarTrigger className="bg-white shadow-sm border border-gray-200 rounded-lg p-2 h-10 w-10 shrink-0" />
          <button
            type="button"
            className="font-semibold text-primary select-none text-left"
            onClick={toggleSidebar}
          >
            Admin Panel
          </button>
        </header>
      <div className="p-6 md:p-8">
        {activeSection === 'dashboard' && (
          <DashboardSection 
            goToBookings={() => {
              if (!sectionsOrder.includes('bookings')) {
                setSectionsOrder(prev => [...prev, 'bookings']);
              }
              setActiveSection('bookings');
              document.getElementById('admin-top')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        )}
          {activeSection === 'categories' && <CategoriesSection />}
          {activeSection === 'services' && <ServicesSection />}
          {activeSection === 'bookings' && <BookingsSection />}
          {activeSection === 'hero' && <HeroSettingsSection />}
          {activeSection === 'company' && <CompanySettingsSection />}
          {activeSection === 'seo' && <SEOSection />}
          {activeSection === 'faqs' && <FaqsSection />}
          {activeSection === 'users' && (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed">
              <Users className="w-12 h-12 mb-4 opacity-20" />
              <p>User management coming soon</p>
            </div>
          )}
          {activeSection === 'availability' && <AvailabilitySection />}
          {activeSection === 'chat' && <ChatSection />}
          {activeSection === 'integrations' && <IntegrationsSection />}
          {activeSection === 'blog' && <BlogSection />}
        </div>
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

function DashboardSection({ goToBookings }: { goToBookings: () => void }) {
  const { data: categories } = useQuery<Category[]>({ queryKey: ['/api/categories'] });
  const { data: services } = useQuery<Service[]>({ queryKey: ['/api/services'] });
  const { data: bookings } = useQuery<Booking[]>({ queryKey: ['/api/bookings'] });

  const stats = [
    { label: 'Total Categories', value: categories?.length || 0, icon: FolderOpen, color: 'text-blue-500' },
    { label: 'Total Services', value: services?.length || 0, icon: Package, color: 'text-green-500' },
    { label: 'Total Bookings', value: bookings?.length || 0, icon: Calendar, color: 'text-purple-500' },
    { label: 'Revenue', value: `$${bookings?.reduce((sum, b) => sum + Number(b.totalPrice), 0).toFixed(2) || '0.00'}`, icon: DollarSign, color: 'text-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your cleaning business</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg transition-all">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <stat.icon className={clsx("w-8 h-8", stat.color)} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Recent Bookings</h2>
          <Button variant="outline" size="sm" onClick={goToBookings}>
            Go to Bookings
          </Button>
        </div>
        <div className="p-6">
          {bookings?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No bookings yet</p>
          ) : (
            <div className="space-y-4">
              {bookings?.slice(0, 5).map((booking) => (
                <div key={booking.id} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-slate-200/50 dark:bg-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{booking.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(booking.bookingDate), "MMM dd, yyyy")} • {booking.startTime} - {booking.endTime}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-[220px]">{booking.customerAddress}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-bold">${booking.totalPrice}</p>
                    <Badge variant={booking.status === 'confirmed' ? 'default' : booking.status === 'completed' ? 'secondary' : 'destructive'} className="text-xs capitalize">
                      {booking.status}
                    </Badge>
                    <Badge variant="outline" className="text-[11px] border-0 bg-slate-50 dark:bg-slate-800">
                      {booking.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroSettingsSection() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings']
  });

  const HERO_DEFAULTS = {
    title: 'Your 5-Star Cleaning Company',
    subtitle: 'Professional cleaning services for homes and businesses. Book your cleaning appointment in less than 1 minute.',
    ctaText: 'Get Instant Price',
    image: heroImage,
  };

  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [homepageContent, setHomepageContent] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFieldTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [savedFields, setSavedFields] = useState<Record<string, boolean>>({});
  const SavedIndicator = ({ field }: { field: string }) => (
    savedFields[field] ? (
      <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 w-4 h-4" />
    ) : null
  );

  useEffect(() => {
    if (settings) {
      setHeroTitle(settings.heroTitle || HERO_DEFAULTS.title);
      setHeroSubtitle(settings.heroSubtitle || HERO_DEFAULTS.subtitle);
      setHeroImageUrl(settings.heroImageUrl || HERO_DEFAULTS.image);
      setCtaText(settings.ctaText || HERO_DEFAULTS.ctaText);
      setHomepageContent({
        ...DEFAULT_HOMEPAGE_CONTENT,
        ...(settings.homepageContent || {}),
        trustBadges: settings.homepageContent?.trustBadges?.length
          ? settings.homepageContent.trustBadges
          : DEFAULT_HOMEPAGE_CONTENT.trustBadges,
        categoriesSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
          ...(settings.homepageContent?.categoriesSection || {}),
        },
        reviewsSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
          ...(settings.homepageContent?.reviewsSection || {}),
        },
        blogSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
          ...(settings.homepageContent?.blogSection || {}),
        },
        areasServedSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
          ...(settings.homepageContent?.areasServedSection || {}),
        },
      });
    }
  }, [settings]);

  useEffect(() => {
    if (!isLoading && !settings) {
      setHeroTitle(HERO_DEFAULTS.title);
      setHeroSubtitle(HERO_DEFAULTS.subtitle);
      setHeroImageUrl(HERO_DEFAULTS.image);
      setCtaText(HERO_DEFAULTS.ctaText);
      setHomepageContent(DEFAULT_HOMEPAGE_CONTENT);
    }
  }, [isLoading, settings]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      Object.values(savedFieldTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  const trustBadges = homepageContent.trustBadges || [];
  const badgeIconOptions = [
    { label: 'Star', value: 'star', icon: Star },
    { label: 'Shield', value: 'shield', icon: Shield },
    { label: 'Clock', value: 'clock', icon: Clock },
    { label: 'Sparkles', value: 'sparkles', icon: Sparkles },
    { label: 'Heart', value: 'heart', icon: Heart },
    { label: 'Badge Check', value: 'badgeCheck', icon: BadgeCheck },
    { label: 'Thumbs Up', value: 'thumbsUp', icon: ThumbsUp },
    { label: 'Trophy', value: 'trophy', icon: Trophy },
  ];
  const categoriesSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
    ...(homepageContent.categoriesSection || {}),
  };
  const reviewsSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
    ...(homepageContent.reviewsSection || {}),
  };
  const blogSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
    ...(homepageContent.blogSection || {}),
  };
  const areasServedSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
    ...(homepageContent.areasServedSection || {}),
  };

  const markFieldsSaved = useCallback((fields: string[]) => {
    fields.forEach(field => {
      setSavedFields(prev => ({ ...prev, [field]: true }));
      if (savedFieldTimers.current[field]) {
        clearTimeout(savedFieldTimers.current[field]);
      }
      savedFieldTimers.current[field] = setTimeout(() => {
        setSavedFields(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }, 3000);
    });
  }, []);

  const saveHeroSettings = useCallback(async (updates: Partial<CompanySettingsData>, fieldKeys?: string[]) => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/company-settings', updates);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      const keysToMark = fieldKeys && fieldKeys.length > 0 ? fieldKeys : Object.keys(updates);
      if (keysToMark.length > 0) {
        markFieldsSaved(keysToMark);
      }
    } catch (error: any) {
      toast({ 
        title: 'Error saving hero settings', 
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  const triggerAutoSave = useCallback((updates: Partial<CompanySettingsData>, fieldKeys?: string[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveHeroSettings(updates, fieldKeys);
    }, 800);
  }, [saveHeroSettings]);

  const updateHomepageContent = useCallback((updater: (prev: HomepageContent) => HomepageContent, fieldKey?: string) => {
    setHomepageContent(prev => {
      const updated = updater(prev);
      triggerAutoSave({ homepageContent: updated }, fieldKey ? [fieldKey] : ['homepageContent']);
      return updated;
    });
  }, [triggerAutoSave]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const uploadRes = await apiRequest('POST', '/api/upload');
      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      setHeroImageUrl(objectPath);
      await saveHeroSettings({ heroImageUrl: objectPath }, ['heroImageUrl']);
      toast({ title: 'Hero image uploaded and saved' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Hero Section</h1>
          <p className="text-muted-foreground">Customize hero and homepage content</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
        </div>
      </div>
      <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg transition-all space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold">Hero Section</h2>
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="heroTitle">Hero Title</Label>
              <div className="relative">
                <Input 
                  id="heroTitle" 
                  value={heroTitle} 
                  onChange={(e) => {
                    setHeroTitle(e.target.value);
                    triggerAutoSave({ heroTitle: e.target.value }, ['heroTitle']);
                  }}
                  placeholder="Enter hero title"
                  data-testid="input-hero-title"
                />
                <SavedIndicator field="heroTitle" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
              <div className="relative">
                <Textarea 
                  id="heroSubtitle" 
                  value={heroSubtitle} 
                  onChange={(e) => {
                    setHeroSubtitle(e.target.value);
                    triggerAutoSave({ heroSubtitle: e.target.value }, ['heroSubtitle']);
                  }}
                  placeholder="Enter hero subtitle"
                  data-testid="input-hero-subtitle"
                  className="min-h-[120px]"
                />
                <SavedIndicator field="heroSubtitle" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaText">Call to Action Button Text</Label>
              <div className="relative">
                <Input 
                  id="ctaText" 
                  value={ctaText} 
                  onChange={(e) => {
                    setCtaText(e.target.value);
                    triggerAutoSave({ ctaText: e.target.value }, ['ctaText']);
                  }}
                  placeholder="Book Now"
                  data-testid="input-cta-text"
                />
                <SavedIndicator field="ctaText" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="heroImage">Hero Image</Label>
              <div className="flex flex-col gap-3">
                <div className="aspect-[4/3] w-full max-w-xs rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden relative group">
                  {heroImageUrl ? (
                    <img src={heroImageUrl} alt="Hero preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <Image className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">Background Image</p>
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                    <Plus className="w-8 h-8 text-white" />
                  </label>
                </div>
                <div className="flex gap-2 max-w-xs">
                  <div className="relative w-full">
                    <Input 
                      value={heroImageUrl} 
                      onChange={(e) => {
                        setHeroImageUrl(e.target.value);
                        triggerAutoSave({ heroImageUrl: e.target.value }, ['heroImageUrl']);
                      }}
                      placeholder="Or enter image URL (https://...)"
                      data-testid="input-hero-image"
                    />
                    <SavedIndicator field="heroImageUrl" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4">
          <h3 className="text-base font-semibold">Hero Badge</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Badge Image URL</Label>
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Input
                    value={homepageContent.heroBadgeImageUrl || ''}
                    onChange={(e) =>
                      updateHomepageContent(prev => ({ ...prev, heroBadgeImageUrl: e.target.value }), 'homepageContent.heroBadgeImageUrl')
                    }
                    placeholder="https://..."
                  />
                  <SavedIndicator field="homepageContent.heroBadgeImageUrl" />
                </div>
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const uploadRes = await apiRequest('POST', '/api/upload');
                        const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };
                        await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
                        updateHomepageContent(prev => ({ ...prev, heroBadgeImageUrl: objectPath }), 'homepageContent.heroBadgeImageUrl');
                        setHomepageContent(prev => ({ ...prev, heroBadgeImageUrl: objectPath }));
                        triggerAutoSave({ homepageContent: { ...(homepageContent || {}), heroBadgeImageUrl: objectPath } }, ['homepageContent.heroBadgeImageUrl']);
                        toast({ title: 'Badge uploaded and saved' });
                      } catch (error: any) {
                        toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
                      } finally {
                        if (e.target) {
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Badge Alt Text</Label>
              <div className="relative">
                <Input
                  value={homepageContent.heroBadgeAlt || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({ ...prev, heroBadgeAlt: e.target.value }), 'homepageContent.heroBadgeAlt')
                  }
                  placeholder="Trusted Experts"
                />
                <SavedIndicator field="homepageContent.heroBadgeAlt" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Badge Icon</Label>
              <Select
                value={homepageContent.trustBadges?.[0]?.icon || 'star'}
                onValueChange={(value) => {
                  updateHomepageContent(prev => {
                    const badges = [...(prev.trustBadges || DEFAULT_HOMEPAGE_CONTENT.trustBadges || [])];
                    badges[0] = { ...(badges[0] || {}), icon: value };
                    return { ...prev, trustBadges: badges };
                  }, 'homepageContent.trustBadges.0.icon');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {badgeIconOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="w-4 h-4" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg transition-all space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold">Trust Badges</h2>
          <Button
            variant="outline"
            size="sm"
            className="border-dashed"
            onClick={() =>
              updateHomepageContent(prev => ({
                ...prev,
                trustBadges: [...(prev.trustBadges || []), { title: 'New Badge', description: '' }],
              }))
            }
          >
            <Plus className="w-4 h-4 mr-2" /> Add badge
          </Button>
        </div>
        <div className="space-y-4">
          {trustBadges.map((badge, index) => (
            <div
              key={index}
              className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto] items-start bg-white/40 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <div className="space-y-2">
                <Label>Title</Label>
                <div className="relative">
                  <Input
                    value={badge.title}
                    onChange={(e) =>
                      updateHomepageContent(prev => {
                        const updatedBadges = [...(prev.trustBadges || [])];
                        updatedBadges[index] = {
                          ...(updatedBadges[index] || { title: '', description: '' }),
                          title: e.target.value,
                        };
                        return { ...prev, trustBadges: updatedBadges };
                      }, `homepageContent.trustBadges.${index}.title`)
                    }
                  />
                  <SavedIndicator field={`homepageContent.trustBadges.${index}.title`} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <div className="relative">
                  <Input
                    value={badge.description}
                    onChange={(e) =>
                      updateHomepageContent(prev => {
                        const updatedBadges = [...(prev.trustBadges || [])];
                        updatedBadges[index] = {
                          ...(updatedBadges[index] || { title: '', description: '' }),
                          description: e.target.value,
                        };
                        return { ...prev, trustBadges: updatedBadges };
                      }, `homepageContent.trustBadges.${index}.description`)
                    }
                  />
                  <SavedIndicator field={`homepageContent.trustBadges.${index}.description`} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select
                  value={badge.icon || badgeIconOptions[index % badgeIconOptions.length].value}
                  onValueChange={(value) =>
                    updateHomepageContent(prev => {
                      const updatedBadges = [...(prev.trustBadges || [])];
                      updatedBadges[index] = {
                        ...(updatedBadges[index] || { title: '', description: '' }),
                        icon: value,
                      };
                      return { ...prev, trustBadges: updatedBadges };
                    }, `homepageContent.trustBadges.${index}.icon`)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {badgeIconOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className="w-4 h-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end items-start pt-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    updateHomepageContent(prev => {
                      const updatedBadges = (prev.trustBadges || []).filter((_, i) => i !== index);
                      return { ...prev, trustBadges: updatedBadges };
                    })
                  }
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {trustBadges.length === 0 && (
            <p className="text-sm text-muted-foreground">No badges added yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold">Categories Section</h2>
          <div className="space-y-2">
            <Label>Title</Label>
            <div className="relative">
              <Input
                value={categoriesSection.title || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    categoriesSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
                      ...(prev.categoriesSection || {}),
                      title: e.target.value,
                    },
                  }), 'homepageContent.categoriesSection.title')
                }
              />
              <SavedIndicator field="homepageContent.categoriesSection.title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <div className="relative">
              <Textarea
                value={categoriesSection.subtitle || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    categoriesSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
                      ...(prev.categoriesSection || {}),
                      subtitle: e.target.value,
                    },
                  }), 'homepageContent.categoriesSection.subtitle')
                }
                className="min-h-[100px]"
              />
              <SavedIndicator field="homepageContent.categoriesSection.subtitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CTA Text</Label>
            <div className="relative">
              <Input
                value={categoriesSection.ctaText || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    categoriesSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
                      ...(prev.categoriesSection || {}),
                      ctaText: e.target.value,
                    },
                  }), 'homepageContent.categoriesSection.ctaText')
                }
              />
              <SavedIndicator field="homepageContent.categoriesSection.ctaText" />
            </div>
          </div>
        </div>

        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold">Reviews Section</h2>
          <div className="space-y-2">
            <Label>Heading</Label>
            <div className="relative">
              <Input
                value={reviewsSection.title || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    reviewsSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
                      ...(prev.reviewsSection || {}),
                      title: e.target.value,
                    },
                  }), 'homepageContent.reviewsSection.title')
                }
              />
              <SavedIndicator field="homepageContent.reviewsSection.title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <div className="relative">
              <Textarea
                value={reviewsSection.subtitle || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    reviewsSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
                      ...(prev.reviewsSection || {}),
                      subtitle: e.target.value,
                    },
                  }), 'homepageContent.reviewsSection.subtitle')
                }
                className="min-h-[100px]"
              />
              <SavedIndicator field="homepageContent.reviewsSection.subtitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Review Widget Embed URL</Label>
            <div className="relative">
              <Input
                value={reviewsSection.embedUrl || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    reviewsSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
                      ...(prev.reviewsSection || {}),
                      embedUrl: e.target.value,
                    },
                  }), 'homepageContent.reviewsSection.embedUrl')
                }
                placeholder="https://..."
              />
              <SavedIndicator field="homepageContent.reviewsSection.embedUrl" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold">Blog Section</h2>
          <div className="space-y-2">
            <Label>Title</Label>
            <div className="relative">
              <Input
                value={blogSection.title || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      title: e.target.value,
                    },
                  }), 'homepageContent.blogSection.title')
                }
              />
              <SavedIndicator field="homepageContent.blogSection.title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <div className="relative">
              <Textarea
                value={blogSection.subtitle || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      subtitle: e.target.value,
                    },
                  }), 'homepageContent.blogSection.subtitle')
                }
                className="min-h-[100px]"
              />
              <SavedIndicator field="homepageContent.blogSection.subtitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>View All Text</Label>
            <div className="relative">
              <Input
                value={blogSection.viewAllText || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      viewAllText: e.target.value,
                    },
                  }), 'homepageContent.blogSection.viewAllText')
                }
              />
              <SavedIndicator field="homepageContent.blogSection.viewAllText" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Card CTA Text</Label>
            <div className="relative">
              <Input
                value={blogSection.readMoreText || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      readMoreText: e.target.value,
                    },
                  }), 'homepageContent.blogSection.readMoreText')
                }
              />
              <SavedIndicator field="homepageContent.blogSection.readMoreText" />
            </div>
          </div>
        </div>

        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold">Areas Served Section</h2>
          <div className="space-y-2">
            <Label>Label</Label>
            <div className="relative">
              <Input
                value={areasServedSection.label || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      label: e.target.value,
                    },
                  }), 'homepageContent.areasServedSection.label')
                }
              />
              <SavedIndicator field="homepageContent.areasServedSection.label" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Heading</Label>
            <div className="relative">
              <Input
                value={areasServedSection.heading || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      heading: e.target.value,
                    },
                  }), 'homepageContent.areasServedSection.heading')
                }
              />
              <SavedIndicator field="homepageContent.areasServedSection.heading" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <div className="relative">
              <Textarea
                value={areasServedSection.description || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      description: e.target.value,
                    },
                  }), 'homepageContent.areasServedSection.description')
                }
                className="min-h-[120px]"
              />
              <SavedIndicator field="homepageContent.areasServedSection.description" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CTA Text</Label>
            <div className="relative">
              <Input
                value={areasServedSection.ctaText || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      ctaText: e.target.value,
                    },
                  }), 'homepageContent.areasServedSection.ctaText')
                }
              />
              <SavedIndicator field="homepageContent.areasServedSection.ctaText" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DayHours {
  isOpen: boolean;
  start: string;
  end: string;
}

interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday: { isOpen: true, start: '08:00', end: '18:00' },
  tuesday: { isOpen: true, start: '08:00', end: '18:00' },
  wednesday: { isOpen: true, start: '08:00', end: '18:00' },
  thursday: { isOpen: true, start: '08:00', end: '18:00' },
  friday: { isOpen: true, start: '08:00', end: '18:00' },
  saturday: { isOpen: false, start: '09:00', end: '14:00' },
  sunday: { isOpen: false, start: '09:00', end: '14:00' },
};

interface CompanySettingsData {
  id?: number;
  companyName: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  logoMain: string | null;
  logoDark: string | null;
  logoIcon: string | null;
  sectionsOrder: AdminSection[] | null;
  socialLinks: { platform: string; url: string }[] | null;
  mapEmbedUrl: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  ctaText: string | null;
  homepageContent: HomepageContent | null;
  timeFormat: string | null;
  businessHours: BusinessHours | null;
  minimumBookingValue: string | null;
}

interface SEOSettingsData {
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
  seoKeywords: string | null;
  seoAuthor: string | null;
  seoCanonicalUrl: string | null;
  seoRobotsTag: string | null;
  ogType: string | null;
  ogSiteName: string | null;
  twitterCard: string | null;
  twitterSite: string | null;
  twitterCreator: string | null;
  schemaLocalBusiness: Record<string, any> | null;
}

function CompanySettingsSection() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<CompanySettingsData>({
    companyName: 'Skleanings',
    companyEmail: 'contact@skleanings.com',
    companyPhone: '',
    companyAddress: '',
    workingHoursStart: '08:00',
    workingHoursEnd: '18:00',
    logoMain: '',
    logoDark: '',
    logoIcon: '',
    sectionsOrder: null,
    socialLinks: [],
    mapEmbedUrl: '',
    heroTitle: '',
    heroSubtitle: '',
    heroImageUrl: '',
    ctaText: '',
    homepageContent: DEFAULT_HOMEPAGE_CONTENT,
    timeFormat: '12h',
    businessHours: DEFAULT_BUSINESS_HOURS,
    minimumBookingValue: '0',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: fetchedSettings, isLoading } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings']
  });

  useEffect(() => {
    if (fetchedSettings) {
      setSettings(fetchedSettings);
    }
  }, [fetchedSettings]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const saveSettings = useCallback(async (newSettings: Partial<CompanySettingsData>) => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/company-settings', newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      setLastSaved(new Date());
    } catch (error: any) {
      toast({ 
        title: 'Error saving settings', 
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  const updateField = useCallback(<K extends keyof CompanySettingsData>(field: K, value: CompanySettingsData[K]) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveSettings({ [field]: value });
    }, 800);
  }, [saveSettings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'dark' | 'icon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const uploadRes = await apiRequest('POST', '/api/upload');
      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      const fieldMap = { main: 'logoMain', dark: 'logoDark', icon: 'logoIcon' } as const;
      const fieldName = fieldMap[type];
      
      setSettings(prev => ({ ...prev, [fieldName]: objectPath }));
      await saveSettings({ [fieldName]: objectPath });
      
      toast({ title: 'Asset uploaded and saved' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Company Settings</h1>
          <p className="text-muted-foreground">Manage your business information and assets</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : lastSaved ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span>Auto-saved</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Business Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input 
                  id="companyName" 
                  value={settings.companyName || ''} 
                  onChange={(e) => updateField('companyName', e.target.value)}
                  data-testid="input-company-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyEmail">Contact Email</Label>
                <Input 
                  id="companyEmail" 
                  type="email"
                  value={settings.companyEmail || ''} 
                  onChange={(e) => updateField('companyEmail', e.target.value)}
                  data-testid="input-company-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyPhone">Phone Number</Label>
                <Input 
                  id="companyPhone" 
                  value={settings.companyPhone || ''} 
                  onChange={(e) => updateField('companyPhone', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  data-testid="input-company-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyAddress">Business Address</Label>
                <Input 
                  id="companyAddress" 
                  value={settings.companyAddress || ''} 
                  onChange={(e) => updateField('companyAddress', e.target.value)}
                  placeholder="123 Main St, City, State"
                  data-testid="input-company-address"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="mapEmbedUrl">Map Embed URL (Iframe src)</Label>
                <Input 
                  id="mapEmbedUrl" 
                  value={settings.mapEmbedUrl || ''} 
                  onChange={(e) => updateField('mapEmbedUrl', e.target.value)}
                  placeholder="https://www.google.com/maps/embed?..."
                  data-testid="input-map-embed-url"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste the iframe "src" attribute from Google Maps "Share -{'>'} Embed a map" to update the map shown on the home page.
                </p>
              </div>
            </div>
          </div>

        </div>

        <div className="space-y-6">
          <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Image className="w-5 h-5 text-primary" />
              Branding Assets
            </h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Main Logo (Light Mode)</Label>
                <div className="flex flex-col gap-3">
                  <div className="h-32 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white flex items-center justify-center overflow-hidden relative group">
                    {settings.logoMain ? (
                      <img src={settings.logoMain} alt="Main Logo" className="max-h-full max-w-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-4">
                        <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">Main Logo</p>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Input type="file" className="hidden" onChange={(e) => handleLogoUpload(e, 'main')} accept="image/*" />
                      <Plus className="w-8 h-8 text-white" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Dark Logo (Optional)</Label>
                <div className="flex flex-col gap-3">
                  <div className="h-32 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-slate-900 flex items-center justify-center overflow-hidden relative group">
                    {settings.logoDark ? (
                      <img src={settings.logoDark} alt="Dark Logo" className="max-h-full max-w-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-4">
                        <Image className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                        <p className="text-xs text-gray-600">Dark Logo</p>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Input type="file" className="hidden" onChange={(e) => handleLogoUpload(e, 'dark')} accept="image/*" />
                      <Plus className="w-8 h-8 text-white" />
                    </label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Favicon / App Icon</Label>
                <div className="flex flex-col gap-3">
                  <div className="h-24 w-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white flex items-center justify-center overflow-hidden relative group mx-auto">
                    {settings.logoIcon ? (
                      <img src={settings.logoIcon} alt="Icon" className="max-h-full max-w-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-2">
                        <Image className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <p className="text-[10px] text-gray-400">Icon</p>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Input type="file" className="hidden" onChange={(e) => handleLogoUpload(e, 'icon')} accept="image/*" />
                      <Plus className="w-6 h-6 text-white" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t pt-6 mt-2">
                <Label className="text-base font-semibold">Social Media Links (Max 5)</Label>
                <div className="space-y-3">
                  {(settings.socialLinks || []).map((link, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <Select
                          value={link.platform}
                          onValueChange={(value) => {
                            const newLinks = [...(settings.socialLinks || [])];
                            newLinks[index].platform = value;
                            setSettings(prev => ({ ...prev, socialLinks: newLinks }));
                            saveSettings({ socialLinks: newLinks });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Platform" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="twitter">X (Twitter)</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="tiktok">TikTok</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={link.url}
                          onChange={(e) => {
                            const newLinks = [...(settings.socialLinks || [])];
                            newLinks[index].url = e.target.value;
                            setSettings(prev => ({ ...prev, socialLinks: newLinks }));
                          }}
                          onBlur={() => saveSettings({ socialLinks: settings.socialLinks })}
                          placeholder="https://social-media.com/yourprofile"
                          className="flex-1"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-1"
                        onClick={() => {
                          const newLinks = (settings.socialLinks || []).filter((_, i) => i !== index);
                          setSettings(prev => ({ ...prev, socialLinks: newLinks }));
                          saveSettings({ socialLinks: newLinks });
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  
                  {(settings.socialLinks || []).length < 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed"
                      onClick={() => {
                        const newLinks = [...(settings.socialLinks || []), { platform: 'facebook', url: '' }];
                        setSettings(prev => ({ ...prev, socialLinks: newLinks }));
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Social Link
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SEOSection() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SEOSettingsData>({
    seoTitle: '',
    seoDescription: '',
    ogImage: '',
    seoKeywords: '',
    seoAuthor: '',
    seoCanonicalUrl: '',
    seoRobotsTag: 'index, follow',
    ogType: 'website',
    ogSiteName: '',
    twitterCard: 'summary_large_image',
    twitterSite: '',
    twitterCreator: '',
    schemaLocalBusiness: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: fetchedSettings, isLoading } = useQuery<SEOSettingsData>({
    queryKey: ['/api/company-settings']
  });

  useEffect(() => {
    if (fetchedSettings) {
      setSettings(prev => ({
        ...prev,
        seoTitle: fetchedSettings.seoTitle || '',
        seoDescription: fetchedSettings.seoDescription || '',
        ogImage: fetchedSettings.ogImage || '',
        seoKeywords: fetchedSettings.seoKeywords || '',
        seoAuthor: fetchedSettings.seoAuthor || '',
        seoCanonicalUrl: fetchedSettings.seoCanonicalUrl || '',
        seoRobotsTag: fetchedSettings.seoRobotsTag || 'index, follow',
        ogType: fetchedSettings.ogType || 'website',
        ogSiteName: fetchedSettings.ogSiteName || '',
        twitterCard: fetchedSettings.twitterCard || 'summary_large_image',
        twitterSite: fetchedSettings.twitterSite || '',
        twitterCreator: fetchedSettings.twitterCreator || '',
        schemaLocalBusiness: fetchedSettings.schemaLocalBusiness || null,
      }));
    }
  }, [fetchedSettings]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const saveSettings = useCallback(async (newSettings: Partial<SEOSettingsData>) => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/company-settings', newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      setLastSaved(new Date());
    } catch (error: any) {
      toast({ 
        title: 'Error saving settings', 
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  const updateField = useCallback(<K extends keyof SEOSettingsData>(field: K, value: SEOSettingsData[K]) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveSettings({ [field]: value });
    }, 800);
  }, [saveSettings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">SEO Settings</h1>
          <p className="text-muted-foreground">Optimize your site for search engines and social media</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : lastSaved ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span>Auto-saved</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Basic SEO
            </h2>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="seoTitle">Page Title</Label>
                <Input 
                  id="seoTitle" 
                  value={settings.seoTitle || ''} 
                  onChange={(e) => updateField('seoTitle', e.target.value)}
                  placeholder="Your Business - Main Service"
                  data-testid="input-seo-title"
                />
                <p className="text-xs text-muted-foreground">
                  Appears in browser tab and search results (50-60 characters recommended)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoDescription">Meta Description</Label>
                <Textarea 
                  id="seoDescription" 
                  value={settings.seoDescription || ''} 
                  onChange={(e) => updateField('seoDescription', e.target.value)}
                  placeholder="Brief description of your business and services..."
                  rows={3}
                  data-testid="input-seo-description"
                />
                <p className="text-xs text-muted-foreground">
                  Shown in search results (150-160 characters recommended)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoKeywords">Keywords</Label>
                <Input 
                  id="seoKeywords" 
                  value={settings.seoKeywords || ''} 
                  onChange={(e) => updateField('seoKeywords', e.target.value)}
                  placeholder="cleaning services, house cleaning, professional cleaners"
                  data-testid="input-seo-keywords"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated keywords relevant to your business
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoAuthor">Author / Publisher</Label>
                <Input 
                  id="seoAuthor" 
                  value={settings.seoAuthor || ''} 
                  onChange={(e) => updateField('seoAuthor', e.target.value)}
                  placeholder="Your Company Name"
                  data-testid="input-seo-author"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoCanonicalUrl">Canonical URL</Label>
                <Input 
                  id="seoCanonicalUrl" 
                  value={settings.seoCanonicalUrl || ''} 
                  onChange={(e) => updateField('seoCanonicalUrl', e.target.value)}
                  placeholder="https://yourdomain.com"
                  data-testid="input-seo-canonical"
                />
                <p className="text-xs text-muted-foreground">
                  Your main website URL (prevents duplicate content issues)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoRobotsTag">Robots Tag</Label>
                <Select
                  value={settings.seoRobotsTag || 'index, follow'}
                  onValueChange={(value) => updateField('seoRobotsTag', value)}
                >
                  <SelectTrigger data-testid="select-robots-tag">
                    <SelectValue placeholder="Select robots directive" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="index, follow">Index, Follow (recommended)</SelectItem>
                    <SelectItem value="index, nofollow">Index, No Follow</SelectItem>
                    <SelectItem value="noindex, follow">No Index, Follow</SelectItem>
                    <SelectItem value="noindex, nofollow">No Index, No Follow</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Controls how search engines crawl and index your site
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Open Graph (Social Sharing)
            </h2>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="ogSiteName">Site Name</Label>
                <Input 
                  id="ogSiteName" 
                  value={settings.ogSiteName || ''} 
                  onChange={(e) => updateField('ogSiteName', e.target.value)}
                  placeholder="Your Business Name"
                  data-testid="input-og-site-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ogType">Content Type</Label>
                <Select
                  value={settings.ogType || 'website'}
                  onValueChange={(value) => updateField('ogType', value)}
                >
                  <SelectTrigger data-testid="select-og-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="business.business">Business</SelectItem>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>OG Image</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Image shown when shared on Facebook, LinkedIn, etc. (1200x630px recommended)
                </p>
                <div className="flex flex-col gap-3">
                  <div className="aspect-[1.91/1] w-full max-w-xs rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden relative group">
                    {settings.ogImage ? (
                      <img src={settings.ogImage} alt="OG Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-4">
                        <Image className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">1200 x 630 px</p>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Input 
                        type="file" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const uploadRes = await apiRequest('POST', '/api/upload');
                            const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };
                            await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
                            setSettings(prev => ({ ...prev, ogImage: objectPath }));
                            await saveSettings({ ogImage: objectPath });
                            toast({ title: 'Open Graph image uploaded' });
                          } catch (error: any) {
                            toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
                          }
                        }} 
                        accept="image/*" 
                      />
                      <Plus className="w-8 h-8 text-white" />
                    </label>
                  </div>
                  {settings.ogImage && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-fit"
                      onClick={() => {
                        setSettings(prev => ({ ...prev, ogImage: '' }));
                        saveSettings({ ogImage: '' });
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Remove Image
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Twitter Cards
            </h2>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="twitterCard">Card Type</Label>
                <Select
                  value={settings.twitterCard || 'summary_large_image'}
                  onValueChange={(value) => updateField('twitterCard', value)}
                >
                  <SelectTrigger data-testid="select-twitter-card">
                    <SelectValue placeholder="Select card type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Summary</SelectItem>
                    <SelectItem value="summary_large_image">Summary with Large Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitterSite">Twitter @username (Site)</Label>
                <Input 
                  id="twitterSite" 
                  value={settings.twitterSite || ''} 
                  onChange={(e) => updateField('twitterSite', e.target.value)}
                  placeholder="@yourbusiness"
                  data-testid="input-twitter-site"
                />
                <p className="text-xs text-muted-foreground">
                  Your business Twitter handle
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitterCreator">Twitter @username (Creator)</Label>
                <Input 
                  id="twitterCreator" 
                  value={settings.twitterCreator || ''} 
                  onChange={(e) => updateField('twitterCreator', e.target.value)}
                  placeholder="@yourhandle"
                  data-testid="input-twitter-creator"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoriesSection() {
  const { toast } = useToast();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [orderedCategories, setOrderedCategories] = useState<Category[]>([]);
  const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
  const [selectedCategoryForSubs, setSelectedCategoryForSubs] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [subName, setSubName] = useState('');
  const reorderSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories']
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['/api/services']
  });

  const { data: subcategories } = useQuery<Subcategory[]>({
    queryKey: ['/api/subcategories']
  });

  useEffect(() => {
    if (categories) {
      const sorted = [...categories].sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA === orderB) return a.id - b.id;
        return orderA - orderB;
      });
      setOrderedCategories(sorted);
    }
  }, [categories]);

  const createCategory = useMutation({
    mutationFn: async (data: { name: string; slug: string; description: string; imageUrl: string }) => {
      return apiRequest('POST', '/api/categories', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: 'Category created successfully' });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create category', description: error.message, variant: 'destructive' });
    }
  });

  const updateCategory = useMutation({
    mutationFn: async (data: { id: number; name: string; slug: string; description: string; imageUrl: string }) => {
      return apiRequest('PUT', `/api/categories/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: 'Category updated successfully' });
      setEditingCategory(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update category', description: error.message, variant: 'destructive' });
    }
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: 'Category deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete category', description: error.message, variant: 'destructive' });
    }
  });

  const getServiceCount = (categoryId: number) => {
    return services?.filter(s => s.categoryId === categoryId).length || 0;
  };

  const createSubcategory = useMutation({
    mutationFn: async (data: { name: string; slug: string; categoryId: number }) => {
      return apiRequest('POST', '/api/subcategories', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory created successfully' });
      setEditingSubcategory(null);
      setSubName('');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const updateSubcategory = useMutation({
    mutationFn: async (data: { id: number; name: string; slug: string; categoryId: number }) => {
      return apiRequest('PUT', `/api/subcategories/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory updated successfully' });
      setEditingSubcategory(null);
      setSubName('');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const deleteSubcategory = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/subcategories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const handleOpenSubDialog = (category: Category) => {
    setSelectedCategoryForSubs(category);
    setEditingSubcategory(null);
    setSubName('');
    setIsSubDialogOpen(true);
  };

  const handleSaveSubcategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryForSubs) return;
    const payload = {
      name: subName,
      slug: subName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      categoryId: selectedCategoryForSubs.id,
    };
    if (editingSubcategory) {
      updateSubcategory.mutate({ ...payload, id: editingSubcategory.id });
    } else {
      createSubcategory.mutate(payload);
    }
  };

  const categorySubcategories = selectedCategoryForSubs
    ? subcategories?.filter(sub => sub.categoryId === selectedCategoryForSubs.id)
    : [];

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedCategories(prev => {
      const oldIndex = prev.findIndex(c => c.id === Number(active.id));
      const newIndex = prev.findIndex(c => c.id === Number(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      const previous = prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);

      const reorderPayload = reordered.map((cat, index) => ({
        id: cat.id,
        order: index
      }));

      apiRequest('PUT', '/api/categories/reorder', { order: reorderPayload })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
          toast({ title: 'Category order updated' });
        })
        .catch((error: any) => {
          toast({
            title: 'Failed to update order',
            description: error.message,
            variant: 'destructive'
          });
          setOrderedCategories(previous);
        });

      return reordered;
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground">Manage your service categories. Drag to reorder.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingCategory(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-category" className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CategoryForm 
              category={editingCategory}
              onSubmit={(data) => {
                if (editingCategory) {
                  updateCategory.mutate({ ...data, id: editingCategory.id });
                } else {
                  createCategory.mutate(data);
                }
              }}
              isLoading={createCategory.isPending || updateCategory.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {orderedCategories?.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No categories yet</h3>
          <p className="text-muted-foreground mb-4">Create your first category to get started</p>
        </Card>
      ) : (
        <DndContext
          sensors={reorderSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleCategoryDragEnd}
        >
          <SortableContext
            items={orderedCategories.map(cat => cat.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-3">
              {orderedCategories?.map((category, index) => (
                <CategoryReorderRow
                  key={category.id}
                  category={category}
                  serviceCount={getServiceCount(category.id)}
                  onEdit={() => { setEditingCategory(category); setIsDialogOpen(true); }}
                  onDelete={() => deleteCategory.mutate(category.id)}
                  disableDelete={getServiceCount(category.id) > 0}
                  index={index}
                  onManageSubcategories={() => handleOpenSubDialog(category)}
                  subcategories={subcategories}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={isSubDialogOpen} onOpenChange={(open) => {
        setIsSubDialogOpen(open);
        if (!open) {
          setSelectedCategoryForSubs(null);
          setEditingSubcategory(null);
          setSubName('');
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Manage subcategories {selectedCategoryForSubs ? `for ${selectedCategoryForSubs.name}` : ''}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveSubcategory} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subcategory-name-inline">Name</Label>
              <Input
                id="subcategory-name-inline"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                required
                data-testid="input-subcategory-name-inline"
              />
            </div>
            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={
                  !subName ||
                  createSubcategory.isPending ||
                  updateSubcategory.isPending ||
                  !selectedCategoryForSubs
                }
              >
                {(createSubcategory.isPending || updateSubcategory.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingSubcategory ? 'Update subcategory' : 'Add subcategory'}
              </Button>
            </div>
          </form>

          <div className="mt-6 space-y-3 max-h-80 overflow-y-auto pr-1">
            {categorySubcategories && categorySubcategories.length > 0 ? (
              categorySubcategories.map((subcategory) => (
                <div
                  key={subcategory.id}
                  className="flex items-center gap-3 p-3 rounded-md border border-gray-200 dark:border-slate-700"
                  data-testid={`subcategory-item-${subcategory.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{subcategory.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {services?.filter(s => s.subcategoryId === subcategory.id).length || 0} services
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingSubcategory(subcategory);
                        setSubName(subcategory.name);
                      }}
                      data-testid={`button-edit-subcategory-${subcategory.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-delete-subcategory-${subcategory.id}`}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Subcategory?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {(services?.filter(s => s.subcategoryId === subcategory.id).length || 0) > 0
                              ? 'This subcategory has services. Delete or reassign them first.'
                              : 'This action cannot be undone.'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteSubcategory.mutate(subcategory.id)}
                            disabled={(services?.filter(s => s.subcategoryId === subcategory.id).length || 0) > 0}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No subcategories yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryForm({ category, onSubmit, isLoading }: { 
  category: Category | null; 
  onSubmit: (data: { name: string; slug: string; description: string; imageUrl: string }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [imageUrl, setImageUrl] = useState(category?.imageUrl || '');

  const generateSlug = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await fetch('/api/upload', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to get upload URL');
      const { uploadURL, objectPath } = await res.json();

      const uploadRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });
      if (!uploadRes.ok) throw new Error('Upload to storage failed');

      setImageUrl(objectPath);
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, slug: generateSlug(name), description, imageUrl });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{category ? 'Edit Category' : 'Add Category'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-category-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-category-description" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="imageUrl">Category Image</Label>
          <div className="flex flex-col gap-4">
            <Input 
              id="categoryImageUpload" 
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload} 
              data-testid="input-category-image-upload" 
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Or URL:</span>
              <Input 
                id="imageUrl" 
                value={imageUrl} 
                onChange={(e) => setImageUrl(e.target.value)} 
                placeholder="https://..." 
                className="h-8 text-xs"
                data-testid="input-category-image" 
              />
            </div>
            {imageUrl && (
              <div className="relative w-full aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                <img 
                  src={imageUrl} 
                  alt="Preview" 
                  className="absolute inset-0 w-full h-full object-cover" 
                />
                <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                  4:3 Preview
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading} data-testid="button-save-category">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {category ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SubcategoriesSection() {
  const { toast } = useToast();
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/categories']
  });

  const { data: subcategories, isLoading } = useQuery<Subcategory[]>({
    queryKey: ['/api/subcategories']
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['/api/services']
  });

  const createSubcategory = useMutation({
    mutationFn: async (data: { name: string; slug: string; categoryId: number }) => {
      return apiRequest('POST', '/api/subcategories', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory created successfully' });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const updateSubcategory = useMutation({
    mutationFn: async (data: { id: number; name: string; slug: string; categoryId: number }) => {
      return apiRequest('PUT', `/api/subcategories/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory updated successfully' });
      setEditingSubcategory(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const deleteSubcategory = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/subcategories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const getCategoryName = (categoryId: number) => {
    return categories?.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const getServiceCount = (subcategoryId: number) => {
    return services?.filter(s => s.subcategoryId === subcategoryId).length || 0;
  };

  const filteredSubcategories = subcategories?.filter(sub => {
    return filterCategory === 'all' || sub.categoryId === Number(filterCategory);
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Subcategories</h1>
          <p className="text-muted-foreground">Organize services within categories</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingSubcategory(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-subcategory">
              <Plus className="w-4 h-4 mr-2" />
              Add Subcategory
            </Button>
          </DialogTrigger>
          <DialogContent>
            <SubcategoryForm 
              subcategory={editingSubcategory}
              categories={categories || []}
              onSubmit={(data) => {
                if (editingSubcategory) {
                  updateSubcategory.mutate({ ...data, id: editingSubcategory.id });
                } else {
                  createSubcategory.mutate(data);
                }
              }}
              isLoading={createSubcategory.isPending || updateSubcategory.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-subcategory-category">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map(cat => (
              <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredSubcategories?.length === 0 ? (
        <div className="p-12 text-center bg-slate-100 dark:bg-slate-800 rounded-lg">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No subcategories yet</h3>
          <p className="text-muted-foreground mb-4">Create subcategories to organize your services</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredSubcategories?.map((subcategory) => (
            <div
              key={subcategory.id}
              className="flex items-center gap-4 p-4 rounded-lg bg-slate-100 dark:bg-slate-800 transition-all"
              data-testid={`subcategory-item-${subcategory.id}`}
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{subcategory.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="border-0 bg-slate-200 dark:bg-slate-700">
                    {getCategoryName(subcategory.categoryId)}
                  </Badge>
                  <Badge variant="outline" className="border-0 bg-slate-200 dark:bg-slate-700">
                    {getServiceCount(subcategory.id)} services
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setEditingSubcategory(subcategory); setIsDialogOpen(true); }}
                  data-testid={`button-edit-subcategory-${subcategory.id}`}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-delete-subcategory-${subcategory.id}`}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Subcategory?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {getServiceCount(subcategory.id) > 0 
                          ? `This subcategory has ${getServiceCount(subcategory.id)} services. You must delete or reassign them first.`
                          : 'This action cannot be undone.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => deleteSubcategory.mutate(subcategory.id)}
                        disabled={getServiceCount(subcategory.id) > 0}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubcategoryForm({ subcategory, categories, onSubmit, isLoading }: { 
  subcategory: Subcategory | null;
  categories: Category[];
  onSubmit: (data: { name: string; slug: string; categoryId: number }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(subcategory?.name || '');
  const [categoryId, setCategoryId] = useState(subcategory?.categoryId?.toString() || '');

  const generateSlug = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, slug: generateSlug(name), categoryId: Number(categoryId) });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{subcategory ? 'Edit Subcategory' : 'Add Subcategory'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="subcategory-name">Name</Label>
          <Input id="subcategory-name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-subcategory-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subcategory-category">Parent Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId} required>
            <SelectTrigger data-testid="select-subcategory-category">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading || !categoryId} data-testid="button-save-subcategory">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {subcategory ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ServicesSection() {
  const { toast } = useToast();
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderedServices, setOrderedServices] = useState<Service[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/categories']
  });

  const { data: subcategories } = useQuery<Subcategory[]>({
    queryKey: ['/api/subcategories']
  });

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: ['/api/services', { includeHidden: true }],
    queryFn: () => fetch('/api/services?includeHidden=true').then(r => r.json())
  });

  const { data: addonRelationships } = useQuery<{ id: number, serviceId: number, addonServiceId: number }[]>({
    queryKey: ['/api/service-addons'],
    queryFn: () => fetch('/api/service-addons').then(r => r.json())
  });

  const reorderSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const createService = useMutation({
    mutationFn: async (data: Omit<Service, 'id'> & { addonIds?: number[] }) => {
      const { addonIds, ...serviceData } = data;
      const response = await apiRequest('POST', '/api/services', serviceData);
      const newService = await response.json() as Service;
      if (addonIds && addonIds.length > 0 && newService?.id) {
        await apiRequest('PUT', `/api/services/${newService.id}/addons`, { addonIds });
      }
      return newService;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services', { includeHidden: true }] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-addons'] });
      toast({ title: 'Service created successfully' });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create service', description: error.message, variant: 'destructive' });
    }
  });

  const updateService = useMutation({
    mutationFn: async (data: Service & { addonIds?: number[] }) => {
      const { addonIds, ...serviceData } = data;
      await apiRequest('PUT', `/api/services/${data.id}`, serviceData);
      if (addonIds !== undefined) {
        await apiRequest('PUT', `/api/services/${data.id}/addons`, { addonIds });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services', { includeHidden: true }] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-addons'] });
      toast({ title: 'Service updated successfully' });
      setEditingService(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update service', description: error.message, variant: 'destructive' });
    }
  });

  const deleteService = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services', { includeHidden: true }] });
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-addons'] });
      toast({ title: 'Service deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete service', description: error.message, variant: 'destructive' });
    }
  });

  const reorderServices = useMutation<Service[], Error, { id: number; order: number }[]>({
    mutationFn: async (orderData: { id: number; order: number }[]) => {
      const res = await apiRequest('PUT', '/api/services/reorder', { order: orderData });
      return res.json();
    },
    onError: (error: Error) => {
      // Refetch to restore correct order on error
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      toast({ title: 'Failed to reorder services', description: error.message, variant: 'destructive' });
    },
    onSuccess: (data) => {
      const sorted = [...(data || [])].sort((a, b) => {
        const oa = a.order ?? 0;
        const ob = b.order ?? 0;
        return oa !== ob ? oa - ob : a.id - b.id;
      });
      // Update local state and cache directly without refetching
      setOrderedServices(sorted);
      queryClient.setQueryData(['/api/services', { includeHidden: true }], sorted);
      queryClient.setQueryData(['/api/services'], sorted.filter(s => !s.isHidden));
      toast({ title: 'Service order updated' });
    }
  });

  const filteredServices = useMemo(() => {
    const base = orderedServices.length > 0 ? orderedServices : services || [];
    const filtered = base.filter(service => {
      const matchesCategory = filterCategory === 'all' || service.categoryId === Number(filterCategory);
      const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
    return filtered.sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA === orderB) return a.id - b.id;
      return orderA - orderB;
    });
  }, [services, filterCategory, searchQuery, orderedServices]);

  const getCategoryName = (categoryId: number) => {
    return categories?.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const orderedServicesRef = useRef(orderedServices);
  orderedServicesRef.current = orderedServices;

  useEffect(() => {
    // Only sync from server on initial load or when services list changes (add/delete)
    // Skip during reorder operations to avoid flicker
    if (!services || reorderServices.isPending) return;

    const current = orderedServicesRef.current;

    // Check if this is just a reorder (same IDs, different order) - skip sync
    if (current.length > 0) {
      const currentIds = current.map(s => s.id);
      const newIds = new Set(services.map(s => s.id));
      const sameServices = currentIds.length === newIds.size &&
        currentIds.every(id => newIds.has(id));
      if (sameServices) return;
    }

    const sorted = [...services].sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA === orderB) return a.id - b.id;
      return orderA - orderB;
    });
    setOrderedServices(sorted);
  }, [services, reorderServices.isPending]);

  const handleServiceDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedServices.findIndex(item => item.id === Number(active.id));
    const newIndex = orderedServices.findIndex(item => item.id === Number(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(orderedServices, oldIndex, newIndex);
    const withOrder = reordered.map((svc, index) => ({ ...svc, order: index }));

    // Optimistically update local state for immediate visual feedback
    setOrderedServices(withOrder);

    // Send only the id and order to the server
    const orderData = withOrder.map(svc => ({ id: svc.id, order: svc.order as number }));
    reorderServices.mutate(orderData);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Services</h1>
        <p className="text-muted-foreground">Manage your cleaning services</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingService(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-service">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <ServiceForm
              service={editingService}
              categories={categories || []}
              subcategories={subcategories || []}
              allServices={services || []}
              addonRelationships={addonRelationships || []}
              onSubmit={(data) => {
                if (editingService) {
                  updateService.mutate({ ...data, id: editingService.id } as Service);
                } else {
                  createService.mutate(data as Omit<Service, 'id'>);
                }
              }}
              isLoading={createService.isPending || updateService.isPending}
            />
          </DialogContent>
        </Dialog>
        <div className="flex items-center gap-1.5">
          <Button
            variant={viewMode === 'grid' ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-4 h-4 mr-1.5" />
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4 mr-1.5" />
            List
          </Button>
        </div>
        <Input
          placeholder="Search services..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs h-9"
          data-testid="input-search-services"
        />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px] h-9" data-testid="select-filter-category">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map(cat => (
              <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredServices?.length === 0 ? (
        <Card className="p-12 text-center border-0 bg-slate-100 dark:bg-slate-800">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No services found</h3>
          <p className="text-muted-foreground mb-4">
            {services?.length === 0 ? 'Create your first service to get started' : 'Try adjusting your filters'}
          </p>
        </Card>
      ) : (
        <DndContext
          sensors={reorderSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleServiceDragEnd}
        >
          <SortableContext
            items={filteredServices.map(s => s.id)}
            strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
          >
            {viewMode === 'grid' ? (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {filteredServices?.map((service) => (
                  <ServiceGridItem
                    key={service.id}
                    service={service}
                    categoryName={getCategoryName(service.categoryId)}
                    onEdit={() => { setEditingService(service); setIsDialogOpen(true); }}
                    onDelete={() => deleteService.mutate(service.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredServices?.map((service, index) => (
                  <ServiceListRow
                    key={service.id}
                    service={service}
                    categoryName={getCategoryName(service.categoryId)}
                    onEdit={() => { setEditingService(service); setIsDialogOpen(true); }}
                    onDelete={() => deleteService.mutate(service.id)}
                    index={index}
                  />
                ))}
              </div>
            )}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SidebarSortableItem({
  item,
  isActive,
  onSelect,
}: {
  item: typeof menuItems[number];
  isActive: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group/menu-item relative transition-all",
        isDragging && "opacity-60 ring-2 ring-primary/30 rounded-md"
      )}
    >
      <SidebarMenuButton
        onClick={onSelect}
        isActive={isActive}
        data-testid={`nav-${item.id}`}
        className="group/btn"
      >
        <div className="flex items-center gap-2 flex-1">
          <span
            className="p-1 -ml-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover/btn:opacity-100 transition-opacity"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>
          <item.icon className="w-4 h-4" />
          <span>{item.title}</span>
        </div>
      </SidebarMenuButton>
    </li>
  );
}

function ServiceGridItem({
  service,
  categoryName,
  onEdit,
  onDelete,
}: {
  service: Service;
  categoryName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const durationLabel = `${Math.floor(service.durationMinutes / 60)}h ${service.durationMinutes % 60}m`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 transition-all",
        isDragging && "ring-2 ring-primary/40 shadow-lg bg-white dark:bg-slate-800/80"
      )}
    >
      <button
        className="absolute top-2 left-2 z-20 p-2 text-muted-foreground hover:text-foreground bg-white/80 dark:bg-slate-900/70 rounded-md shadow-sm cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      {service.imageUrl ? (
        <div className="w-full aspect-[4/3] overflow-hidden">
          <img
            src={service.imageUrl}
            alt={service.name}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        </div>
      ) : (
        <div className="w-full aspect-[4/3] bg-slate-200 flex items-center justify-center text-muted-foreground">
          <Package className="w-5 h-5" />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg leading-tight line-clamp-1 pr-6">{service.name}</h3>
          {service.isHidden && (
            <Badge variant="secondary" className="text-[11px] border-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
              Add-on Only
            </Badge>
          )}
        </div>
        <div className="text-2xl font-bold text-primary">${service.price}</div>
        <Badge variant="secondary" className="w-fit border-0 bg-slate-200 dark:bg-slate-700">
          {categoryName}
        </Badge>
        <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{durationLabel}</span>
        </div>
        <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="flex-1 bg-white dark:bg-slate-900 border-0"
            data-testid={`button-edit-service-${service.id}`}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="bg-white dark:bg-slate-900 border-0" data-testid={`button-delete-service-${service.id}`}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Service?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{service.name}". This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={onDelete}
                  className="bg-red-500 hover:bg-red-600 border-0"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function ServiceListRow({
  service,
  categoryName,
  onEdit,
  onDelete,
  index,
}: {
  service: Service;
  categoryName: string;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const durationLabel = `${Math.floor(service.durationMinutes / 60)}h ${service.durationMinutes % 60}m`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex flex-col sm:flex-row gap-3 p-3 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 shadow-sm",
        isDragging && "ring-2 ring-primary/40 shadow-md"
      )}
    >
      <div className="flex items-center gap-3">
        <button
          className="p-2 text-muted-foreground hover:text-foreground rounded-md cursor-grab active:cursor-grabbing self-center"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="w-28 sm:w-32 aspect-[4/3] rounded-md overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0">
          {service.imageUrl ? (
            <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Package className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-base leading-tight line-clamp-1">{service.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[11px] border-0 bg-slate-200 dark:bg-slate-700">#{index + 1}</Badge>
            {service.isHidden && (
              <Badge variant="secondary" className="text-[11px] border-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                Add-on Only
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-semibold text-primary">${service.price}</span>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{durationLabel}</span>
          </div>
          <Badge variant="secondary" className="w-fit border-0 bg-slate-200 dark:bg-slate-700">
            {categoryName}
          </Badge>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="bg-white dark:bg-slate-800 border-0"
            data-testid={`button-edit-service-${service.id}`}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="bg-white dark:bg-slate-800 border-0" data-testid={`button-delete-service-${service.id}`}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Service?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{service.name}". This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={onDelete}
                  className="bg-red-500 hover:bg-red-600 border-0"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function CategoryReorderRow({
  category,
  serviceCount,
  onEdit,
  onDelete,
  disableDelete,
  index,
  onManageSubcategories,
  subcategories,
}: {
  category: Category;
  serviceCount: number;
  onEdit: () => void;
  onDelete: () => void;
  disableDelete: boolean;
  index: number;
  onManageSubcategories: () => void;
  subcategories?: Subcategory[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex w-full min-w-0 flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-lg bg-slate-100 dark:bg-slate-800 border border-gray-200/70 dark:border-slate-700 cursor-grab active:cursor-grabbing transition-all shadow-sm",
        isDragging && "ring-2 ring-primary/40 shadow-md"
      )}
      data-testid={`category-item-${category.id}`}
    >
      <div className="flex min-w-0 items-center gap-3 sm:contents">
        <button
          className="text-muted-foreground cursor-grab p-2 -ml-2"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder category"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt={category.name}
            className="w-16 aspect-[4/3] sm:w-24 rounded-[2px] object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 aspect-[4/3] sm:w-24 rounded-[2px] bg-slate-200 flex items-center justify-center text-muted-foreground flex-shrink-0">
            <FolderOpen className="w-4 h-4" />
          </div>
        )}
        <div className="flex-1 min-w-0 sm:hidden">
          <h3 className="font-semibold truncate">{category.name}</h3>
          <Badge variant="secondary" className="mt-1">
            {serviceCount} services
          </Badge>
          <Badge variant="outline" className="mt-1 border-0 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100">
            {(subcategories?.filter(sub => sub.categoryId === category.id).length) ?? 0} subcategories
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={onManageSubcategories}
          >
            Manage subcategories
          </Button>
        </div>
        <div className="flex items-center gap-1 sm:hidden ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            data-testid={`button-edit-category-${category.id}-mobile`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-delete-category-${category.id}-mobile`}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                <AlertDialogDescription>
                  {disableDelete
                    ? `This category has ${serviceCount} services. You must delete or reassign them first.`
                    : 'This action cannot be undone.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  disabled={disableDelete}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="hidden sm:flex flex-1 min-w-0 items-center gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{category.name}</h3>
          <p className="text-sm text-muted-foreground truncate">{category.description}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary">
              {serviceCount} services
            </Badge>
            <Badge variant="outline" className="border-0 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100">
              {(subcategories?.filter(sub => sub.categoryId === category.id).length) ?? 0} subcategories
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={onManageSubcategories}
            >
              Manage subcategories
            </Button>
          </div>
        </div>
        <Badge variant="secondary" className="border-0 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100 shrink-0 self-center">
          #{index + 1}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2 break-words sm:hidden">{category.description}</p>
      <div className="hidden sm:flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          data-testid={`button-edit-category-${category.id}`}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-delete-category-${category.id}`}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Category?</AlertDialogTitle>
              <AlertDialogDescription>
                {disableDelete
                  ? `This category has ${serviceCount} services. You must delete or reassign them first.`
                  : 'This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                disabled={disableDelete}
                className="bg-red-500 hover:bg-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function ServiceForm({ service, categories, subcategories, allServices, addonRelationships, onSubmit, isLoading }: { 
  service: Service | null;
  categories: Category[];
  subcategories: Subcategory[];
  allServices: Service[];
  addonRelationships: { id: number, serviceId: number, addonServiceId: number }[];
  onSubmit: (data: Partial<Service> & { addonIds?: number[] }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(service?.name || '');
  const [description, setDescription] = useState(service?.description || '');
  const [price, setPrice] = useState(service?.price || '');
  const [durationHours, setDurationHours] = useState(service ? Math.floor(service.durationMinutes / 60) : 0);
  const [durationMinutes, setDurationMinutes] = useState(service ? service.durationMinutes % 60 : 0);
  const [categoryId, setCategoryId] = useState(service?.categoryId?.toString() || '');
  const [subcategoryId, setSubcategoryId] = useState(service?.subcategoryId?.toString() || '');
  const [imageUrl, setImageUrl] = useState(service?.imageUrl || '');
  const [isHidden, setIsHidden] = useState(service?.isHidden || false);
  const [addonSearch, setAddonSearch] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<number[]>(() => {
    if (!service) return [];
    return addonRelationships.filter(r => r.serviceId === service.id).map(r => r.addonServiceId);
  });

  const filteredSubcategories = subcategories.filter(sub => sub.categoryId === Number(categoryId));
  const availableAddons = allServices.filter(s => 
    s.id !== service?.id && 
    s.name.toLowerCase().includes(addonSearch.toLowerCase())
  );

  const handleAddonToggle = (addonId: number) => {
    setSelectedAddons(prev => 
      prev.includes(addonId) ? prev.filter(id => id !== addonId) : [...prev, addonId]
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await fetch('/api/upload', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to get upload URL');
      const { uploadURL, objectPath } = await res.json();

      const uploadRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });
      if (!uploadRes.ok) throw new Error('Upload to storage failed');

      setImageUrl(objectPath);
      // Use useToast via a locally accessible variable or props if needed
      // Since toast is from useToast() in the main component, ensuring it's available.
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<Service> & { addonIds?: number[] } = {
      name,
      description,
      price: String(price),
      durationMinutes: (durationHours * 60) + durationMinutes,
      categoryId: Number(categoryId),
      imageUrl,
      isHidden,
      addonIds: selectedAddons
    };
    if (subcategoryId) {
      data.subcategoryId = Number(subcategoryId);
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{service ? 'Edit Service' : 'Add Service'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="name">Service Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-service-name" />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={categoryId} onValueChange={(val) => { setCategoryId(val); setSubcategoryId(''); }} required>
            <SelectTrigger data-testid="select-service-category">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredSubcategories.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="subcategory">Subcategory (Optional)</Label>
            <Select value={subcategoryId || "none"} onValueChange={(val) => setSubcategoryId(val === "none" ? '' : val)}>
              <SelectTrigger data-testid="select-service-subcategory">
                <SelectValue placeholder="Select a subcategory" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {filteredSubcategories.map(sub => (
                  <SelectItem key={sub.id} value={String(sub.id)}>{sub.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-service-description" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Price (USD)</Label>
          <Input 
            id="price" 
            type="number" 
            step="0.01" 
            min="0"
            value={price} 
            onChange={(e) => setPrice(e.target.value)} 
            required 
            data-testid="input-service-price"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="durationHours">Duration (Hours)</Label>
            <Input 
              id="durationHours" 
              type="number" 
              min="0"
              value={durationHours} 
              onChange={(e) => setDurationHours(Number(e.target.value))} 
              data-testid="input-service-hours"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="durationMinutes">Duration (Minutes)</Label>
            <Input 
              id="durationMinutes" 
              type="number" 
              min="0"
              max="59"
              value={durationMinutes} 
              onChange={(e) => setDurationMinutes(Number(e.target.value))} 
              data-testid="input-service-minutes"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="imageUrl">Service Image</Label>
          <div className="flex flex-col gap-4">
            <Input 
              id="imageUpload" 
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload} 
              data-testid="input-service-image-upload" 
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Or URL:</span>
              <Input 
                id="imageUrl" 
                value={imageUrl} 
                onChange={(e) => setImageUrl(e.target.value)} 
                placeholder="https://..." 
                className="h-8 text-xs"
                data-testid="input-service-image-url" 
              />
            </div>
            {imageUrl && (
              <div className="relative w-full aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                <img 
                  src={imageUrl.startsWith('/objects/') ? imageUrl : imageUrl} 
                  alt="Preview" 
                  className="absolute inset-0 w-full h-full object-cover" 
                />
                <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                  4:3 Preview
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-2">
          <Checkbox 
            id="isHidden" 
            checked={isHidden} 
            onCheckedChange={(checked) => setIsHidden(!!checked)}
            data-testid="checkbox-service-hidden"
          />
          <Label htmlFor="isHidden" className="text-sm font-normal cursor-pointer">
            Hide from main services list (Service will only show as add-on)
          </Label>
        </div>

        {service && allServices.length > 1 && (
          <div className="space-y-2 pt-2">
            <Label>Suggested Add-ons</Label>
            <p className="text-xs text-muted-foreground">Choose which services to suggest when this is added</p>
            <div className="space-y-2 border rounded-md p-3 bg-slate-50 dark:bg-slate-800">
              <Input
                placeholder="Search services..."
                value={addonSearch}
                onChange={(e) => setAddonSearch(e.target.value)}
                className="h-8 text-sm mb-2"
              />
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {availableAddons.length > 0 ? (
                  availableAddons.map(addon => (
                    <div key={addon.id} className="flex items-center space-x-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded px-1 transition-colors">
                      <Checkbox 
                        id={`addon-${addon.id}`} 
                        checked={selectedAddons.includes(addon.id)} 
                        onCheckedChange={() => handleAddonToggle(addon.id)}
                        data-testid={`checkbox-addon-${addon.id}`}
                      />
                      <Label htmlFor={`addon-${addon.id}`} className="text-sm font-normal cursor-pointer flex-1 flex justify-between items-center">
                        <span className="truncate">{addon.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">${addon.price}</span>
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-center py-4 text-muted-foreground">No services found</p>
                )}
              </div>
              {selectedAddons.length > 0 && (
                <div className="pt-2 border-t mt-2 flex flex-wrap gap-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground w-full mb-1">Selected:</span>
                  {selectedAddons.map(id => {
                    const s = allServices.find(as => as.id === id);
                    if (!s) return null;
                    return (
                      <Badge key={id} variant="secondary" className="text-[10px] py-0 h-5 border-0 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        {s.name}
                        <button 
                          onClick={(e) => { e.preventDefault(); handleAddonToggle(id); }}
                          className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                        >
                          x
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading || !categoryId} data-testid="button-save-service">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {service ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface BookingItem {
  id: number;
  bookingId: number;
  serviceId: number;
  serviceName: string;
  price: string;
}

function getBookingStatusColor(status: string) {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'completed': return 'bg-green-100 text-green-800 border-green-200';
    case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function useBookingItems(bookingId: number, enabled: boolean = true) {
  return useQuery<BookingItem[]>({
    queryKey: ['/api/bookings', bookingId, 'items'],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}/items`);
      return res.json();
    },
    enabled
  });
}

function BookingRow({ booking, onUpdate, onDelete }: { 
  booking: Booking; 
  onUpdate: (id: number, updates: Partial<{ status: string; paymentStatus: string; totalPrice: string }>) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const { data: bookingItems } = useBookingItems(booking.id, expanded);

  const handleStatusChange = (status: string) => {
    onUpdate(booking.id, { status });
    toast({ title: `Status changed to ${status}` });
  };

  const handlePaymentToggle = () => {
    const newStatus = booking.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    onUpdate(booking.id, { paymentStatus: newStatus });
    toast({ title: newStatus === 'paid' ? 'Marked as paid' : 'Marked as unpaid' });
  };

  return (
    <>
      <tr className="hover:bg-slate-200/30 dark:hover:bg-slate-700/30 transition-colors">
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setExpanded(!expanded)}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              data-testid={`button-expand-booking-${booking.id}`}
            >
              <ChevronDown className={clsx("w-4 h-4 transition-transform", expanded && "rotate-180")} />
            </button>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{booking.customerName}</p>
              <p className="text-xs text-slate-500">{booking.customerEmail}</p>
              <p className="text-xs text-slate-400">{booking.customerPhone}</p>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {format(new Date(booking.bookingDate), "MMM dd, yyyy")}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {booking.startTime} - {booking.endTime}
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
            <span className="truncate max-w-[200px]" title={booking.customerAddress}>
              {booking.customerAddress}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 align-middle">
          <div className="flex items-center min-h-[56px]">
            <Select value={booking.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px] h-10 text-xs" data-testid={`select-status-${booking.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-200 border border-blue-300" />
                    Confirmed
                  </span>
                </SelectItem>
                <SelectItem value="completed">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-200 border border-green-300" />
                    Completed
                  </span>
                </SelectItem>
                <SelectItem value="cancelled">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-200 border border-red-300" />
                    Cancelled
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </td>
        <td className="px-6 py-4">
          <button
            onClick={handlePaymentToggle}
            className={clsx(
              "px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors",
              booking.paymentStatus === "paid" 
                ? "bg-green-100 text-green-700 hover:bg-green-200" 
                : "bg-orange-100 text-orange-700 hover:bg-orange-200"
            )}
            data-testid={`button-payment-${booking.id}`}
          >
            {booking.paymentStatus === "paid" ? "Paid" : "Unpaid"}
          </button>
        </td>
        <td className="px-6 py-4">
          <span
            className="font-bold text-slate-900 dark:text-slate-100"
            data-testid={`text-amount-${booking.id}`}
          >
            ${booking.totalPrice}
          </span>
        </td>
        <td className="px-6 py-4 text-right align-middle">
          <div className="flex items-center justify-end min-h-[56px]">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 items-center justify-center"
                  data-testid={`button-delete-booking-${booking.id}`}
                  aria-label="Delete booking"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Booking?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the booking for {booking.customerName}. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onDelete(booking.id)}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-100 dark:bg-slate-800/60">
          <td colSpan={7} className="px-6 py-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300">Booked Services</h4>
              {bookingItems && bookingItems.length > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-slate-700">
                  {bookingItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{item.serviceName}</span>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">${item.price}</span>
                    </div>
                  ))}
                  <div className="h-px bg-gray-200 dark:bg-slate-700" />
                </div>
              ) : (
                <p className="text-sm text-slate-500">Loading services...</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}


function BookingMobileCard({ 
  booking, 
  onUpdate, 
  onDelete 
}: { 
  booking: Booking; 
  onUpdate: (id: number, data: any) => void;
  onDelete: (id: number) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  const { data: items, isLoading: itemsLoading } = useBookingItems(booking.id, isExpanded);
  const isItemsLoading = isExpanded && itemsLoading;

  const handleStatusChange = (status: string) => {
    onUpdate(booking.id, { status });
    toast({ title: `Status changed to ${status}` });
  };

  const handlePaymentStatusChange = (paymentStatus: string) => {
    onUpdate(booking.id, { paymentStatus });
    toast({ title: `Payment status changed to ${paymentStatus}` });
  };

  return (
    <Card className="mb-4 overflow-hidden border-slate-200">
      <CardHeader className="p-4 pb-2 space-y-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-bold text-lg">#{booking.id}</span>
            <span className="text-sm text-muted-foreground">{format(new Date(booking.bookingDate), 'MMM dd, yyyy')}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={getBookingStatusColor(booking.status)}>
              {booking.status}
            </Badge>
            <Badge variant="outline" className={booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}>
              {booking.paymentStatus}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="w-4 h-4" />
            <span className="truncate">{booking.customerName}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground justify-end">
            <Clock className="w-4 h-4" />
            <span>{booking.startTime} - {booking.endTime}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="truncate">{booking.customerAddress}</span>
          </div>
          <div className="flex items-center gap-2 font-bold justify-end text-primary">
            <DollarSign className="w-4 h-4" />
            <span>${booking.totalPrice}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Select onValueChange={handleStatusChange} defaultValue={booking.status}>
            <SelectTrigger className="h-8 text-xs w-[110px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select onValueChange={handlePaymentStatusChange} defaultValue={booking.paymentStatus}>
            <SelectTrigger className="h-8 text-xs w-[110px]">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive ml-auto">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Booking?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(booking.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-2 h-8"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Hide Details' : 'Show Services'}
            <ChevronDown className={clsx("w-4 h-4 ml-2 transition-transform", isExpanded && "rotate-180")} />
          </Button>
        </div>

        {isExpanded && (
          <div className="mt-4 p-3 bg-slate-50 rounded-md border border-slate-100 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Services</h4>
            {isItemsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : items && items.length > 0 ? (
              <ul className="space-y-1">
                {items.map((item: any) => (
                  <li key={item.id} className="text-sm flex justify-between items-center">
                    <span>{item.serviceName}</span>
                    <span className="font-medium">${item.price}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">No services listed</p>
            )}
            <div className="pt-2 border-t border-slate-200 text-xs text-muted-foreground">
              <p>Email: {booking.customerEmail}</p>
              <p>Phone: {booking.customerPhone}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BookingsSection() {
  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ['/api/bookings']
  });
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<{ status: string; paymentStatus: string; totalPrice: string }> }) => {
      const res = await apiRequest('PATCH', `/api/bookings/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/bookings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      toast({ title: 'Booking deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleUpdate = (id: number, updates: Partial<{ status: string; paymentStatus: string; totalPrice: string }>) => {
    updateMutation.mutate({ id, updates });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">Manage all customer bookings</p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2 border-0 bg-slate-100 dark:bg-slate-800">
          {bookings?.length || 0} Total
        </Badge>
      </div>

      {bookings?.length === 0 ? (
        <div className="p-12 text-center rounded-lg bg-slate-100 dark:bg-slate-800">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No bookings yet</h3>
          <p className="text-muted-foreground">Bookings will appear here when customers make them</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="hidden md:block bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden transition-all">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-4 text-left">Customer</th>
                    <th className="px-6 py-4 text-left">Schedule</th>
                    <th className="px-6 py-4 text-left">Address</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-left">Payment</th>
                    <th className="px-6 py-4 text-left">Amount</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {bookings?.map((booking) => (
                    <BookingRow 
                      key={booking.id} 
                      booking={booking} 
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="md:hidden space-y-4">
            {bookings?.map((booking) => (
              <BookingMobileCard
                key={booking.id}
                booking={booking}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SortableFaqItem({ faq, onEdit, onDelete }: { faq: Faq; onEdit: (faq: Faq) => void; onDelete: (id: number) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: faq.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 transition-all border group relative"
      data-testid={`faq-item-${faq.id}`}
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground p-1"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm line-clamp-1">{faq.question}</h3>
          </div>
          <p className="text-muted-foreground text-xs line-clamp-2">{faq.answer}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(faq)}
            data-testid={`button-edit-faq-${faq.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-delete-faq-${faq.id}`}>
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDelete(faq.id)}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function FaqsSection() {
  const { toast } = useToast();
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: faqs, isLoading } = useQuery<Faq[]>({
    queryKey: ['/api/faqs']
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const createFaq = useMutation({
    mutationFn: async (data: { question: string; answer: string; order: number }) => {
      return apiRequest('POST', '/api/faqs', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faqs'] });
      toast({ title: 'FAQ created successfully' });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create FAQ', description: error.message, variant: 'destructive' });
    }
  });

  const updateFaq = useMutation({
    mutationFn: async (data: { id: number; question: string; answer: string; order: number }) => {
      return apiRequest('PUT', `/api/faqs/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faqs'] });
      toast({ title: 'FAQ updated successfully' });
      setEditingFaq(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update FAQ', description: error.message, variant: 'destructive' });
    }
  });

  const deleteFaq = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/faqs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faqs'] });
      toast({ title: 'FAQ deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete FAQ', description: error.message, variant: 'destructive' });
    }
  });

  const reorderFaqs = useMutation({
    mutationFn: async (newOrder: { id: number; order: number }[]) => {
      return Promise.all(
        newOrder.map(item => apiRequest('PUT', `/api/faqs/${item.id}`, { order: item.order }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faqs'] });
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && faqs) {
      const oldIndex = faqs.findIndex((f) => f.id === active.id);
      const newIndex = faqs.findIndex((f) => f.id === over.id);

      const newFaqs = arrayMove(faqs, oldIndex, newIndex);
      const updates = newFaqs.map((faq, index) => ({
        id: faq.id,
        order: index
      }));

      reorderFaqs.mutate(updates);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">FAQs</h1>
          <p className="text-muted-foreground">Manage frequently asked questions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingFaq(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-faq">
              <Plus className="w-4 h-4 mr-2" />
              Add FAQ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <FaqForm 
              faq={editingFaq}
              onSubmit={(data) => {
                if (editingFaq) {
                  updateFaq.mutate({ ...data, id: editingFaq.id });
                } else {
                  createFaq.mutate(data);
                }
              }}
              isLoading={createFaq.isPending || updateFaq.isPending}
              nextOrder={faqs?.length || 0}
            />
          </DialogContent>
        </Dialog>
      </div>

      {faqs?.length === 0 ? (
        <div className="p-12 text-center bg-slate-100 dark:bg-slate-800 rounded-lg">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No FAQs yet</h3>
          <p className="text-muted-foreground mb-4">Create FAQs to help your customers find answers quickly</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={faqs?.map(f => f.id) || []}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-2">
              {faqs?.map((faq) => (
                <SortableFaqItem
                  key={faq.id}
                  faq={faq}
                  onEdit={(f) => { setEditingFaq(f); setIsDialogOpen(true); }}
                  onDelete={(id) => deleteFaq.mutate(id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function FaqForm({ faq, onSubmit, isLoading, nextOrder }: { 
  faq: Faq | null; 
  onSubmit: (data: { question: string; answer: string; order: number }) => void;
  isLoading: boolean;
  nextOrder: number;
}) {
  const [question, setQuestion] = useState(faq?.question || '');
  const [answer, setAnswer] = useState(faq?.answer || '');
  const [order, setOrder] = useState(faq?.order ?? nextOrder);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ question, answer, order });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{faq ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="faq-question">Question</Label>
          <Input 
            id="faq-question" 
            value={question} 
            onChange={(e) => setQuestion(e.target.value)} 
            required 
            placeholder="e.g., How do I book a service?"
            data-testid="input-faq-question" 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="faq-answer">Answer</Label>
          <Textarea 
            id="faq-answer" 
            value={answer} 
            onChange={(e) => setAnswer(e.target.value)} 
            required
            placeholder="Provide a helpful answer..."
            rows={4}
            data-testid="input-faq-answer" 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="faq-order">Display Order</Label>
          <Input 
            id="faq-order" 
            type="number"
            value={order} 
            onChange={(e) => setOrder(Number(e.target.value))} 
            min={0}
            data-testid="input-faq-order" 
          />
          <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading} data-testid="button-save-faq">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {faq ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}

type UrlRule = {
  pattern: string;
  match: 'contains' | 'starts_with' | 'equals';
};

type IntakeObjective = {
  id: 'zipcode' | 'name' | 'phone' | 'serviceType' | 'serviceDetails' | 'date' | 'address';
  label: string;
  description: string;
  enabled: boolean;
};

interface ChatSettingsData {
  enabled: boolean;
  agentName: string;
  agentAvatarUrl?: string;
  systemPrompt?: string;
  welcomeMessage: string;
  intakeObjectives?: IntakeObjective[];
  excludedUrlRules: UrlRule[];
}

interface ConversationSummary {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  firstPageUrl?: string | null;
  visitorName?: string | null;
  visitorEmail?: string | null;
  visitorPhone?: string | null;
  lastMessage?: string;
  lastMessageRole?: string | null;
  messageCount?: number;
}

interface ConversationMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
  metadata?: Record<string, any> | null;
}

function ChatSection() {
  const { toast } = useToast();
  const [settingsDraft, setSettingsDraft] = useState<ChatSettingsData>({
    enabled: false,
    agentName: 'Skleanings Assistant',
    agentAvatarUrl: '',
    systemPrompt: '',
    welcomeMessage: 'Hi! How can I help you today?',
    intakeObjectives: [],
    excludedUrlRules: [],
  });
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const objectivesSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'all'>('open');

  const { data: settings, isLoading: loadingSettings } = useQuery<ChatSettingsData>({
    queryKey: ['/api/chat/settings'],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: companySettings } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings'],
  });

  const defaultSystemPrompt = useMemo(() => {
    const companyName = companySettings?.companyName || 'Skleanings';
    return `You are a friendly, efficient cleaning service assistant for ${companyName}. Balance being consultative with being efficient - don't over-ask.

SMART QUALIFICATION:
1. When a customer mentions a need, assess if you have ENOUGH info to recommend:
   - "clean my 3-seater sofa" → SUFFICIENT, search services immediately
   - "clean my sofa" → Ask: "How many seats?" then proceed
   - "carpet cleaning" → Ask: "Which room?" then proceed

2. Only ask 1-2 critical questions if info is missing. Don't interrogate:
   ❌ DON'T: Ask about material, stains, age, usage, etc. unless customer mentions issues
   ✅ DO: Ask only what's needed to identify the right service (size/type)

3. SMART CONFIRMATION - only if unclear:
   - If customer said "3-seater sofa" → Search immediately, no confirmation needed
   - If customer said "big sofa" → Confirm: "By big, do you mean 3-seater or larger?"

4. After suggesting service, ask if they want to book - don't ask more questions

NATURAL INFO COLLECTION:
- After they agree to book, collect info smoothly:
  "Great! What's your name?" → "Email?" → "Phone?" → "Full address?"
- Use update_contact immediately when you get name/email/phone
- Keep it fast - one question per message

BOOKING FLOW:
- Confirm timezone (America/New_York)
- Use get_availability with service_id
- Show 3-5 slots within 14 days
- After they pick a time and provide address, create booking immediately
- Don't ask "are you sure?" - just confirm after booking is done

TOOLS:
- list_services: As soon as you know what they need
- get_service_details: If they ask about a specific service
- get_availability: With service_id after they agree to book
- update_contact: When you get name/email/phone
- create_booking: After slot selection and all required info collected
- get_business_policies: Check minimums only if needed

RULES:
- Never guess prices/availability
- Never invent slots
- Keep responses 2-3 sentences max
- Use markdown for emphasis: **bold** for prices and service names
- Complete bookings in chat

EFFICIENT EXAMPLES:

Example 1 (Sufficient info):
Customer: "I need my 3-seater sofa cleaned"
You: "Perfect! Let me find our sofa cleaning options for you..."
[Use list_services]
You: "I recommend **3-Seat Sofa Deep Cleaning** - $120, 2 hours. Want to book it?"

Example 2 (Missing size):
Customer: "I need my sofa cleaned"
You: "Great! How many seats is your sofa?"
Customer: "3 seats"
You: "Perfect! Let me find the right service..."
[Use list_services]
You: "I recommend **3-Seat Sofa Deep Cleaning** - $120, 2 hours. Want to book it?"

Example 3 (Ready to book):
Customer: "Yes, book it"
You: "Awesome! What's your name?"
Customer: "John Smith"
You: "Thanks John! What's your email?"
[Continue collecting info smoothly, no extra questions]`;
  }, [companySettings?.companyName]);

  const { data: conversations, isLoading: loadingConversations, refetch: refetchConversations } = useQuery<ConversationSummary[]>({
    queryKey: ['/api/chat/conversations'],
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  const { data: openaiSettings } = useQuery<{ enabled: boolean; hasKey: boolean }>({
    queryKey: ['/api/integrations/openai'],
  });

  useEffect(() => {
    if (!settings && !companySettings) return;

    const defaultName = companySettings?.companyName || 'Skleanings Assistant';
    const defaultAvatar = companySettings?.logoIcon || '/favicon.ico';

    if (settings) {
      const hasCustomName = settings.agentName && settings.agentName !== 'Skleanings Assistant';
      setSettingsDraft({
        enabled: settings.enabled,
        agentName: hasCustomName ? settings.agentName : defaultName,
        agentAvatarUrl: settings.agentAvatarUrl || defaultAvatar,
        systemPrompt: settings.systemPrompt || defaultSystemPrompt,
        welcomeMessage: settings.welcomeMessage || 'Hi! How can I help you today?',
        intakeObjectives: settings.intakeObjectives && settings.intakeObjectives.length > 0
          ? settings.intakeObjectives
          : DEFAULT_CHAT_OBJECTIVES,
        excludedUrlRules: settings.excludedUrlRules || [],
      });
      return;
    }

    setSettingsDraft((prev) => ({
      ...prev,
      agentName: prev.agentName || defaultName,
      agentAvatarUrl: prev.agentAvatarUrl || defaultAvatar,
      systemPrompt: prev.systemPrompt || defaultSystemPrompt,
      intakeObjectives: prev.intakeObjectives && prev.intakeObjectives.length > 0
        ? prev.intakeObjectives
        : DEFAULT_CHAT_OBJECTIVES,
    }));
  }, [settings, companySettings, defaultSystemPrompt]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const saveSettings = useCallback(async (dataToSave: Partial<ChatSettingsData>) => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/chat/settings', dataToSave);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/settings'] });
      setLastSaved(new Date());
    } catch (error: any) {
      toast({ title: 'Failed to save settings', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  const updateField = useCallback(<K extends keyof ChatSettingsData>(field: K, value: ChatSettingsData[K]) => {
    setSettingsDraft(prev => ({ ...prev, [field]: value }));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSettings({ [field]: value });
    }, 800);
  }, [saveSettings]);

  const handleToggleChat = async (checked: boolean) => {
    const previousValue = settingsDraft.enabled;
    setSettingsDraft(prev => ({ ...prev, enabled: checked }));
    try {
      await saveSettings({ enabled: checked });
      await queryClient.refetchQueries({ queryKey: ['/api/chat/settings'] });
    } catch (error) {
      // Reverter em caso de erro
      setSettingsDraft(prev => ({ ...prev, enabled: previousValue }));
    }
  };

  const addRule = () => {
    const newRules = [...(settingsDraft.excludedUrlRules || []), { pattern: '/admin', match: 'starts_with' as const }];
    setSettingsDraft(prev => ({ ...prev, excludedUrlRules: newRules }));
    saveSettings({ excludedUrlRules: newRules });
  };

  const updateRule = (index: number, field: keyof UrlRule, value: string) => {
    const rules = [...(settingsDraft.excludedUrlRules || [])];
    rules[index] = { ...rules[index], [field]: value } as UrlRule;
    setSettingsDraft(prev => ({ ...prev, excludedUrlRules: rules }));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSettings({ excludedUrlRules: rules });
    }, 800);
  };

  const removeRule = (index: number) => {
    const newRules = settingsDraft.excludedUrlRules.filter((_, i) => i !== index);
    setSettingsDraft(prev => ({ ...prev, excludedUrlRules: newRules }));
    saveSettings({ excludedUrlRules: newRules });
  };

  const handleObjectivesDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    setSettingsDraft((prev) => ({ ...prev, intakeObjectives: reordered }));
    saveSettings({ intakeObjectives: reordered });
  };

  const toggleObjective = (id: IntakeObjective['id'], enabled: boolean) => {
    const items = settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES;
    const updated = items.map((item) => item.id === id ? { ...item, enabled } : item);
    setSettingsDraft((prev) => ({ ...prev, intakeObjectives: updated }));
    saveSettings({ intakeObjectives: updated });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const uploadRes = await apiRequest('POST', '/api/upload');
      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      setSettingsDraft(prev => ({ ...prev, agentAvatarUrl: objectPath }));
      await saveSettings({ agentAvatarUrl: objectPath });
      toast({ title: 'Avatar uploaded', description: 'Chat assistant avatar updated.' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploadingAvatar(false);
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = '';
      }
    }
  };

  const openConversation = async (conv: ConversationSummary) => {
    setSelectedConversation(conv);
    setIsMessagesLoading(true);
    try {
      const res = await apiRequest('GET', `/api/chat/conversations/${conv.id}`);
      const data = await res.json();
      setSelectedConversation(data.conversation);
      setMessages(data.messages || []);
    } catch (error: any) {
      toast({ title: 'Failed to load conversation', description: error.message, variant: 'destructive' });
      setSelectedConversation(null);
    } finally {
      setIsMessagesLoading(false);
    }
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'open' | 'closed' }) => {
      const res = await apiRequest('POST', `/api/chat/conversations/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      if (selectedConversation) {
        setSelectedConversation({ ...selectedConversation, status: selectedConversation.status === 'open' ? 'closed' : 'open' });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/chat/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      setSelectedConversation(null);
      setMessages([]);
      toast({ title: 'Conversation deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete conversation', description: error.message, variant: 'destructive' });
    },
  });

  const statusBadge = (status: string) => {
    const variant = status === 'closed' ? 'secondary' : 'default';
    const label = status === 'closed' ? 'Archived' : status === 'open' ? 'Open' : status;
    return <Badge variant={variant}>{label}</Badge>;
  };

  const assistantName = settingsDraft.agentName || companySettings?.companyName || 'Assistant';
  const assistantAvatar = settingsDraft.agentAvatarUrl || companySettings?.logoIcon || '/favicon.ico';
  const visitorName = selectedConversation?.visitorName || 'Guest';
  const conversationLastUpdated =
    selectedConversation?.lastMessageAt || selectedConversation?.updatedAt || selectedConversation?.createdAt;
  const openConversations = conversations?.filter((conv) => conv.status === 'open').length || 0;
  const closedConversations = conversations?.filter((conv) => conv.status === 'closed').length || 0;
  const visibleConversations = useMemo(() => {
    if (!conversations) return [];
    if (statusFilter === 'all') return conversations;
    return conversations.filter((conv) => conv.status === statusFilter);
  }, [conversations, statusFilter]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Chat</h1>
        <p className="text-muted-foreground">Prioritize conversations, then open the settings drawer when needed.</p>
      </div>

      <Card className="bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-white/20 border border-white/30 overflow-hidden flex items-center justify-center">
                {assistantAvatar ? (
                  <img src={assistantAvatar} alt={assistantName} className="h-full w-full object-cover" />
                ) : (
                  <MessageSquare className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-sm text-white/80">Assistant</p>
                <p className="text-xl font-semibold leading-tight">{assistantName}</p>
                <p className="text-xs text-white/80">
                  Defaults to your company name and favicon. Customize in the settings submenu.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
              <div className="rounded-lg bg-white/10 px-4 py-3">
                <p className="text-xs text-white/80">Open</p>
                <p className="text-2xl font-semibold">{openConversations}</p>
              </div>
              <div className="rounded-lg bg-white/10 px-4 py-3">
                <p className="text-xs text-white/80">Archived</p>
                <p className="text-2xl font-semibold">{closedConversations}</p>
              </div>
              <div className="rounded-lg bg-white/10 px-4 py-3">
                <p className="text-xs text-white/80">Total</p>
                <p className="text-2xl font-semibold">{conversations?.length || 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border border-slate-200/70">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Conversations</CardTitle>
            <p className="text-sm text-muted-foreground">Review and respond first, then open the settings submenu if needed.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val as 'open' | 'closed' | 'all')}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Archived</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchConversations()}
              disabled={loadingConversations}
            >
              {loadingConversations ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
            </Button>
            <Badge variant="secondary">{visibleConversations.length} shown</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loadingConversations ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : conversations && conversations.length > 0 ? (
            <div className="overflow-auto border rounded-lg bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Visitor</th>
                    <th className="px-4 py-3 text-left">Source</th>
                    <th className="px-4 py-3 text-left">Last Message</th>
                    <th className="px-4 py-3 text-left">Updated</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleConversations.map((conv) => (
                    <tr key={conv.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="font-medium">{conv.visitorName || 'Guest'}</div>
                        <div className="text-xs text-muted-foreground">
                          {conv.visitorEmail || conv.visitorPhone || 'Unknown contact'}
                        </div>
                        <div className="text-[11px] text-muted-foreground/80">ID: {conv.id}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{conv.firstPageUrl || 'n/a'}</td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <p className="line-clamp-2 text-sm">{conv.lastMessage || 'No messages yet'}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), 'PP p') : format(new Date(conv.createdAt), 'PP p')}
                      </td>
                      <td className="px-4 py-3">{statusBadge(conv.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => openConversation(conv)}>
                            View
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-500"
                            onClick={() => deleteMutation.mutate(conv.id)}
                            data-testid={`button-delete-conversation-${conv.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-lg border">
              <p className="text-muted-foreground">
                {conversations && conversations.length > 0
                  ? 'No conversations match this filter.'
                  : 'No conversations yet.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen} className="border border-slate-200 rounded-xl bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="font-semibold text-sm">Widget & assistant settings</p>
            <p className="text-xs text-muted-foreground">Open only when you need to tweak the assistant.</p>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              {settingsOpen ? 'Hide' : 'Show'} settings
              <ChevronDown className={clsx('w-4 h-4 transition-transform', settingsOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="p-4 border-t space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CardTitle>General Settings</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : lastSaved ? (
                        <>
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Auto-saved</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">
                      {settingsDraft.enabled ? 'Enabled' : 'Disabled'}
                    </Label>
                    <Switch
                      checked={settingsDraft.enabled}
                      onCheckedChange={handleToggleChat}
                      disabled={loadingSettings || isSaving}
                      data-testid="switch-chat-enabled"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Control availability, branding, and welcome message</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 border rounded-md">
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-white flex items-center justify-center border">
                    {assistantAvatar ? (
                      <img src={assistantAvatar} alt={assistantName} className="h-full w-full object-cover" />
                    ) : (
                      <MessageSquare className="w-4 h-4" />
                    )}
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold">{assistantName}</p>
                    <p className="text-xs text-muted-foreground">Defaults to company name and favicon.</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="agent-name">Agent name</Label>
                    <Input
                      id="agent-name"
                      value={settingsDraft.agentName}
                      onChange={(e) => updateField('agentName', e.target.value)}
                      placeholder={companySettings?.companyName || 'Assistant'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent-avatar">Avatar (URL)</Label>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          id="agent-avatar"
                          value={settingsDraft.agentAvatarUrl || ''}
                          onChange={(e) => updateField('agentAvatarUrl', e.target.value)}
                          placeholder={companySettings?.logoIcon || '/favicon.ico'}
                        />
                        <input
                          ref={avatarFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarUpload}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => avatarFileInputRef.current?.click()}
                          disabled={isUploadingAvatar || isSaving}
                        >
                          {isUploadingAvatar ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Uploading...
                            </>
                          ) : (
                            'Upload'
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        If empty, the admin favicon/logo is used. You can upload a custom image.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="welcome-message">Welcome message</Label>
                  <Textarea
                    id="welcome-message"
                    value={settingsDraft.welcomeMessage}
                    onChange={(e) => updateField('welcomeMessage', e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="system-prompt">System prompt</Label>
                  <Textarea
                    id="system-prompt"
                    value={settingsDraft.systemPrompt || ''}
                    onChange={(e) => updateField('systemPrompt', e.target.value)}
                    rows={20}
                    placeholder={defaultSystemPrompt}
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls assistant behavior sent to the AI. Leave blank to use the default prompt.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>URL Exclusions</Label>
                      <p className="text-xs text-muted-foreground">Hide the widget on specific paths</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={addRule} data-testid="button-add-url-rule">
                      <Plus className="w-4 h-4 mr-1" /> Add Rule
                    </Button>
                  </div>
                  {settingsDraft.excludedUrlRules?.length === 0 && (
                    <div className="text-sm text-muted-foreground bg-slate-50 dark:bg-slate-800 border rounded-md p-3">
                      No rules yet. Add paths like <code>/admin</code>, <code>/checkout</code>, or <code>/privacy</code>.
                    </div>
                  )}
                  <div className="space-y-3">
                    {settingsDraft.excludedUrlRules?.map((rule, idx) => (
                      <div key={`${rule.pattern}-${idx}`} className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto] items-center">
                        <Input
                          placeholder="/admin"
                          value={rule.pattern}
                          onChange={(e) => updateRule(idx, 'pattern', e.target.value)}
                        />
                        <Select
                          value={rule.match}
                          onValueChange={(val) => updateRule(idx, 'match', val as UrlRule['match'])}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="starts_with">Starts with</SelectItem>
                            <SelectItem value="equals">Equals</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-red-500"
                          onClick={() => removeRule(idx)}
                          data-testid={`button-remove-rule-${idx}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

        <div className="space-y-4">
          {(!openaiSettings?.enabled || !openaiSettings?.hasKey) && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">OpenAI not configured</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          {!openaiSettings?.hasKey
                            ? 'Add your OpenAI API key in Integrations → OpenAI to enable chat responses.'
                            : 'Enable the OpenAI integration in Integrations → OpenAI to activate chat responses.'}
                        </p>
                      </div>
                    </div>
              </CardContent>
            </Card>
          )}

          {settingsDraft.enabled && openaiSettings?.enabled && openaiSettings?.hasKey && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Check className="w-4 h-4" />
                  <span className="font-medium text-sm">Chat is active</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                  Visitors can now chat with your AI assistant
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="border border-slate-200">
            <CardHeader>
              <CardTitle>Intake flow</CardTitle>
              <p className="text-sm text-muted-foreground">Enable, disable, or reorder the data the bot collects before booking.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <DndContext sensors={objectivesSensors} collisionDetection={closestCenter} onDragEnd={handleObjectivesDragEnd}>
                <SortableContext
                  items={(settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES).map((o) => o.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {(settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES).map((objective) => (
                      <ObjectiveRow
                        key={objective.id}
                        objective={objective}
                        onToggle={toggleObjective}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <p className="text-[11px] text-muted-foreground">
                The assistant will follow this order when gathering details.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/60 bg-slate-50/60 dark:bg-slate-900/10">
            <CardHeader>
              <CardTitle>Widget Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <ul className="list-disc pl-4 space-y-1">
                <li>Exclude payment or admin pages to avoid distractions.</li>
                <li>Use the welcome message to set expectations (hours, response time).</li>
                <li>Conversation status can be closed and reopened from the dashboard.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={!!selectedConversation} onOpenChange={(open) => !open && setSelectedConversation(null)}>
        <DialogContent className="w-[95vw] max-w-[600px] p-0">
          <DialogHeader className="border-b bg-white px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full border bg-slate-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Conversation</DialogTitle>
                  {selectedConversation && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{visitorName}</span>
                      {statusBadge(selectedConversation.status)}
                      {selectedConversation.firstPageUrl && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                          {selectedConversation.firstPageUrl}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {selectedConversation && conversationLastUpdated && (
                <div className="text-xs text-muted-foreground">
                  Updated {format(new Date(conversationLastUpdated), 'PP p')}
                </div>
              )}
            </div>
          </DialogHeader>

          {isMessagesLoading ? (
            <div className="flex justify-center py-12 bg-slate-50/70">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="max-h-[340px] overflow-auto bg-slate-50/70 px-6 py-6 space-y-6">
              {messages.map((msg) => {
                const isAssistant = msg.role === 'assistant';
                const nameLabel = isAssistant ? assistantName : visitorName;
                return (
                  <div
                    key={msg.id}
                    className={clsx('flex items-end gap-3', isAssistant ? 'justify-start' : 'justify-end')}
                  >
                    {isAssistant && (
                      <div className="h-9 w-9 rounded-full border bg-white overflow-hidden flex items-center justify-center">
                        {assistantAvatar ? (
                          <img src={assistantAvatar} alt={assistantName} className="h-full w-full object-cover" />
                        ) : (
                          <MessageSquare className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                    )}
                    <div className="max-w-[78%]">
                      <div
                        className={clsx(
                          'rounded-2xl px-4 py-3 text-sm shadow-sm',
                          isAssistant ? 'bg-white border text-slate-900' : 'bg-primary text-white'
                        )}
                      >
                        <div className="whitespace-pre-wrap leading-relaxed">{renderMarkdown(msg.content)}</div>
                      </div>
                      <div className={clsx('mt-1 flex items-center gap-2 text-[11px] text-muted-foreground', !isAssistant && 'justify-end')}>
                        <span className="font-medium">{nameLabel}</span>
                        <span>•</span>
                        <span>{format(new Date(msg.createdAt), 'PP p')}</span>
                      </div>
                      {msg.metadata?.pageUrl && (
                        <div className={clsx('mt-1 text-[11px] text-muted-foreground', !isAssistant && 'text-right')}>
                          Page: {msg.metadata.pageUrl}
                        </div>
                      )}
                    </div>
                    {!isAssistant && (
                      <div className="h-9 w-9 rounded-full border bg-primary text-white flex items-center justify-center">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}
              {messages.length === 0 && <p className="text-sm text-muted-foreground text-center">No messages yet.</p>}
            </div>
          )}

          {selectedConversation && (
            <div className="border-t bg-white px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 rounded-full border bg-slate-50 px-4 py-2 text-xs text-muted-foreground">
                  <MessageSquare className="w-4 h-4" />
                  <span>Read-only transcript in admin.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      statusMutation.mutate({
                        id: selectedConversation.id,
                        status: selectedConversation.status === 'open' ? 'closed' : 'open',
                      })
                    }
                  >
                    {selectedConversation.status === 'open' ? 'Archive' : 'Reopen'}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" className="text-red-500">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                        <AlertDialogDescription>This will remove all messages for this conversation.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => selectedConversation && deleteMutation.mutate(selectedConversation.id)}
                          className="bg-destructive text-destructive-foreground"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ObjectiveRow({ objective, onToggle }: { objective: IntakeObjective; onToggle: (id: IntakeObjective['id'], enabled: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: objective.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <button
        type="button"
        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1">
        <p className="text-sm font-medium">{objective.label}</p>
        <p className="text-xs text-muted-foreground">{objective.description}</p>
      </div>
      <Switch checked={objective.enabled} onCheckedChange={(checked) => onToggle(objective.id, checked)} />
    </div>
  );
}

interface GHLSettings {
  provider: string;
  apiKey: string;
  locationId: string;
  calendarId: string;
  isEnabled: boolean;
}

interface OpenAISettings {
  provider: string;
  enabled: boolean;
  model: string;
  hasKey: boolean;
}

function AvailabilitySection() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ['/api/company-settings']
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      return apiRequest('PUT', '/api/company-settings', newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update settings', description: error.message, variant: 'destructive' });
    }
  });

  const updateField = (field: string, value: any) => {
    if (!settings) return;
    updateSettingsMutation.mutate({ ...settings, [field]: value });
  };

  if (isLoading || !settings) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const DEFAULT_BUSINESS_HOURS = {
    monday: { isOpen: true, start: '08:00', end: '18:00' },
    tuesday: { isOpen: true, start: '08:00', end: '18:00' },
    wednesday: { isOpen: true, start: '08:00', end: '18:00' },
    thursday: { isOpen: true, start: '08:00', end: '18:00' },
    friday: { isOpen: true, start: '08:00', end: '18:00' },
    saturday: { isOpen: false, start: '08:00', end: '18:00' },
    sunday: { isOpen: false, start: '08:00', end: '18:00' }
  };

  const formatTimeDisplay = (time24: string) => {
    const timeFormat = settings.timeFormat || '12h';
    if (timeFormat === '24h') return time24;
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Availability & Business Hours</h1>
        <p className="text-muted-foreground">Manage your working hours and time display preferences</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Booking Constraints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs space-y-2">
              <Label htmlFor="minimumBookingValue">Minimum Booking Value ($)</Label>
              <Input 
                id="minimumBookingValue" 
                type="number"
                min="0"
                step="0.01"
                value={settings.minimumBookingValue || '0'} 
                onChange={(e) => updateField('minimumBookingValue', e.target.value)}
                placeholder="0.00"
                data-testid="input-minimum-booking-value"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Customers must reach this cart total before proceeding to checkout. Set to 0 to disable.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Time Display & Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="timeFormat">Time Display Format</Label>
              <Select 
                value={settings.timeFormat || '12h'} 
                onValueChange={(value) => updateField('timeFormat', value)}
              >
                <SelectTrigger id="timeFormat">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                  <SelectItem value="24h">24-hour</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose how times are displayed in the booking calendar
              </p>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-semibold">Business Hours by Day</Label>
              <div className="space-y-3">
                {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => {
                  const dayHours = (settings.businessHours || DEFAULT_BUSINESS_HOURS)[day];

                  return (
                    <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                      <div className="flex items-center justify-between sm:justify-start gap-3 sm:w-auto">
                        <div className="w-24 capitalize font-medium text-sm">{day}</div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={dayHours.isOpen}
                            onCheckedChange={(checked) => {
                              const newHours = { ...(settings.businessHours || DEFAULT_BUSINESS_HOURS) };
                              newHours[day] = { ...newHours[day], isOpen: checked };
                              updateField('businessHours', newHours);
                            }}
                          />
                          <span className="text-sm text-muted-foreground w-12">{dayHours.isOpen ? 'Open' : 'Closed'}</span>
                        </div>
                      </div>
                      {dayHours.isOpen && (
                        <div className="flex items-center gap-2 flex-1">
                          <Select
                            value={dayHours.start}
                            onValueChange={(value) => {
                              const newHours = { ...(settings.businessHours || DEFAULT_BUSINESS_HOURS) };
                              newHours[day] = { ...newHours[day], start: value };
                              updateField('businessHours', newHours);
                            }}
                          >
                            <SelectTrigger className="w-full sm:w-32">
                              <SelectValue>{formatTimeDisplay(dayHours.start)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, h) => (
                                <SelectItem key={h} value={`${h.toString().padStart(2, '0')}:00`}>
                                  {formatTimeDisplay(`${h.toString().padStart(2, '0')}:00`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-muted-foreground shrink-0">to</span>
                          <Select
                            value={dayHours.end}
                            onValueChange={(value) => {
                              const newHours = { ...(settings.businessHours || DEFAULT_BUSINESS_HOURS) };
                              newHours[day] = { ...newHours[day], end: value };
                              updateField('businessHours', newHours);
                            }}
                          >
                            <SelectTrigger className="w-full sm:w-32">
                              <SelectValue>{formatTimeDisplay(dayHours.end)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, h) => (
                                <SelectItem key={h} value={`${h.toString().padStart(2, '0')}:00`}>
                                  {formatTimeDisplay(`${h.toString().padStart(2, '0')}:00`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Set different business hours for each day of the week. Days marked as closed won't show any available time slots.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface AnalyticsSettings {
  gtmContainerId: string;
  ga4MeasurementId: string;
  facebookPixelId: string;
  gtmEnabled: boolean;
  ga4Enabled: boolean;
  facebookPixelEnabled: boolean;
}

function IntegrationsSection() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<GHLSettings>({
    provider: 'gohighlevel',
    apiKey: '',
    locationId: '',
    calendarId: '2irhr47AR6K0AQkFqEQl',
    isEnabled: false
  });
  const [openAISettings, setOpenAISettings] = useState<OpenAISettings>({
    provider: 'openai',
    enabled: false,
    model: 'gpt-4o-mini',
    hasKey: false
  });
  const [openAIApiKey, setOpenAIApiKey] = useState('');
  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [isSavingOpenAI, setIsSavingOpenAI] = useState(false);
  const [openAITestResult, setOpenAITestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [openAITestMessage, setOpenAITestMessage] = useState<string | null>(null);
  const [analyticsSettings, setAnalyticsSettings] = useState<AnalyticsSettings>({
    gtmContainerId: '',
    ga4MeasurementId: '',
    facebookPixelId: '',
    gtmEnabled: false,
    ga4Enabled: false,
    facebookPixelEnabled: false
  });
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAnalytics, setIsSavingAnalytics] = useState(false);
  const [lastSavedAnalytics, setLastSavedAnalytics] = useState<Date | null>(null);
  const saveAnalyticsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ghlTestResult, setGhlTestResult] = useState<'idle' | 'success' | 'error'>('idle');

  const { data: ghlSettings, isLoading } = useQuery<GHLSettings>({
    queryKey: ['/api/integrations/ghl']
  });

  const { data: openaiSettingsData } = useQuery<OpenAISettings>({
    queryKey: ['/api/integrations/openai']
  });

  const { data: companySettings } = useQuery<any>({
    queryKey: ['/api/company-settings']
  });

  useEffect(() => {
    if (ghlSettings) {
      setSettings(ghlSettings);
    }
  }, [ghlSettings]);

  useEffect(() => {
    if (openaiSettingsData) {
      setOpenAISettings(openaiSettingsData);
      if (openaiSettingsData.hasKey) {
        setOpenAITestResult('success');
        setOpenAITestMessage(openaiSettingsData.enabled ? 'OpenAI is enabled.' : 'Key saved. Run test to verify connection.');
      } else {
        setOpenAITestResult('idle');
        setOpenAITestMessage(null);
      }
    }
  }, [openaiSettingsData]);

  useEffect(() => {
    if (companySettings) {
      setAnalyticsSettings({
        gtmContainerId: companySettings.gtmContainerId || '',
        ga4MeasurementId: companySettings.ga4MeasurementId || '',
        facebookPixelId: companySettings.facebookPixelId || '',
        gtmEnabled: companySettings.gtmEnabled || false,
        ga4Enabled: companySettings.ga4Enabled || false,
        facebookPixelEnabled: companySettings.facebookPixelEnabled || false
      });
    }
  }, [companySettings]);

  useEffect(() => {
    return () => {
      if (saveAnalyticsTimeoutRef.current) {
        clearTimeout(saveAnalyticsTimeoutRef.current);
      }
    };
  }, []);

  const saveAnalyticsSettings = useCallback(async (newSettings: Partial<AnalyticsSettings>) => {
    setIsSavingAnalytics(true);
    try {
      await apiRequest('PUT', '/api/company-settings', newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      setLastSavedAnalytics(new Date());
    } catch (error: any) {
      toast({ 
        title: 'Error saving analytics settings', 
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSavingAnalytics(false);
    }
  }, [toast]);

  const updateAnalyticsField = useCallback(<K extends keyof AnalyticsSettings>(field: K, value: AnalyticsSettings[K]) => {
    setAnalyticsSettings(prev => ({ ...prev, [field]: value }));
    
    if (saveAnalyticsTimeoutRef.current) {
      clearTimeout(saveAnalyticsTimeoutRef.current);
    }
    
    saveAnalyticsTimeoutRef.current = setTimeout(() => {
      saveAnalyticsSettings({ [field]: value });
    }, 800);
  }, [saveAnalyticsSettings]);

  const saveOpenAISettings = async (settingsToSave?: Partial<OpenAISettings> & { apiKey?: string }) => {
    setIsSavingOpenAI(true);
    try {
      await apiRequest('PUT', '/api/integrations/openai', {
        enabled: settingsToSave?.enabled ?? openAISettings.enabled,
        model: settingsToSave?.model || openAISettings.model,
        apiKey: settingsToSave?.apiKey || openAIApiKey || undefined
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/openai'] });
      setOpenAIApiKey('');
      toast({ title: 'OpenAI settings saved' });
    } catch (error: any) {
      toast({
        title: 'Failed to save OpenAI settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSavingOpenAI(false);
    }
  };

  const handleToggleOpenAI = async (checked: boolean) => {
    if (checked && !(openAITestResult === 'success' || openAISettings.hasKey)) {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling OpenAI.',
        variant: 'destructive'
      });
      return;
    }
    const next = { ...openAISettings, enabled: checked };
    setOpenAISettings(next);
    if (checked) {
      setOpenAITestResult('success');
      setOpenAITestMessage('OpenAI is enabled.');
    } else {
      setOpenAITestResult('idle');
      setOpenAITestMessage(null);
    }
    await saveOpenAISettings(next);
  };

  const testOpenAIConnection = async () => {
    setIsTestingOpenAI(true);
    setOpenAITestResult('idle');
    setOpenAITestMessage(null);
    try {
      const response = await fetch('/api/integrations/openai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: openAIApiKey || undefined,
          model: openAISettings.model
        }),
        credentials: 'include'
      });
      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      let result: any = {};
      if (contentType.includes('application/json')) {
        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          result = { success: false, message: text || 'Unexpected response from server' };
        }
      } else {
        const snippet = (text || '').replace(/\s+/g, ' ').slice(0, 140);
        result = {
          success: false,
          message: `Unexpected response (status ${response.status}, content-type: ${contentType || 'unknown'}). The API route may not be running. Try restarting the server and testing again. Snippet: ${snippet}`
        };
      }
      if (result.success) {
        setOpenAITestResult('success');
        setOpenAITestMessage('Connection successful. You can now enable OpenAI.');
        setOpenAISettings(prev => ({ ...prev, hasKey: true }));
        setOpenAIApiKey('');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/openai'] });
        toast({ title: 'OpenAI connected', description: 'API key saved. You can now enable the integration.' });
      } else {
        setOpenAITestResult('error');
        setOpenAITestMessage(result.message || 'Could not reach OpenAI.');
        toast({
          title: 'OpenAI test failed',
          description: result.message || 'Could not reach OpenAI',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'OpenAI test failed',
        description: error.message,
        variant: 'destructive'
      });
      setOpenAITestResult('error');
      setOpenAITestMessage(error.message || 'Connection failed.');
    } finally {
      setIsTestingOpenAI(false);
    }
  };

  const ghlTestButtonClass =
    ghlTestResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : ghlTestResult === 'error'
      ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
      : '';

  const openAITestButtonClass =
    openAITestResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : openAITestResult === 'error'
      ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
      : '';

  const hasGtmId = analyticsSettings.gtmContainerId.trim().length > 0;
  const hasGa4Id = analyticsSettings.ga4MeasurementId.trim().length > 0;
  const hasFacebookPixelId = analyticsSettings.facebookPixelId.trim().length > 0;

  const saveSettings = async (settingsToSave?: GHLSettings) => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/integrations/ghl', settingsToSave || settings);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/ghl'] });
      toast({ title: 'Settings saved successfully' });
    } catch (error: any) {
      toast({ 
        title: 'Failed to save settings', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    if (checked && ghlTestResult !== 'success') {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling GoHighLevel.',
        variant: 'destructive'
      });
      return;
    }
    const newSettings = { ...settings, isEnabled: checked };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const testConnection = async () => {
    setIsTesting(true);
    setGhlTestResult('idle');
    try {
      const response = await fetch('/api/integrations/ghl/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: settings.apiKey,
          locationId: settings.locationId
        }),
        credentials: 'include'
      });
      const result = await response.json();
      
      if (result.success) {
        setGhlTestResult('success');
        await saveSettings(settings);
        toast({ title: 'Connection successful', description: 'Settings saved. You can now enable the integration.' });
      } else {
        setGhlTestResult('error');
        toast({ 
          title: 'Connection failed', 
          description: result.message || 'Could not connect to GoHighLevel',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setGhlTestResult('error');
      toast({ 
        title: 'Connection failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">Connect your booking system with external services</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">AI & Chat</h2>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">OpenAI</CardTitle>
                  <p className="text-sm text-muted-foreground">Power the chat assistant with OpenAI responses</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSavingOpenAI && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                <Label className="text-sm">
                  {openAISettings.enabled ? 'Enabled' : 'Disabled'}
                </Label>
                <Switch
                  checked={openAISettings.enabled}
                  onCheckedChange={handleToggleOpenAI}
                  disabled={isSavingOpenAI}
                  data-testid="switch-openai-enabled"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="openai-api-key">API Key</Label>
                <Input
                  id="openai-api-key"
                  type="password"
                  value={openAIApiKey}
                  onChange={(e) => setOpenAIApiKey(e.target.value)}
                  placeholder={openAISettings.hasKey ? '••••••••••••' : 'sk-...'}
                  data-testid="input-openai-api-key"
                />
                <p className="text-xs text-muted-foreground">
                  Stored securely on the server. Not returned after saving.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="openai-model">Model</Label>
                <Select
                  value={openAISettings.model}
                  onValueChange={(val) => setOpenAISettings(prev => ({ ...prev, model: val }))}
                >
                  <SelectTrigger id="openai-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                    <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                variant="outline"
                className={openAITestButtonClass}
                onClick={testOpenAIConnection}
                disabled={isTestingOpenAI || (!openAIApiKey && !openAISettings.hasKey)}
                data-testid="button-test-openai"
              >
                {isTestingOpenAI && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {openAITestResult === 'success' ? 'Test OK' : openAITestResult === 'error' ? 'Test Failed' : 'Test Connection'}
              </Button>
            </div>

            {openAISettings.enabled && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Check className="w-4 h-4" />
                  <span className="font-medium text-sm">OpenAI is enabled.</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                  The chat assistant will use OpenAI to respond to visitors
                </p>
              </div>
            )}

            {!openAISettings.hasKey && !openAISettings.enabled && (
              <div className="text-xs text-muted-foreground">
                Add a key and test the connection to enable OpenAI responses.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">CRM & Calendar</h2>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">GoHighLevel</CardTitle>
                  <p className="text-sm text-muted-foreground">Sync calendars, contacts, and appointments</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                <Label htmlFor="ghl-enabled" className="text-sm">
                  {settings.isEnabled ? 'Enabled' : 'Disabled'}
                </Label>
                <Switch
                  id="ghl-enabled"
                  checked={settings.isEnabled}
                  onCheckedChange={handleToggleEnabled}
                  disabled={isSaving}
                  data-testid="switch-ghl-enabled"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ghl-api-key">API Key</Label>
                <Input
                  id="ghl-api-key"
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="Enter your GoHighLevel API key"
                  data-testid="input-ghl-api-key"
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your GHL account under Settings {'->'} Private Integrations
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ghl-location-id">Location ID</Label>
                <Input
                  id="ghl-location-id"
                  value={settings.locationId}
                  onChange={(e) => setSettings(prev => ({ ...prev, locationId: e.target.value }))}
                  placeholder="Enter your Location ID"
                  data-testid="input-ghl-location-id"
                />
                <p className="text-xs text-muted-foreground">
                  Your GHL sub-account/location identifier
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ghl-calendar-id">Calendar ID</Label>
                <Input
                  id="ghl-calendar-id"
                  value={settings.calendarId}
                  onChange={(e) => setSettings(prev => ({ ...prev, calendarId: e.target.value }))}
                  placeholder="Enter your Calendar ID"
                  data-testid="input-ghl-calendar-id"
                />
                <p className="text-xs text-muted-foreground">ID of the GHL calendar to sync appointments with</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                variant="outline"
                className={ghlTestButtonClass}
                onClick={testConnection}
                disabled={isTesting || !settings.apiKey || !settings.locationId}
                data-testid="button-test-ghl"
              >
                {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {ghlTestResult === 'success' ? 'Test OK' : ghlTestResult === 'error' ? 'Test Failed' : 'Test Connection'}
              </Button>
            </div>

            {settings.isEnabled && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Check className="w-4 h-4" />
                  <span className="font-medium text-sm">Integration Active</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                  New bookings will be synced to GoHighLevel automatically
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Marketing & Analytics</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isSavingAnalytics ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : lastSavedAnalytics ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span>Auto-saved</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-base">Google Tag Manager</CardTitle>
                </div>
                <Switch
                  checked={analyticsSettings.gtmEnabled}
                  onCheckedChange={(checked) => updateAnalyticsField('gtmEnabled', checked)}
                  data-testid="switch-gtm-enabled"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="gtm-id" className="text-sm">Container ID</Label>
                <Input
                  id="gtm-id"
                  value={analyticsSettings.gtmContainerId}
                  onChange={(e) => updateAnalyticsField('gtmContainerId', e.target.value)}
                  placeholder="GTM-XXXXXXX"
                  className="text-sm"
                  data-testid="input-gtm-id"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Find this in GTM under Admin {'->'} Container Settings
              </p>
              {analyticsSettings.gtmEnabled && hasGtmId && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  <span className="font-medium">Integration Active</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <CardTitle className="text-base">Google Analytics 4</CardTitle>
                </div>
                <Switch
                  checked={analyticsSettings.ga4Enabled}
                  onCheckedChange={(checked) => updateAnalyticsField('ga4Enabled', checked)}
                  data-testid="switch-ga4-enabled"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ga4-id" className="text-sm">Measurement ID</Label>
                <Input
                  id="ga4-id"
                  value={analyticsSettings.ga4MeasurementId}
                  onChange={(e) => updateAnalyticsField('ga4MeasurementId', e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                  className="text-sm"
                  data-testid="input-ga4-id"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Find this in GA4 Admin {'->'} Data Streams
              </p>
              {analyticsSettings.ga4Enabled && hasGa4Id && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  <span className="font-medium">Integration Active</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <CardTitle className="text-base">Facebook Pixel</CardTitle>
                </div>
                <Switch
                  checked={analyticsSettings.facebookPixelEnabled}
                  onCheckedChange={(checked) => updateAnalyticsField('facebookPixelEnabled', checked)}
                  data-testid="switch-fb-pixel-enabled"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fb-pixel-id" className="text-sm">Pixel ID</Label>
                <Input
                  id="fb-pixel-id"
                  value={analyticsSettings.facebookPixelId}
                  onChange={(e) => updateAnalyticsField('facebookPixelId', e.target.value)}
                  placeholder="123456789012345"
                  className="text-sm"
                  data-testid="input-fb-pixel-id"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Find this in Meta Events Manager
              </p>
              {analyticsSettings.facebookPixelEnabled && hasFacebookPixelId && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  <span className="font-medium">Integration Active</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Tracked Events</h2>
        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <p className="text-xs text-muted-foreground mb-3">
            When enabled, the following events are automatically tracked:
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { event: 'cta_click', desc: 'Button clicks (Book Now, etc.)' },
              { event: 'add_to_cart', desc: 'Service added to cart' },
              { event: 'remove_from_cart', desc: 'Service removed from cart' },
              { event: 'begin_checkout', desc: 'Booking form started' },
              { event: 'purchase', desc: 'Booking confirmed (conversion)' },
              { event: 'view_item_list', desc: 'Services page viewed' },
            ].map(({ event, desc }) => (
              <div key={event} className="text-xs bg-white dark:bg-slate-900 p-2 rounded border">
                <code className="text-primary font-mono">{event}</code>
                <p className="text-muted-foreground mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BlogSection() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'status'>('newest');
  const [serviceSearch, setServiceSearch] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    metaDescription: '',
    focusKeyword: '',
    featureImageUrl: '',
    status: 'published',
    authorName: 'Skleanings',
    publishedAt: new Date().toISOString().split('T')[0] as string | null,
    serviceIds: [] as number[],
  });

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['/api/blog'],
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['/api/services'],
  });

  const sortedPosts = useMemo(() => {
    if (!posts) return [];

    const sorted = [...posts];

    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.publishedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.publishedAt || b.createdAt || 0).getTime();
          return dateB - dateA;
        });
      case 'oldest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.publishedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.publishedAt || b.createdAt || 0).getTime();
          return dateA - dateB;
        });
      case 'title-asc':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'title-desc':
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      case 'status':
        return sorted.sort((a, b) => {
          if (a.status === b.status) return 0;
          return a.status === 'published' ? -1 : 1;
        });
      default:
        return sorted;
    }
  }, [posts, sortBy]);

  // Reset saved state when form data changes
  useEffect(() => {
    if (isSaved) {
      setIsSaved(false);
    }
  }, [formData]);

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest('POST', '/api/blog', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      toast({ title: 'Blog post created successfully' });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: 'Error creating post', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof formData }) =>
      apiRequest('PUT', `/api/blog/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    },
    onError: (err: any) => {
      toast({ title: 'Error updating post', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/blog/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      toast({ title: 'Blog post deleted' });
    },
    onError: (err: any) => {
      toast({ title: 'Error deleting post', description: err.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      slug: '',
      content: '',
      excerpt: '',
      metaDescription: '',
      focusKeyword: '',
      featureImageUrl: '',
      status: 'published',
      authorName: 'Skleanings',
      publishedAt: new Date().toISOString().split('T')[0] as string | null,
      serviceIds: [],
    });
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      title: value,
      slug: prev.slug || generateSlug(value),
    }));
  };

  const handleEdit = async (post: BlogPost) => {
    const postServices = await fetch(`/api/blog/${post.id}/services`).then(r => r.json());
    setEditingPost(post);
    setIsSaved(false);
    setFormData({
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt || '',
      metaDescription: post.metaDescription || '',
      focusKeyword: post.focusKeyword || '',
      featureImageUrl: post.featureImageUrl || '',
      status: post.status,
      authorName: post.authorName || 'Admin',
      publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString().split('T')[0] : null,
      serviceIds: postServices.map((s: Service) => s.id),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSend = {
      ...formData,
      publishedAt: formData.status === 'published' && formData.publishedAt 
        ? new Date(formData.publishedAt).toISOString() 
        : formData.status === 'published' 
          ? new Date().toISOString() 
          : null,
    };

    if (editingPost) {
      updateMutation.mutate({ id: editingPost.id, data: dataToSend });
    } else {
      createMutation.mutate(dataToSend);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { uploadURL, objectPath } = await fetch('/api/upload', { 
        method: 'POST',
        credentials: 'include',
      }).then(r => r.json());

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      setFormData(prev => ({ ...prev, featureImageUrl: objectPath }));
      toast({ title: 'Image uploaded successfully' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
  };

  const toggleServiceSelection = (serviceId: number) => {
    setFormData(prev => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter(id => id !== serviceId)
        : prev.serviceIds.length < 3 
          ? [...prev.serviceIds, serviceId]
          : prev.serviceIds,
    }));
  };

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Enter post title"
            required
            data-testid="input-blog-title"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
            placeholder="url-friendly-slug"
            required
            data-testid="input-blog-slug"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content *</Label>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
          placeholder="Write your blog post content here. HTML tags are supported (h2, h3, p, ul, li, strong, em, a)..."
          className="min-h-[300px] font-mono text-sm"
          required
          data-testid="textarea-blog-content"
        />
        <p className="text-xs text-muted-foreground">Supports HTML formatting</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="excerpt">Excerpt</Label>
        <Textarea
          id="excerpt"
          value={formData.excerpt}
          onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value.slice(0, 150) }))}
          placeholder="Short description shown on blog cards..."
          className="min-h-[80px]"
          data-testid="textarea-blog-excerpt"
        />
        <p className="text-xs text-muted-foreground">{formData.excerpt.length}/150 characters</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="featureImage">Feature Image</Label>
        <div className="flex items-center gap-4">
          {formData.featureImageUrl && (
            <img 
              src={formData.featureImageUrl} 
              alt="Feature" 
              className="w-32 h-18 object-cover rounded-lg"
              data-testid="img-blog-feature-preview"
            />
          )}
          <Input
            id="featureImage"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="flex-1"
            data-testid="input-blog-feature-image"
          />
        </div>
        <p className="text-xs text-muted-foreground">Recommended: 1200x675px (16:9 aspect ratio)</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="metaDescription">Meta Description</Label>
          <Textarea
            id="metaDescription"
            value={formData.metaDescription}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              metaDescription: e.target.value.slice(0, 155) 
            }))}
            placeholder="SEO meta description..."
            className="min-h-[80px]"
            data-testid="textarea-blog-meta"
          />
          <p className="text-xs text-muted-foreground">{formData.metaDescription.length}/155 characters</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="focusKeyword">Focus Keyword</Label>
          <Input
            id="focusKeyword"
            value={formData.focusKeyword}
            onChange={(e) => setFormData(prev => ({ ...prev, focusKeyword: e.target.value }))}
            placeholder="Primary SEO keyword"
            data-testid="input-blog-keyword"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Related Services (max 3)</Label>
        <Input
          placeholder="Search services..."
          value={serviceSearch}
          onChange={(e) => setServiceSearch(e.target.value)}
          className="mb-2"
          data-testid="input-service-search"
        />
        <div className="grid gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
          {services?.filter(s =>
            !s.isHidden &&
            s.name.toLowerCase().includes(serviceSearch.toLowerCase())
          ).map(service => (
            <div
              key={service.id}
              className="flex items-center gap-2"
            >
              <Checkbox
                id={`service-${service.id}`}
                checked={formData.serviceIds.includes(service.id)}
                onCheckedChange={() => toggleServiceSelection(service.id)}
                disabled={!formData.serviceIds.includes(service.id) && formData.serviceIds.length >= 3}
                data-testid={`checkbox-service-${service.id}`}
              />
              <Label htmlFor={`service-${service.id}`} className="text-sm cursor-pointer">
                {service.name} - ${service.price}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger data-testid="select-blog-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="publishedAt">Publication Date</Label>
          <Input
            id="publishedAt"
            type="date"
            value={formData.publishedAt || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, publishedAt: e.target.value || null }))}
            data-testid="input-blog-date"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="authorName">Author</Label>
          <Input
            id="authorName"
            value={formData.authorName}
            onChange={(e) => setFormData(prev => ({ ...prev, authorName: e.target.value }))}
            placeholder="Skleanings"
            data-testid="input-blog-author"
          />
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setIsCreateOpen(false);
            setEditingPost(null);
            setServiceSearch('');
            setIsSaved(false);
            resetForm();
          }}
          data-testid="button-blog-back-bottom"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Posts
        </Button>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsCreateOpen(false);
              setEditingPost(null);
              setServiceSearch('');
              setIsSaved(false);
              resetForm();
            }}
            data-testid="button-blog-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className={isSaved ? 'bg-green-600 hover:bg-green-600' : ''}
            data-testid="button-blog-save"
          >
            {(createMutation.isPending || updateMutation.isPending) && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {isSaved && <Check className="w-4 h-4 mr-2" />}
            {isSaved ? 'Saved' : editingPost ? 'Update Post' : 'Create Post'}
          </Button>
        </div>
      </div>
    </form>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isCreateOpen || editingPost) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsCreateOpen(false);
              setEditingPost(null);
              setServiceSearch('');
              setIsSaved(false);
              resetForm();
            }}
            data-testid="button-blog-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Posts
          </Button>
          <h1 className="text-2xl font-bold">
            {editingPost ? 'Edit Post' : 'Create New Post'}
          </h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            {renderForm()}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-blog-title">Blog Posts</h1>
          <p className="text-sm text-muted-foreground">Manage your blog content and SEO</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={sortBy} onValueChange={(value: typeof sortBy) => setSortBy(value)}>
            <SelectTrigger className="w-[180px]" data-testid="select-blog-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="title-asc">Title (A-Z)</SelectItem>
              <SelectItem value="title-desc">Title (Z-A)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setIsCreateOpen(true)} data-testid="button-blog-create">
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          {sortedPosts && sortedPosts.length > 0 ? (
            <div className="divide-y space-y-4">
              {sortedPosts.map(post => (
                <div key={post.id} className="flex items-start gap-4 py-4" data-testid={`row-blog-${post.id}`}>
                  {post.featureImageUrl ? (
                    <img
                      src={post.featureImageUrl}
                      alt={post.title}
                      className="w-[100px] h-[68px] object-cover rounded-sm flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleEdit(post)}
                      data-testid={`img-blog-${post.id}`}
                    />
                  ) : (
                    <div
                      className="w-[100px] h-[68px] bg-muted rounded-sm flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => handleEdit(post)}
                    >
                      <FileText className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-medium truncate cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleEdit(post)}
                      data-testid={`text-blog-title-${post.id}`}
                    >
                      {post.title}
                    </h3>
                    <div className="flex flex-col items-start gap-1 text-sm text-muted-foreground">
                      <span>{post.publishedAt ? format(new Date(post.publishedAt), 'MMM d, yyyy') : 'Not published'}</span>
                      <Badge variant={post.status === 'published' ? 'default' : 'secondary'} data-testid={`badge-blog-status-${post.id}`}>
                        {post.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(post)}
                      data-testid={`button-blog-edit-${post.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-blog-delete-${post.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Blog Post?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{post.title}". This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(post.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No blog posts yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first blog post to engage your audience
              </p>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-blog-first-post">
                <Plus className="w-4 h-4 mr-2" />
                Create First Post
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
