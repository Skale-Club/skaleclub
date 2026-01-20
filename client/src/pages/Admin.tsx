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
import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  ArrowUp,
  ArrowDown,
  Check,
  Eye,
  Users,
  Puzzle,
  Globe,
  Search,
  ChevronDown,
  LayoutGrid,
  List,
  MessageSquare,
  Archive,
  RotateCcw,
  Tag,
  Star,
  Shield,
  Sparkles,
  Heart,
  BadgeCheck,
  ThumbsUp,
  Trophy,
  Target,
  PhoneCall,
  LineChart,
  Moon,
  Sun,
  BookOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/context/ThemeContext';
import type { Category, Service, Booking, Subcategory, Faq, BlogPost, HomepageContent, FormLead, LeadClassification, LeadStatus, FormConfig, FormQuestion, FormOption, ConsultingStep } from '@shared/schema';
import { DEFAULT_FORM_CONFIG, calculateMaxScore, getSortedQuestions } from '@shared/form';
import { HelpCircle, FileText, AlertCircle, ExternalLink } from 'lucide-react';
import heroImage from '@assets/Persona-Mobile_1767749022412.png';
import ghlLogo from '@assets/ghl-logo.webp';
import { SiFacebook, SiGoogleanalytics, SiGoogletagmanager, SiOpenai, SiTwilio } from 'react-icons/si';

type AdminSection = 'dashboard' | 'bookings' | 'leads' | 'hero' | 'company' | 'seo' | 'faqs' | 'users' | 'availability' | 'chat' | 'integrations' | 'blog' | 'knowledge-base';

const menuItems = [
  { id: 'dashboard' as AdminSection, title: 'Dashboard', icon: LayoutDashboard },
  { id: 'company' as AdminSection, title: 'Company Infos', icon: Building2 },
  { id: 'hero' as AdminSection, title: 'Website', icon: Image },
  { id: 'bookings' as AdminSection, title: 'Bookings', icon: Calendar },
  { id: 'leads' as AdminSection, title: 'Leads', icon: Sparkles },
  { id: 'availability' as AdminSection, title: 'Availability', icon: Clock },
  { id: 'chat' as AdminSection, title: 'Chat', icon: MessageSquare },
  { id: 'knowledge-base' as AdminSection, title: 'Knowledge Base', icon: BookOpen },
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
  const [blogResetSignal, setBlogResetSignal] = useState(0);
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

  const handleSectionSelect = useCallback((section: AdminSection) => {
    if (section === 'blog') {
      if (activeSection === 'blog') {
        setBlogResetSignal(prev => prev + 1);
      } else {
        setActiveSection(section);
      }
      return;
    }
    setActiveSection(section);
  }, [activeSection]);

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
    <div className="flex min-h-screen md:h-screen w-full bg-background relative overflow-x-hidden">
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
                          onSelect={() => handleSectionSelect(item.id)}
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
            <Button
              variant="default"
              className="w-full"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <main className="flex-1 min-w-0 relative bg-background overflow-visible md:overflow-auto md:h-screen" id="admin-top">
        <header className="md:hidden sticky top-0 z-50 bg-card border-b border-border p-4 flex items-center gap-4">
          <SidebarTrigger className="bg-card shadow-sm border border-border rounded-lg p-2 h-10 w-10 shrink-0" />
          <button
            type="button"
            className="font-semibold text-primary select-none text-left"
            onClick={toggleSidebar}
          >
            {companySettings?.companyName || 'Skleanings'}
          </button>
        </header>
        <div className="p-6 pb-16 md:p-8 md:pb-10">
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
          {activeSection === 'bookings' && <BookingsSection />}
          {activeSection === 'leads' && <LeadsSection />}
          {activeSection === 'hero' && <HeroSettingsSection />}
          {activeSection === 'company' && <CompanySettingsSection />}
          {activeSection === 'seo' && <SEOSection />}
          {activeSection === 'faqs' && <FaqsSection />}
          {activeSection === 'users' && (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-card rounded-lg border-2 border-dashed border-border">
              <Users className="w-12 h-12 mb-4 opacity-40" />
              <p>User management coming soon</p>
            </div>
          )}
          {activeSection === 'availability' && <AvailabilitySection />}
          {activeSection === 'chat' && <ChatSection />}
          {activeSection === 'knowledge-base' && <KnowledgeBaseSection />}
          {activeSection === 'integrations' && <IntegrationsSection />}
          {activeSection === 'blog' && <BlogSection resetSignal={blogResetSignal} />}
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
  const dashboardMenuTitle = menuItems.find((item) => item.id === 'dashboard')?.title ?? 'Dashboard';

  const stats = [
    { label: 'Total Categories', value: categories?.length || 0, icon: FolderOpen, color: 'text-blue-500' },
    { label: 'Total Services', value: services?.length || 0, icon: Package, color: 'text-green-500' },
    { label: 'Total Bookings', value: bookings?.length || 0, icon: Calendar, color: 'text-purple-500' },
    { label: 'Revenue', value: `$${bookings?.reduce((sum, b) => sum + Number(b.totalPrice), 0).toFixed(2) || '0.00'}`, icon: DollarSign, color: 'text-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{dashboardMenuTitle}</h1>
        <p className="text-muted-foreground">Overview of your cleaning business</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-muted p-6 rounded-lg transition-all hover:bg-muted/80">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-card/70 flex items-center justify-center">
                <stat.icon className={clsx("w-6 h-6", stat.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-muted rounded-lg overflow-hidden">
        <div className="p-6 pb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Recent Bookings
          </h2>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={goToBookings}>
            Go to Bookings
          </Button>
        </div>
        <div className="px-6 pb-6">
          {bookings?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No bookings yet</p>
          ) : (
            <div className="space-y-4">
              {bookings?.slice(0, 5).map((booking) => (
                <div key={booking.id} className="flex flex-col gap-3 p-3 rounded-lg bg-card/70 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{booking.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(booking.bookingDate), "MMM dd, yyyy")} • {booking.startTime} - {booking.endTime}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{booking.customerAddress}</p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
                    <p className="text-2xl sm:text-xl font-bold">${booking.totalPrice}</p>
                    <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                      <Badge
                        variant={booking.status === 'confirmed' ? 'default' : booking.status === 'completed' ? 'secondary' : 'destructive'}
                        className="text-xs font-semibold leading-5 px-3 py-1 min-w-[88px] justify-center capitalize"
                      >
                        {booking.status}
                      </Badge>
                      <Badge
                        className={`text-xs font-semibold leading-5 px-3 py-1 min-w-[88px] justify-center border ${
                          booking.paymentStatus === 'paid'
                            ? 'border-primary/30 bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/20'
                            : 'border-border bg-muted text-muted-foreground'
                        }`}
                      >
                        {booking.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </div>
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
  const heroMenuTitle = menuItems.find((item) => item.id === 'hero')?.title ?? 'Hero Section';

  const HERO_DEFAULTS = {
    title: 'Gere clientes de forma previsível',
    subtitle: 'Consultoria em marketing digital para prestadores de serviço nos EUA. Transforme seu negócio com estratégias comprovadas de aquisição e conversão de clientes.',
    ctaText: 'Agendar Conversa Gratuita',
    image: heroImage,
  };

  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [aboutImageUrl, setAboutImageUrl] = useState('');
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
      console.log('Loading settings, heroImageUrl from DB:', settings.heroImageUrl);
      setHeroTitle(settings.heroTitle || HERO_DEFAULTS.title);
      setHeroSubtitle(settings.heroSubtitle || HERO_DEFAULTS.subtitle);
      setHeroImageUrl(settings.heroImageUrl || HERO_DEFAULTS.image);
      setAboutImageUrl(settings.aboutImageUrl || '');
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
        aboutSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.aboutSection,
          ...(settings.homepageContent?.aboutSection || {}),
        },
        areasServedSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
          ...(settings.homepageContent?.areasServedSection || {}),
        },
        consultingStepsSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection,
          ...(settings.homepageContent?.consultingStepsSection || {}),
          steps: (settings.homepageContent?.consultingStepsSection?.steps?.length
            ? settings.homepageContent.consultingStepsSection.steps
            : DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection?.steps) || [],
        },
      });
    }
  }, [settings]);

  useEffect(() => {
    if (!isLoading && !settings) {
      setHeroTitle(HERO_DEFAULTS.title);
      setHeroSubtitle(HERO_DEFAULTS.subtitle);
      setHeroImageUrl(HERO_DEFAULTS.image);
      setAboutImageUrl('');
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
  const consultingIconOptions = [
    { label: 'Pesquisa', value: 'search', icon: Search },
    { label: 'Diferencial', value: 'sparkles', icon: Sparkles },
    { label: 'Layout', value: 'layout', icon: LayoutGrid },
    { label: 'Foco', value: 'target', icon: Target },
    { label: 'Atendimento', value: 'phone-call', icon: PhoneCall },
    { label: 'Resultados', value: 'line-chart', icon: LineChart },
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
  const aboutSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.aboutSection,
    ...(homepageContent.aboutSection || {}),
  };
  const areasServedSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
    ...(homepageContent.areasServedSection || {}),
  };
  const consultingStepsSection = useMemo(() => {
    const base = {
      ...DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection,
      ...(homepageContent.consultingStepsSection || {}),
    };
    const steps = base.steps?.length
      ? base.steps
      : DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection?.steps || [];
    return { ...base, steps };
  }, [homepageContent.consultingStepsSection]);
  const consultingSteps = useMemo(
    () =>
      [...(consultingStepsSection.steps || [])].sort(
        (a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel)
      ),
    [consultingStepsSection.steps]
  );
  const practicalBullets =
    consultingStepsSection.practicalBullets?.length && consultingStepsSection.practicalBullets.length > 0
      ? consultingStepsSection.practicalBullets
      : DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection?.practicalBullets || [];

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
    console.log('saveHeroSettings called with:', updates);
    try {
      const response = await apiRequest('PUT', '/api/company-settings', updates);
      const savedData = await response.json();
      console.log('Saved data from server:', savedData);
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

  const updateConsultingSection = useCallback(
    (updater: (section: NonNullable<HomepageContent['consultingStepsSection']>) => NonNullable<HomepageContent['consultingStepsSection']>, fieldKey?: string) => {
      updateHomepageContent(prev => {
        const currentSection = {
          ...DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection,
          ...(prev.consultingStepsSection || {}),
        } as NonNullable<HomepageContent['consultingStepsSection']>;
        const updatedSection = updater(currentSection);
        return { ...prev, consultingStepsSection: updatedSection };
      }, fieldKey);
    },
    [updateHomepageContent]
  );

  const updateConsultingSteps = useCallback(
    (updater: (steps: ConsultingStep[]) => ConsultingStep[], fieldKey = 'homepageContent.consultingStepsSection.steps') => {
      updateConsultingSection(
        section => ({
          ...section,
          steps: updater([...(section.steps || [])]),
        }),
        fieldKey
      );
    },
    [updateConsultingSection]
  );

  const handleMoveStep = useCallback(
    (index: number, direction: -1 | 1) => {
      updateConsultingSteps(steps => {
        const ordered = [...steps].sort(
          (a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel)
        );
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= ordered.length) return ordered;
        const reordered = arrayMove(ordered, index, targetIndex).map((step, idx) => ({
          ...step,
          order: idx + 1,
        }));
        return reordered;
      });
    },
    [updateConsultingSteps]
  );

  const handleAddStep = useCallback(() => {
    const nextOrder = (consultingStepsSection.steps?.length || 0) + 1;
    const newStep: ConsultingStep = {
      order: nextOrder,
      numberLabel: String(nextOrder).padStart(2, '0'),
      icon: 'sparkles',
      title: 'Nova Etapa',
      whatWeDo: '',
      outcome: '',
    };
    updateConsultingSteps(steps => [...steps, newStep]);
  }, [consultingStepsSection.steps, updateConsultingSteps]);

  const handleDeleteStep = useCallback(
    (index: number) => {
      updateConsultingSteps(steps => {
        const ordered = [...steps].sort(
          (a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel)
        );
        const filtered = ordered.filter((_, i) => i !== index);
        return filtered.map((step, idx) => ({ ...step, order: step.order ?? idx + 1 }));
      });
    },
    [updateConsultingSteps]
  );

  const handleStepChange = useCallback(
    (index: number, updater: (step: ConsultingStep) => ConsultingStep, fieldKey: string, resort = false) => {
      updateConsultingSteps(
        steps => {
          const ordered = [...steps].sort(
            (a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel)
          );
          if (!ordered[index]) return ordered;
          ordered[index] = updater(ordered[index]);
          const next = resort
            ? [...ordered].sort(
                (a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel)
              )
            : ordered;
          return next;
        },
        fieldKey
      );
    },
    [updateConsultingSteps]
  );

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let imagePath = '';
      
      try {
        const uploadRes = await apiRequest('POST', '/api/upload');
        const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

        await fetch(uploadURL, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type }
        });
        
        imagePath = objectPath;
      } catch (objectStorageError) {
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const localRes = await apiRequest('POST', '/api/upload-local', {
          filename: file.name,
          data: base64Data
        });
        const { path } = await localRes.json() as { path: string };
        imagePath = path;
      }

      console.log('Saving hero image URL:', imagePath);
      setHeroImageUrl(imagePath);
      await saveHeroSettings({ heroImageUrl: imagePath }, ['heroImageUrl']);
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
          <h1 className="text-2xl font-bold">{heroMenuTitle}</h1>
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
      <div className="bg-muted p-6 rounded-lg transition-all space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            Hero Section
          </h2>
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
                <div className="aspect-[4/3] w-full max-w-xs rounded-lg border-2 border-dashed border-border bg-card flex items-center justify-center overflow-hidden relative group">
                  {heroImageUrl ? (
                    <img src={heroImageUrl} alt="Hero preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <Image className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Background Image</p>
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

        <div className="border-t border-border pt-6 space-y-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-primary" />
            Hero Badge
          </h3>
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

      <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-primary" />
            Trust Badges
          </h2>
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
              className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto] items-start bg-card p-3 rounded-lg border border-border"
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
        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            Categories Section
          </h2>
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

        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            Reviews Section
          </h2>
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
        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Blog Section
          </h2>
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

        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Seção Quem Somos
          </h2>
          <div className="space-y-2">
            <Label>Label</Label>
            <div className="relative">
              <Input
                value={aboutSection.label || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    aboutSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.aboutSection,
                      ...(prev.aboutSection || {}),
                      label: e.target.value,
                    },
                  }), 'homepageContent.aboutSection.label')
                }
              />
              <SavedIndicator field="homepageContent.aboutSection.label" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Título</Label>
            <div className="relative">
              <Input
                value={aboutSection.heading || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    aboutSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.aboutSection,
                      ...(prev.aboutSection || {}),
                      heading: e.target.value,
                    },
                  }), 'homepageContent.aboutSection.heading')
                }
              />
              <SavedIndicator field="homepageContent.aboutSection.heading" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <div className="relative">
              <Textarea
                value={aboutSection.description || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    aboutSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.aboutSection,
                      ...(prev.aboutSection || {}),
                      description: e.target.value,
                    },
                  }), 'homepageContent.aboutSection.description')
                }
                className="min-h-[120px]"
              />
              <SavedIndicator field="homepageContent.aboutSection.description" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Imagem de Quem Somos</Label>
            <div className="flex flex-col gap-3">
              <div className="aspect-video w-full max-w-md rounded-lg border-2 border-dashed border-border bg-card flex items-center justify-center overflow-hidden relative group">
                {aboutImageUrl ? (
                  <img src={aboutImageUrl} alt="About preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <Image className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Imagem da Seção</p>
                  </div>
                )}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        const res = await fetch('/api/upload-local', {
                          method: 'POST',
                          body: formData
                        });
                        if (!res.ok) throw new Error('Upload failed');
                        const { path } = await res.json();
                        setAboutImageUrl(path);
                        handleFieldUpdate('aboutImageUrl', path);
                        toast({ title: 'Sucesso', description: 'Imagem enviada com sucesso!' });
                      } catch (error: any) {
                        toast({ 
                          title: 'Erro no upload', 
                          description: error.message, 
                          variant: 'destructive' 
                        });
                      }
                    }} 
                    accept="image/*" 
                  />
                  <Plus className="w-8 h-8 text-white" />
                </label>
              </div>
              <div className="relative max-w-md">
                <Input
                  value={aboutImageUrl}
                  onChange={(e) => {
                    setAboutImageUrl(e.target.value);
                    handleFieldUpdate('aboutImageUrl', e.target.value);
                  }}
                  placeholder="Ou cole a URL da imagem (https://...)"
                  data-testid="input-about-image"
                />
                <SavedIndicator field="aboutImageUrl" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Areas Served Section
          </h2>
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
      <div className="bg-muted p-6 rounded-lg transition-all space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-primary" />
              Consultoria - Como Funciona
            </h2>
            <p className="text-sm text-muted-foreground">Edite o passo a passo exibido na landing.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={consultingStepsSection.enabled ?? true}
                onCheckedChange={(checked) =>
                  updateConsultingSection(
                    section => ({ ...section, enabled: checked }),
                    'homepageContent.consultingStepsSection.enabled'
                  )
                }
              />
              <span className="text-sm text-muted-foreground">
                {consultingStepsSection.enabled ? 'Seção ativa' : 'Seção oculta'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Título</Label>
            <div className="relative">
              <Input
                value={consultingStepsSection.title || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, title: e.target.value }),
                    'homepageContent.consultingStepsSection.title'
                  )
                }
                placeholder="Como Funciona a Consultoria"
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <div className="relative">
              <Textarea
                value={consultingStepsSection.subtitle || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, subtitle: e.target.value }),
                    'homepageContent.consultingStepsSection.subtitle'
                  )
                }
                className="min-h-[96px]"
                placeholder="Um processo claro, em etapas, para você gerar clientes de forma previsível nos EUA."
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.subtitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Slug/ID da seção</Label>
            <div className="relative">
              <Input
                value={consultingStepsSection.sectionId || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, sectionId: e.target.value }),
                    'homepageContent.consultingStepsSection.sectionId'
                  )
                }
                placeholder="como-funciona"
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.sectionId" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Texto auxiliar (opcional)</Label>
            <div className="relative">
              <Textarea
                value={consultingStepsSection.helperText || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, helperText: e.target.value }),
                    'homepageContent.consultingStepsSection.helperText'
                  )
                }
                className="min-h-[80px]"
                placeholder="Texto curto abaixo do CTA"
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.helperText" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CTA - Texto do botão</Label>
            <div className="relative">
              <Input
                value={consultingStepsSection.ctaButtonLabel || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, ctaButtonLabel: e.target.value }),
                    'homepageContent.consultingStepsSection.ctaButtonLabel'
                  )
                }
                placeholder="Agendar Conversa Gratuita"
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.ctaButtonLabel" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CTA - Link/ação</Label>
            <div className="relative">
              <Input
                value={consultingStepsSection.ctaButtonLink || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, ctaButtonLink: e.target.value }),
                    'homepageContent.consultingStepsSection.ctaButtonLink'
                  )
                }
                placeholder="#lead-form"
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.ctaButtonLink" />
            </div>
            <p className="text-xs text-muted-foreground">Use um anchor (#lead-form) ou um link interno.</p>
          </div>
          <div className="space-y-2">
            <Label>Bloco Na prática - Título</Label>
            <div className="relative">
              <Input
                value={consultingStepsSection.practicalBlockTitle || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, practicalBlockTitle: e.target.value }),
                    'homepageContent.consultingStepsSection.practicalBlockTitle'
                  )
                }
                placeholder="Na prática"
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.practicalBlockTitle" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Label>Bullets do bloco Na prática</Label>
            {practicalBullets.length < 6 && (
              <Button
                variant="outline"
                size="sm"
                className="border-dashed"
                onClick={() =>
                  updateConsultingSection(
                    section => ({
                      ...section,
                      practicalBullets: [...(section.practicalBullets || []), 'Novo bullet'],
                    }),
                    'homepageContent.consultingStepsSection.practicalBullets'
                  )
                }
              >
                <Plus className="w-4 h-4 mr-2" /> Adicionar bullet
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {practicalBullets.map((bullet, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="relative flex-1">
                  <Input
                    value={bullet}
                    onChange={(e) =>
                      updateConsultingSection(
                        section => {
                          const current = [...(section.practicalBullets || practicalBullets)];
                          current[index] = e.target.value;
                          return { ...section, practicalBullets: current };
                        },
                        `homepageContent.consultingStepsSection.practicalBullets.${index}`
                      )
                    }
                  />
                  <SavedIndicator field={`homepageContent.consultingStepsSection.practicalBullets.${index}`} />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={practicalBullets.length <= 1}
                  onClick={() =>
                    updateConsultingSection(
                      section => {
                        const current = [...(section.practicalBullets || practicalBullets)];
                        return { ...section, practicalBullets: current.filter((_, i) => i !== index) };
                      },
                      'homepageContent.consultingStepsSection.practicalBullets'
                    )
                  }
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            {practicalBullets.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem bullets cadastrados.</p>
            )}
          </div>
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <List className="w-4 h-4 text-primary" />
                Etapas (cards)
              </h3>
              <p className="text-sm text-muted-foreground">Reordene pelas setas ou ajustando o campo Ordem.</p>
            </div>
            <Button variant="outline" size="sm" className="border-dashed" onClick={handleAddStep}>
              <Plus className="w-4 h-4 mr-2" /> Adicionar etapa
            </Button>
          </div>

          <div className="space-y-3">
            {consultingSteps.map((step, index) => (
              <div
                key={`${step.numberLabel}-${index}`}
                className="bg-card border border-border rounded-lg p-4 space-y-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                      {step.numberLabel || String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold">{step.title || 'Etapa'}</p>
                      <p className="text-xs text-muted-foreground">Ordem {step.order ?? index + 1}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => handleMoveStep(index, -1)}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === consultingSteps.length - 1}
                      onClick={() => handleMoveStep(index, 1)}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteStep(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Ordem</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={step.order ?? index + 1}
                        onChange={(e) =>
                          handleStepChange(
                            index,
                            current => ({ ...current, order: Number(e.target.value) || index + 1 }),
                            `homepageContent.consultingStepsSection.steps.${index}.order`,
                            true
                          )
                        }
                      />
                      <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.order`} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Número</Label>
                    <div className="relative">
                      <Input
                        value={step.numberLabel || ''}
                        onChange={(e) =>
                          handleStepChange(
                            index,
                            current => ({ ...current, numberLabel: e.target.value }),
                            `homepageContent.consultingStepsSection.steps.${index}.numberLabel`
                          )
                        }
                        placeholder="01"
                      />
                      <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.numberLabel`} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Ícone</Label>
                    <Select
                      value={step.icon || consultingIconOptions[0].value}
                      onValueChange={(value) =>
                        handleStepChange(
                          index,
                          current => ({ ...current, icon: value }),
                          `homepageContent.consultingStepsSection.steps.${index}.icon`
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {consultingIconOptions.map(option => (
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

                <div className="space-y-2">
                  <Label>Título</Label>
                  <div className="relative">
                    <Input
                      value={step.title}
                      onChange={(e) =>
                        handleStepChange(
                          index,
                          current => ({ ...current, title: e.target.value }),
                          `homepageContent.consultingStepsSection.steps.${index}.title`
                        )
                      }
                    />
                    <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.title`} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>O que fazemos</Label>
                    <div className="relative">
                      <Textarea
                        value={step.whatWeDo}
                        onChange={(e) =>
                          handleStepChange(
                            index,
                            current => ({ ...current, whatWeDo: e.target.value }),
                            `homepageContent.consultingStepsSection.steps.${index}.whatWeDo`
                          )
                        }
                        className="min-h-[110px]"
                      />
                      <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.whatWeDo`} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Você sai com</Label>
                    <div className="relative">
                      <Textarea
                        value={step.outcome}
                        onChange={(e) =>
                          handleStepChange(
                            index,
                            current => ({ ...current, outcome: e.target.value }),
                            `homepageContent.consultingStepsSection.steps.${index}.outcome`
                          )
                        }
                        className="min-h-[110px]"
                      />
                      <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.outcome`} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {consultingSteps.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>
            )}
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
      let imagePath = '';
      
      try {
        const uploadRes = await apiRequest('POST', '/api/upload');
        const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

        await fetch(uploadURL, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type }
        });
        
        imagePath = objectPath;
      } catch (objectStorageError) {
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const localRes = await apiRequest('POST', '/api/upload-local', {
          filename: file.name,
          data: base64Data
        });
        const { path } = await localRes.json() as { path: string };
        imagePath = path;
      }

      const fieldMap = { main: 'logoMain', dark: 'logoDark', icon: 'logoIcon' } as const;
      const fieldName = fieldMap[type];
      
      setSettings(prev => ({ ...prev, [fieldName]: imagePath }));
      await saveSettings({ [fieldName]: imagePath });
      
      if (type === 'icon') {
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        try {
          await apiRequest('POST', '/api/update-favicon', {
            data: base64Data,
            filename: file.name
          });
        } catch (faviconError) {
          console.error('Failed to update system favicon:', faviconError);
        }
      }
      
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
          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
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
          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Image className="w-5 h-5 text-primary" />
              Branding Assets
            </h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Main Logo (Light Mode)</Label>
                <div className="flex flex-col gap-3">
                  <div className="h-32 rounded-lg border-2 border-dashed border-border bg-white flex items-center justify-center overflow-hidden relative group">
                    {settings.logoMain ? (
                      <img src={settings.logoMain} alt="Main Logo" className="max-h-full max-w-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-4">
                        <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Main Logo</p>
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
                  <div className="h-32 rounded-lg border-2 border-dashed border-border bg-slate-900 dark:bg-slate-100 flex items-center justify-center overflow-hidden relative group">
                    {settings.logoDark ? (
                      <img src={settings.logoDark} alt="Dark Logo" className="max-h-full max-w-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-4">
                        <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Dark Logo</p>
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
                  <div className="h-24 w-24 rounded-lg border-2 border-dashed border-border bg-white flex items-center justify-center overflow-hidden relative group mx-auto">
                    {settings.logoIcon ? (
                      <img src={settings.logoIcon} alt="Icon" className="max-h-full max-w-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-2">
                        <Image className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                        <p className="text-[10px] text-muted-foreground">Icon</p>
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
          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
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
          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
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
                  <div className="aspect-[1.91/1] w-full max-w-xs rounded-lg border-2 border-dashed border-border bg-card flex items-center justify-center overflow-hidden relative group">
                    {settings.ogImage ? (
                      <img src={settings.ogImage} alt="OG Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-4">
                        <Image className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">1200 x 630 px</p>
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

          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
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
          <DialogContent className="border-0 bg-white dark:bg-slate-800">
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
          <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
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
        <DialogContent className="max-w-xl border-0 bg-white dark:bg-slate-800">
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
                <Button type="button" variant="outline" className="border-0">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700 border-0"
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
                            variant="destructive"
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
              <div className="relative w-48 aspect-[4/3] bg-muted rounded-lg overflow-hidden border border-border cursor-pointer group" onClick={() => document.getElementById('categoryImageUpload')?.click()}>
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-cover transition-opacity group-hover:opacity-50"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="text-center">
                    <svg className="w-8 h-8 text-white mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-white text-xs font-medium">Click to upload</p>
                  </div>
                </div>
                <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                  4:3 Preview
                </div>
              </div>
            )}
            <Input
              id="categoryImageUpload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              data-testid="input-category-image-upload"
              className="hidden"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button" className="border-0">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading} data-testid="button-save-category" className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700 border-0">
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
        <div className="p-12 text-center bg-card border border-border rounded-lg">
          <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No subcategories yet</h3>
          <p className="text-muted-foreground mb-4">Create subcategories to organize your services</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredSubcategories?.map((subcategory) => (
            <div
              key={subcategory.id}
              className="flex items-center gap-4 p-4 rounded-lg bg-muted transition-all"
              data-testid={`subcategory-item-${subcategory.id}`}
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{subcategory.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="border-0 bg-secondary">
                    {getCategoryName(subcategory.categoryId)}
                  </Badge>
                  <Badge variant="outline" className="border-0 bg-secondary">
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
                        variant="destructive"
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
  const scrollPositionRef = useRef<number>(0);

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
      const response = await apiRequest('PUT', `/api/services/${data.id}`, serviceData);
      const updatedService = await response.json();
      if (addonIds !== undefined) {
        await apiRequest('PUT', `/api/services/${data.id}/addons`, { addonIds });
      }
      return updatedService;
    },
    onSuccess: async (updatedService) => {
      // Update local state immediately for instant UI feedback
      setOrderedServices(prev =>
        prev.map(s => s.id === updatedService.id ? updatedService : s)
      );
      // Also update the query cache directly
      queryClient.setQueryData(['/api/services', { includeHidden: true }], (old: Service[] | undefined) =>
        old?.map(s => s.id === updatedService.id ? updatedService : s) ?? []
      );
      // Refetch to ensure consistency
      await queryClient.refetchQueries({ queryKey: ['/api/services', { includeHidden: true }] });
      await queryClient.refetchQueries({ queryKey: ['/api/service-addons'] });
      toast({ title: 'Service updated successfully' });
      const savedScrollPosition = scrollPositionRef.current;
      setEditingService(null);
      setIsDialogOpen(false);
      // Restore scroll position after dialog closes
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedScrollPosition, behavior: 'instant' });
      });
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
            <Button
              size="sm"
              className="h-10 px-3 text-sm bg-primary text-primary-foreground border-0 shadow-none focus-visible:ring-0"
              data-testid="button-add-service"
            >
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
            variant="outline"
            size="sm"
            onClick={() => setViewMode('grid')}
            className={clsx(
              "h-10 min-w-[88px] bg-card/70 text-sm border-0 shadow-none focus-visible:ring-0",
              viewMode === 'grid' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="w-4 h-4 mr-1.5" />
            Grid
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode('list')}
            className={clsx(
              "h-10 min-w-[88px] bg-card/70 text-sm border-0 shadow-none focus-visible:ring-0",
              viewMode === 'list' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="w-4 h-4 mr-1.5" />
            List
          </Button>
        </div>
        <Input
          placeholder="Search services..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs h-10 bg-card/70 text-sm placeholder:text-muted-foreground border-0 shadow-none focus-visible:ring-0"
          data-testid="input-search-services"
        />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px] h-10 bg-card/70 text-sm border-0 shadow-none focus-visible:ring-0" data-testid="select-filter-category">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent className="border-0 shadow-none">
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map(cat => (
              <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredServices?.length === 0 ? (
        <Card className="p-12 text-center bg-card border border-border">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
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
                    onEdit={() => {
                      scrollPositionRef.current = window.scrollY;
                      setEditingService(service);
                      setIsDialogOpen(true);
                    }}
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
                    onEdit={() => {
                      scrollPositionRef.current = window.scrollY;
                      setEditingService(service);
                      setIsDialogOpen(true);
                    }}
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
  const { isMobile, setOpenMobile } = useSidebar();
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
        onClick={() => {
          onSelect();
          if (isMobile) {
            setOpenMobile(false);
          }
        }}
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
        "group relative overflow-hidden rounded-lg bg-muted transition-all h-full flex flex-col",
        isDragging && "ring-2 ring-primary/40 shadow-lg bg-card/80"
      )}
    >
      <button
        className="absolute top-2 left-2 z-20 p-2 text-muted-foreground hover:text-foreground bg-card/80 backdrop-blur-sm rounded-md shadow-sm cursor-grab active:cursor-grabbing"
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
        <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center text-muted-foreground">
          <Package className="w-5 h-5" />
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-lg leading-tight pr-6">{service.name}</h3>
          {service.isHidden && (
            <Badge variant="secondary" className="text-[11px] border-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
              Add-on Only
            </Badge>
          )}
        </div>
        <div className="text-2xl font-bold text-primary mb-2">${service.price}</div>
        <Badge variant="secondary" className="w-fit border-0 bg-secondary mb-2">
          {categoryName}
        </Badge>
        <p className="text-sm text-muted-foreground mb-2">{service.description}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Clock className="w-4 h-4" />
          <span>{durationLabel}</span>
        </div>
        <div className="mt-auto pt-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="flex-1 bg-card dark:bg-slate-700/60 border-0"
              data-testid={`button-edit-service-${service.id}`}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="bg-card dark:bg-slate-700/60 border-0" data-testid={`button-delete-service-${service.id}`}>
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
                    variant="destructive"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
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
        "flex flex-col sm:flex-row gap-3 p-3 rounded-lg bg-card border border-border shadow-sm",
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
        <div className="w-28 sm:w-32 aspect-[4/3] rounded-md overflow-hidden bg-muted flex-shrink-0">
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
            <Badge variant="secondary" className="text-[11px] border-0 bg-secondary">#{index + 1}</Badge>
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
          <Badge variant="secondary" className="w-fit border-0 bg-secondary">
            {categoryName}
          </Badge>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="bg-card border-0"
            data-testid={`button-edit-service-${service.id}`}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="bg-card border-0" data-testid={`button-delete-service-${service.id}`}>
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
                  variant="destructive"
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
        "flex w-full min-w-0 flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-lg bg-light-gray dark:bg-slate-800 cursor-grab active:cursor-grabbing transition-all shadow-sm",
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
          <div className="w-16 aspect-[4/3] sm:w-24 rounded-[2px] bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
            <FolderOpen className="w-4 h-4" />
          </div>
        )}
        <div className="flex-1 min-w-0 sm:hidden">
          <h3 className="font-semibold truncate">{category.name}</h3>
          <Badge variant="secondary" className="mt-1 bg-[#FFFF01] text-black font-bold dark:bg-[#FFFF01] dark:text-black">
            {serviceCount} services
          </Badge>
          <Badge variant="outline" className="mt-1 border-0 bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-200">
            {(subcategories?.filter(sub => sub.categoryId === category.id).length) ?? 0} subcategories
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 border-0"
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
                  variant="destructive"
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
            <Badge variant="secondary" className="bg-[#FFFF01] text-black font-bold dark:bg-[#FFFF01] dark:text-black">
              {serviceCount} services
            </Badge>
            <Badge variant="outline" className="border-0 bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-200">
              {(subcategories?.filter(sub => sub.categoryId === category.id).length) ?? 0} subcategories
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="border-0"
              onClick={onManageSubcategories}
            >
              Manage subcategories
            </Button>
          </div>
        </div>
        <Badge variant="secondary" className="border-0 bg-slate-800 text-white shrink-0 self-center dark:bg-slate-700 dark:text-slate-200">
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
                variant="destructive"
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
              <div className="relative w-full aspect-[4/3] bg-muted rounded-lg overflow-hidden border border-border">
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
            <div className="space-y-2 border rounded-md p-3 bg-muted">
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
    case 'pending': return 'bg-warning/10 text-warning dark:text-warning border-warning/20';
    case 'confirmed': return 'bg-primary/10 text-primary border-primary/20';
    case 'completed': return 'bg-success/10 text-success border-success/20';
    case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
    default: return 'bg-muted text-muted-foreground border-border';
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

  const handlePaymentChange = (paymentStatus: string) => {
    onUpdate(booking.id, { paymentStatus });
    toast({ title: `Payment status changed to ${paymentStatus}` });
  };

  return (
    <>
      <tr className="hover:bg-muted/30 dark:hover:bg-slate-700/30 transition-colors">
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setExpanded(!expanded)}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-muted dark:hover:bg-slate-700 transition-colors"
              data-testid={`button-expand-booking-${booking.id}`}
            >
              <ChevronDown className={clsx("w-4 h-4 transition-transform", expanded && "rotate-180")} />
            </button>
            <div>
              <p className="font-semibold text-foreground">{booking.customerName}</p>
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
                    <span className="w-2.5 h-2.5 rounded-full border border-primary/40 bg-primary/15" />
                    Confirmed
                  </span>
                </SelectItem>
                <SelectItem value="completed">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full border border-secondary/70 bg-secondary/40" />
                    Completed
                  </span>
                </SelectItem>
                <SelectItem value="cancelled">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full border border-destructive/40 bg-destructive/15" />
                    Cancelled
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </td>
        <td className="px-6 py-4">
          <Select value={booking.paymentStatus} onValueChange={handlePaymentChange}>
            <SelectTrigger className="w-[120px] h-10 text-xs" data-testid={`select-payment-${booking.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full border border-primary/40 bg-primary/15" />
                  Paid
                </span>
              </SelectItem>
              <SelectItem value="unpaid">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full border border-muted-foreground/30 bg-muted-foreground/15" />
                  Unpaid
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-6 py-4">
          <span
            className="font-bold text-foreground"
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
                    variant="destructive"
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
        <tr className="bg-muted/60">
          <td colSpan={7} className="px-6 py-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300">Booked Services</h4>
              {bookingItems && bookingItems.length > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-slate-700">
                  {bookingItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{item.serviceName}</span>
                      <span className="text-sm font-medium text-foreground">${item.price}</span>
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
    <Card className="mb-4 overflow-hidden border-0 bg-muted">
      <CardHeader className="p-4 pb-3 space-y-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-base truncate">{booking.customerName}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(booking.bookingDate), 'MMM dd, yyyy')} • {booking.startTime} - {booking.endTime}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">${booking.totalPrice}</p>
            <p className="text-xs text-muted-foreground">#{booking.id}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <MapPin className="w-4 h-4 mt-0.5" />
          <span className="truncate">{booking.customerAddress}</span>
        </div>

        <div className="grid gap-2">
          <Select onValueChange={handleStatusChange} defaultValue={booking.status}>
            <SelectTrigger className="h-9 text-xs w-full">
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
            <SelectTrigger className="h-9 text-xs w-full">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Hide Details' : 'Show Services'}
            <ChevronDown className={clsx("w-4 h-4 ml-2 transition-transform", isExpanded && "rotate-180")} />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
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
        </div>

        {isExpanded && (
          <div className="mt-2 p-3 bg-card/70 dark:bg-slate-900/70 rounded-md space-y-2">
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
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-muted-foreground">
              <p>Email: {booking.customerEmail}</p>
              <p>Phone: {booking.customerPhone}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeadsSection() {
  const { toast } = useToast();
  const [isFormEditorOpen, setIsFormEditorOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<FormLead | null>(null);
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);
  const [filters, setFilters] = useState<{
    search: string;
    classification: LeadClassification | 'all';
    status: LeadStatus | 'all';
    completion: 'all' | 'complete' | 'incomplete';
  }>({
    search: '',
    classification: 'all',
    status: 'all',
    completion: 'all',
  });

  const { data: formConfig } = useQuery<FormConfig>({
    queryKey: ['/api/form-config'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/form-config');
      return res.json();
    }
  });

  const { data: leads, isLoading } = useQuery<FormLead[]>({
    queryKey: ['/api/form-leads', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.classification !== 'all') params.set('classificacao', filters.classification);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.completion === 'complete') params.set('formCompleto', 'true');
      if (filters.completion === 'incomplete') params.set('formCompleto', 'false');
      const res = await apiRequest('GET', `/api/form-leads${params.toString() ? `?${params.toString()}` : ''}`);
      return res.json();
    }
  });

  const questionsForDisplay = useMemo(() => getSortedQuestions(formConfig || DEFAULT_FORM_CONFIG), [formConfig]);
  const totalQuestions = questionsForDisplay.length || DEFAULT_FORM_CONFIG.questions.length;

  const deleteLead = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/form-leads/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/form-leads'] });
      toast({ title: 'Lead deletado' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao deletar lead',
        description: error?.message || 'Tente novamente',
        variant: 'destructive'
      });
    }
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, status, observacoes }: { id: number; status?: LeadStatus; observacoes?: string }) => {
      const res = await apiRequest('PATCH', `/api/form-leads/${id}`, { status, observacoes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/form-leads'] });
      toast({ title: 'Lead atualizado' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar lead',
        description: error?.message || 'Tente novamente',
        variant: 'destructive'
      });
    }
  });

  const openLeadDialog = (lead: FormLead) => {
    setSelectedLead(lead);
    setIsLeadDialogOpen(true);
  };

  const stats = useMemo(() => {
    const list = leads || [];
    return {
      total: list.length,
      hot: list.filter(l => l.classificacao === 'QUENTE').length,
      warm: list.filter(l => l.classificacao === 'MORNO').length,
      cold: list.filter(l => l.classificacao === 'FRIO').length,
      inProgress: list.filter(l => !l.formCompleto).length,
    };
  }, [leads]);

  const statusOptions: { value: LeadStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Todos status' },
    { value: 'novo', label: 'Novo' },
    { value: 'contatado', label: 'Contatado' },
    { value: 'qualificado', label: 'Qualificado' },
    { value: 'convertido', label: 'Convertido' },
    { value: 'descartado', label: 'Descartado' },
  ];

  const classificationOptions: { value: LeadClassification | 'all'; label: string }[] = [
    { value: 'all', label: 'Todas as classificações' },
    { value: 'QUENTE', label: 'Lead Quente' },
    { value: 'MORNO', label: 'Lead Morno' },
    { value: 'FRIO', label: 'Lead Frio' },
    { value: 'DESQUALIFICADO', label: 'Desqualificado' },
  ];

  const completionOptions: { value: 'all' | 'complete' | 'incomplete'; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'complete', label: 'Formulário completo' },
    { value: 'incomplete', label: 'Abandonado' },
  ];

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    return format(new Date(value), 'MMM d, yyyy');
  };

  const classificationBadge = (classificacao?: LeadClassification | null) => {
    switch (classificacao) {
      case 'QUENTE':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'MORNO':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'FRIO':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'DESQUALIFICADO':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const questionLabel = (lead: FormLead) => {
    if (lead.formCompleto) return 'Formulário completo';
    const step = lead.ultimaPerguntaRespondida || 1;
    return `Pergunta ${step} de ${totalQuestions}`;
  };

  const ghlBadgeClass = (status?: string | null) => {
    if (status === 'synced') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  const getLeadFieldValue = (lead: FormLead, fieldId: string) => {
    const direct = (lead as any)?.[fieldId];
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
      return String(direct);
    }
    return lead.customAnswers?.[fieldId] || '';
  };

  const getAnswerForQuestion = (lead: FormLead, question: FormQuestion) => {
    const raw = getLeadFieldValue(lead, question.id);
    if (!raw) return '';
    if (question.type === 'select' && question.options) {
      const match = question.options.find(o => o.value === raw || o.label === raw);
      return match?.label || raw;
    }
    return raw;
  };

  const getConditionalAnswer = (lead: FormLead, question: FormQuestion) => {
    if (!question.conditionalField) return '';
    const trigger = getLeadFieldValue(lead, question.id);
    if (trigger !== question.conditionalField.showWhen) return '';
    return getLeadFieldValue(lead, question.conditionalField.id);
  };

  const extraCustomAnswers = useMemo(() => {
    if (!selectedLead) return [];
    const knownIds = new Set(questionsForDisplay.map(q => q.id));
    return Object.entries(selectedLead.customAnswers || {}).filter(([id]) => !knownIds.has(id));
  }, [questionsForDisplay, selectedLead]);

  const DetailItem = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="p-3 rounded-lg border bg-muted/40">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground break-words">{value || '—'}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Leads do Formulário</p>
          <h1 className="text-2xl font-bold">Acompanhamento de qualificações</h1>
          <p className="text-muted-foreground">Veja quem iniciou o formulário, onde parou e atualize o status rapidamente.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/form-leads'] })}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Sheet open={isFormEditorOpen} onOpenChange={setIsFormEditorOpen}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Pencil className="w-4 h-4 mr-2" />
                Editar Formulário
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Editor de Formulário</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <FormEditorContent />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <p className="text-xs text-muted-foreground">Quentes</p>
          <p className="text-2xl font-bold text-green-600">{stats.hot}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <p className="text-xs text-muted-foreground">Mornos</p>
          <p className="text-2xl font-bold text-amber-600">{stats.warm}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <p className="text-xs text-muted-foreground">Frios</p>
          <p className="text-2xl font-bold text-blue-600">{stats.cold}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <p className="text-xs text-muted-foreground">Abandonos</p>
          <p className="text-2xl font-bold text-rose-600">{stats.inProgress}</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <Input
              placeholder="Buscar por nome, email ou telefone"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full sm:w-64"
            />
            <Select
              value={filters.classification}
              onValueChange={(value) => setFilters(prev => ({ ...prev, classification: value as LeadClassification | 'all' }))}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Classificação" />
              </SelectTrigger>
              <SelectContent>
                {classificationOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value as LeadStatus | 'all' }))}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.completion}
              onValueChange={(value) => setFilters(prev => ({ ...prev, completion: value as 'all' | 'complete' | 'incomplete' }))}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Conclusão" />
              </SelectTrigger>
              <SelectContent>
                {completionOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contato</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Classificação</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Última etapa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atualizado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    Carregando leads...
                  </td>
                </tr>
              )}
              {!isLoading && (!leads || leads.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum lead encontrado ainda.
                  </td>
                </tr>
              )}
              {leads?.map(lead => (
                <tr key={lead.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{lead.nome || 'Sem nome'}</div>
                    <div className="text-sm text-muted-foreground">
                      {lead.cidadeEstado || 'Cidade não informada'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-foreground">{lead.email || '—'}</div>
                    <div className="text-xs text-muted-foreground">{lead.telefone || 'Sem telefone'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={clsx("border", classificationBadge(lead.classificacao))}>
                      {lead.classificacao || '—'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-foreground">{questionLabel(lead)}</div>
                    <div className="text-xs text-muted-foreground">
                      {lead.formCompleto ? 'Completo' : 'Em progresso'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={lead.status || 'novo'}
                      onValueChange={(value) => updateLead.mutate({ id: lead.id, status: value as LeadStatus })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.filter(s => s.value !== 'all').map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate((lead.updatedAt as any) || (lead.createdAt as any))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openLeadDialog(lead)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          if (window.confirm('Deletar este lead?')) {
                            deleteLead.mutate(lead.id);
                          }
                        }}
                        disabled={deleteLead.isPending}
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
      </div>

      <Dialog open={isLeadDialogOpen} onOpenChange={setIsLeadDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-hidden">
          {selectedLead ? (
            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
              <DialogHeader>
                <DialogTitle>Detalhes do lead</DialogTitle>
              </DialogHeader>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Lead</p>
                  <h2 className="text-xl font-semibold leading-tight">{selectedLead.nome || 'Sem nome'}</h2>
                  <p className="text-sm text-muted-foreground">{selectedLead.cidadeEstado || 'Cidade não informada'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={clsx("border", classificationBadge(selectedLead.classificacao))}>
                    {selectedLead.classificacao || '—'}
                  </Badge>
                  <Badge variant="outline">{selectedLead.status || 'novo'}</Badge>
                  <Badge variant="secondary">{questionLabel(selectedLead)}</Badge>
                  {selectedLead.ghlSyncStatus && (
                    <Badge className={clsx("border", ghlBadgeClass(selectedLead.ghlSyncStatus))}>
                      GHL: {selectedLead.ghlSyncStatus}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <DetailItem label="Email" value={selectedLead.email || '—'} />
                <DetailItem label="Telefone" value={selectedLead.telefone || '—'} />
                <DetailItem label="Cidade/Estado" value={selectedLead.cidadeEstado || '—'} />
                <DetailItem label="Tipo de negócio" value={selectedLead.tipoNegocio || '—'} />
                <DetailItem label="Experiência em marketing" value={selectedLead.experienciaMarketing || '—'} />
                <DetailItem label="Orçamento em anúncios" value={selectedLead.orcamentoAnuncios || '—'} />
                <DetailItem label="Principal desafio" value={selectedLead.principalDesafio || '—'} />
                <DetailItem label="Disponibilidade" value={selectedLead.disponibilidade || '—'} />
                <DetailItem label="Expectativa de resultado" value={selectedLead.expectativaResultado || '—'} />
                <DetailItem label="Score total" value={selectedLead.scoreTotal ?? '—'} />
                <DetailItem label="Classificação" value={selectedLead.classificacao || '—'} />
                <DetailItem label="Última atualização" value={formatDate((selectedLead.updatedAt as any) || (selectedLead.createdAt as any))} />
              </div>

              {selectedLead.observacoes && (
                <div className="p-3 rounded-lg border bg-muted/40">
                  <p className="text-xs uppercase text-muted-foreground">Observações</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedLead.observacoes}</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base">Respostas do formulário</h3>
                  <span className="text-xs text-muted-foreground">{questionsForDisplay.length} perguntas</span>
                </div>
                {questionsForDisplay.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma pergunta configurada.</p>
                ) : (
                  <div className="divide-y divide-border rounded-lg border bg-card">
                    {questionsForDisplay.map((question) => {
                      const answer = getAnswerForQuestion(selectedLead, question);
                      const conditionalAnswer = getConditionalAnswer(selectedLead, question);
                      return (
                        <div key={question.id} className="p-3">
                          <p className="text-xs uppercase text-muted-foreground mb-1">{question.id}</p>
                          <p className="font-semibold text-sm text-foreground">{question.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{answer || '—'}</p>
                          {conditionalAnswer && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {(question.conditionalField?.title || 'Detalhe')}: <span className="text-foreground">{conditionalAnswer}</span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {extraCustomAnswers.map(([fieldId, value]) => (
                      <div key={fieldId} className="p-3">
                        <p className="text-xs uppercase text-muted-foreground mb-1">{fieldId}</p>
                        <p className="text-sm text-muted-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Selecione um lead para ver detalhes.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// FORM EDITOR CONTENT (used in Sheet)
// ============================================

function FormEditorContent() {
  const { toast } = useToast();
  const [editingQuestion, setEditingQuestion] = useState<FormQuestion | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isThresholdsOpen, setIsThresholdsOpen] = useState(false);

  const { data: formConfig, isLoading } = useQuery<FormConfig>({
    queryKey: ['/api/form-config'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/form-config');
      return res.json();
    }
  });

  const [config, setConfig] = useState<FormConfig>(formConfig || DEFAULT_FORM_CONFIG);

  useEffect(() => {
    setConfig(formConfig || DEFAULT_FORM_CONFIG);
  }, [formConfig]);

  const sortedQuestions = getSortedQuestions(config);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const saveConfig = useMutation({
    mutationFn: async (newConfig: FormConfig) => {
      const res = await apiRequest('PUT', '/api/form-config', newConfig);
      return res.json();
    },
    onSuccess: (data: FormConfig) => {
      setConfig(data);
      queryClient.invalidateQueries({ queryKey: ['/api/form-config'] });
      toast({ title: 'Configuração salva com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar configuração', description: error.message, variant: 'destructive' });
    }
  });

  const handleSaveQuestion = (question: FormQuestion) => {
    const existingIndex = config.questions.findIndex(q => q.id === question.id);
    let newQuestions: FormQuestion[];

    if (existingIndex >= 0) {
      newQuestions = config.questions.map(q => q.id === question.id ? question : q);
    } else {
      newQuestions = [...config.questions, question];
    }

    // Recalculate order
    newQuestions = newQuestions
      .sort((a, b) => a.order - b.order)
      .map((q, i) => ({ ...q, order: i + 1 }));

    const newConfig: FormConfig = {
      ...config,
      questions: newQuestions,
      maxScore: calculateMaxScore({ ...config, questions: newQuestions }),
    };

    setConfig(newConfig);
    saveConfig.mutate(newConfig);
    setIsDialogOpen(false);
    setEditingQuestion(null);
  };

  const handleDeleteQuestion = (questionId: string) => {
    const newQuestions = config.questions
      .filter(q => q.id !== questionId)
      .sort((a, b) => a.order - b.order)
      .map((q, i) => ({ ...q, order: i + 1 }));

    const newConfig: FormConfig = {
      ...config,
      questions: newQuestions,
      maxScore: calculateMaxScore({ ...config, questions: newQuestions }),
    };

    setConfig(newConfig);
    saveConfig.mutate(newConfig);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedQuestions.findIndex(q => q.id === active.id);
      const newIndex = sortedQuestions.findIndex(q => q.id === over.id);

      const reordered = arrayMove(sortedQuestions, oldIndex, newIndex);
      const newQuestions = reordered.map((q, i) => ({ ...q, order: i + 1 }));

      const newConfig: FormConfig = {
        ...config,
        questions: newQuestions,
        maxScore: calculateMaxScore({ ...config, questions: newQuestions }),
      };

      setConfig(newConfig);
      saveConfig.mutate(newConfig);
    }
  };

  const handleSaveThresholds = (thresholds: FormConfig['thresholds']) => {
    const newConfig: FormConfig = {
      ...config,
      thresholds,
    };
    setConfig(newConfig);
    saveConfig.mutate(newConfig);
    setIsThresholdsOpen(false);
  };

  const getQuestionTypeBadge = (type: FormQuestion['type']) => {
    const labels = { text: 'Texto', email: 'Email', tel: 'Telefone', select: 'Múltipla escolha' };
    return labels[type] || type;
  };

  const getQuestionMaxPoints = (question: FormQuestion) => {
    if (question.type !== 'select' || !question.options) return 0;
    return Math.max(...question.options.map(o => o.points));
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingQuestion(null); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Nova Pergunta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <QuestionForm
              question={editingQuestion}
              onSave={handleSaveQuestion}
              isLoading={saveConfig.isPending}
              nextOrder={sortedQuestions.length + 1}
              existingIds={config.questions.map(q => q.id)}
            />
          </DialogContent>
        </Dialog>
        <Dialog open={isThresholdsOpen} onOpenChange={setIsThresholdsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Star className="w-4 h-4 mr-2" />
              Limites
            </Button>
          </DialogTrigger>
          <DialogContent>
            <ThresholdsForm
              thresholds={config.thresholds}
              onSave={handleSaveThresholds}
              isLoading={saveConfig.isPending}
            />
          </DialogContent>
        </Dialog>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded ml-auto">
          Score máx: {config.maxScore}
        </span>
      </div>

      {/* Thresholds info */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
          <p className="text-xs text-green-600 dark:text-green-400 font-semibold">QUENTE</p>
          <p className="text-lg font-bold text-green-700 dark:text-green-300">≥ {config.thresholds.hot} pts</p>
        </div>
        <div className="p-3 rounded-xl border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">MORNO</p>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">≥ {config.thresholds.warm} pts</p>
        </div>
        <div className="p-3 rounded-xl border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">FRIO</p>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">≥ {config.thresholds.cold} pts</p>
        </div>
        <div className="p-3 rounded-xl border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">DESQUALIFICADO</p>
          <p className="text-lg font-bold text-slate-600 dark:text-slate-300">&lt; {config.thresholds.cold} pts</p>
        </div>
      </div>

      {/* Questions list */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50">
          <p className="text-sm font-semibold text-muted-foreground">{sortedQuestions.length} perguntas</p>
        </div>

        {sortedQuestions.length === 0 ? (
          <div className="p-12 text-center">
            <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhuma pergunta</h3>
            <p className="text-muted-foreground mb-4">Adicione perguntas ao formulário de qualificação</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortedQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-border">
                {sortedQuestions.map((question) => (
                  <SortableQuestionItem
                    key={question.id}
                    question={question}
                    onEdit={(q) => { setEditingQuestion(q); setIsDialogOpen(true); }}
                    onDelete={(id) => {
                      if (window.confirm('Tem certeza que deseja excluir esta pergunta?')) {
                        handleDeleteQuestion(id);
                      }
                    }}
                    typeBadge={getQuestionTypeBadge(question.type)}
                    maxPoints={getQuestionMaxPoints(question)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function SortableQuestionItem({
  question,
  onEdit,
  onDelete,
  typeBadge,
  maxPoints
}: {
  question: FormQuestion;
  onEdit: (q: FormQuestion) => void;
  onDelete: (id: string) => void;
  typeBadge: string;
  maxPoints: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-1 text-muted-foreground hover:text-foreground">
          <GripVertical className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{question.order}</span>
            <Badge variant="outline" className="text-xs">{typeBadge}</Badge>
            {maxPoints > 0 && (
              <Badge variant="secondary" className="text-xs">{maxPoints} pts max</Badge>
            )}
            {question.required && (
              <Badge variant="default" className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Obrigatória</Badge>
            )}
          </div>
          <h3 className="font-semibold text-foreground truncate">{question.title}</h3>
          {question.type === 'select' && question.options && (
            <p className="text-xs text-muted-foreground mt-1">
              {question.options.length} opções: {question.options.slice(0, 3).map(o => o.label).join(', ')}{question.options.length > 3 ? '...' : ''}
            </p>
          )}
          {question.placeholder && question.type !== 'select' && (
            <p className="text-xs text-muted-foreground mt-1">Placeholder: {question.placeholder}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(question)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir pergunta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. A pergunta será removida do formulário.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(question.id)} className="bg-red-600 hover:bg-red-700">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function ThresholdsForm({
  thresholds,
  onSave,
  isLoading
}: {
  thresholds: FormConfig['thresholds'];
  onSave: (t: FormConfig['thresholds']) => void;
  isLoading: boolean;
}) {
  const [hot, setHot] = useState(thresholds.hot);
  const [warm, setWarm] = useState(thresholds.warm);
  const [cold, setCold] = useState(thresholds.cold);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ hot, warm, cold });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Limites de Classificação</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground">
          Defina os pontos mínimos para cada classificação de lead.
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Label className="w-32 text-green-600">QUENTE (≥)</Label>
            <Input type="number" value={hot} onChange={(e) => setHot(Number(e.target.value))} min={0} className="w-24" />
            <span className="text-sm text-muted-foreground">pontos</span>
          </div>
          <div className="flex items-center gap-4">
            <Label className="w-32 text-amber-600">MORNO (≥)</Label>
            <Input type="number" value={warm} onChange={(e) => setWarm(Number(e.target.value))} min={0} className="w-24" />
            <span className="text-sm text-muted-foreground">pontos</span>
          </div>
          <div className="flex items-center gap-4">
            <Label className="w-32 text-blue-600">FRIO (≥)</Label>
            <Input type="number" value={cold} onChange={(e) => setCold(Number(e.target.value))} min={0} className="w-24" />
            <span className="text-sm text-muted-foreground">pontos</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leads com score abaixo de {cold} são classificados como DESQUALIFICADO.
        </p>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancelar</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}

function QuestionForm({
  question,
  onSave,
  isLoading,
  nextOrder,
  existingIds,
}: {
  question: FormQuestion | null;
  onSave: (q: FormQuestion) => void;
  isLoading: boolean;
  nextOrder: number;
  existingIds: string[];
}) {
  const [id, setId] = useState(question?.id || '');
  const [title, setTitle] = useState(question?.title || '');
  const [type, setType] = useState<FormQuestion['type']>(question?.type || 'text');
  const [required, setRequired] = useState(question?.required ?? true);
  const [placeholder, setPlaceholder] = useState(question?.placeholder || '');
  const [order, setOrder] = useState(question?.order ?? nextOrder);
  const [options, setOptions] = useState<FormOption[]>(question?.options || []);
  const [hasConditional, setHasConditional] = useState(!!question?.conditionalField);
  const [conditionalShowWhen, setConditionalShowWhen] = useState(question?.conditionalField?.showWhen || '');
  const [conditionalId, setConditionalId] = useState(question?.conditionalField?.id || '');
  const [conditionalTitle, setConditionalTitle] = useState(question?.conditionalField?.title || '');
  const [conditionalPlaceholder, setConditionalPlaceholder] = useState(question?.conditionalField?.placeholder || '');

  useEffect(() => {
    setId(question?.id || '');
    setTitle(question?.title || '');
    setType(question?.type || 'text');
    setRequired(question?.required ?? true);
    setPlaceholder(question?.placeholder || '');
    setOrder(question?.order ?? nextOrder);
    setOptions(question?.options || []);
    setHasConditional(!!question?.conditionalField);
    setConditionalShowWhen(question?.conditionalField?.showWhen || '');
    setConditionalId(question?.conditionalField?.id || '');
    setConditionalTitle(question?.conditionalField?.title || '');
    setConditionalPlaceholder(question?.conditionalField?.placeholder || '');
  }, [question, nextOrder]);

  const isEditing = !!question;
  const idError = !isEditing && existingIds.includes(id) ? 'Este ID já está em uso' : '';

  const handleAddOption = () => {
    setOptions([...options, { value: '', label: '', points: 0 }]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, field: keyof FormOption, value: string | number) => {
    const newOptions = [...options];
    if (field === 'points') {
      newOptions[index] = { ...newOptions[index], [field]: Number(value) };
    } else {
      newOptions[index] = { ...newOptions[index], [field]: value };
      // Auto-fill value if label is being set and value is empty
      if (field === 'label' && !newOptions[index].value) {
        newOptions[index].value = value as string;
      }
    }
    setOptions(newOptions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !title) return;
    if (idError) return;

    const questionData: FormQuestion = {
      id,
      order,
      title,
      type,
      required,
      placeholder: placeholder || undefined,
      options: type === 'select' ? options.filter(o => o.label && o.value) : undefined,
      conditionalField: hasConditional && conditionalId && conditionalShowWhen ? {
        showWhen: conditionalShowWhen,
        id: conditionalId,
        title: conditionalTitle,
        placeholder: conditionalPlaceholder,
      } : undefined,
    };

    onSave(questionData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar Pergunta' : 'Nova Pergunta'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="question-id">ID (único)</Label>
            <Input
              id="question-id"
              value={id}
              onChange={(e) => setId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="ex: minhaPergunta"
              disabled={isEditing}
              required
            />
            {idError && <p className="text-xs text-red-500">{idError}</p>}
            <p className="text-xs text-muted-foreground">Use apenas letras, números e _</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="question-order">Ordem</Label>
            <Input
              id="question-order"
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
              min={1}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="question-title">Texto da Pergunta</Label>
          <Textarea
            id="question-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Qual é o seu nome completo?"
            required
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de Resposta</Label>
            <Select value={type} onValueChange={(v) => setType(v as FormQuestion['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto livre</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="tel">Telefone</SelectItem>
                <SelectItem value="select">Múltipla escolha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="question-placeholder">Placeholder</Label>
            <Input
              id="question-placeholder"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="Texto de ajuda"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="question-required" checked={required} onCheckedChange={(c) => setRequired(!!c)} />
          <Label htmlFor="question-required" className="text-sm">Pergunta obrigatória</Label>
        </div>

        {type === 'select' && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Opções de Resposta</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddOption}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
            {options.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma opção. Clique em "Adicionar" para criar.</p>
            )}
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-background rounded border">
                  <Input
                    value={option.label}
                    onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
                    placeholder="Label (texto visível)"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={option.points}
                    onChange={(e) => handleOptionChange(index, 'points', e.target.value)}
                    placeholder="Pts"
                    className="w-20"
                    min={0}
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveOption(index)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Conditional field */}
            <div className="pt-3 border-t">
              <div className="flex items-center gap-2 mb-3">
                <Checkbox id="has-conditional" checked={hasConditional} onCheckedChange={(c) => setHasConditional(!!c)} />
                <Label htmlFor="has-conditional" className="text-sm">Adicionar campo condicional</Label>
              </div>
              {hasConditional && (
                <div className="space-y-3 pl-6">
                  <div className="space-y-2">
                    <Label className="text-xs">Mostrar quando selecionado:</Label>
                    <Select value={conditionalShowWhen} onValueChange={setConditionalShowWhen}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma opção" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.filter(o => o.value).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label || opt.value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={conditionalId}
                      onChange={(e) => setConditionalId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="ID do campo"
                    />
                    <Input
                      value={conditionalPlaceholder}
                      onChange={(e) => setConditionalPlaceholder(e.target.value)}
                      placeholder="Placeholder"
                    />
                  </div>
                  <Input
                    value={conditionalTitle}
                    onChange={(e) => setConditionalTitle(e.target.value)}
                    placeholder="Título do campo condicional"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancelar</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading || !!idError}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditing ? 'Atualizar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ============================================
// BOOKINGS SECTION
// ============================================

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
        <Badge variant="secondary" className="text-lg px-4 py-2 border-0 bg-muted dark:text-white">
          {bookings?.length || 0} Total
        </Badge>
      </div>

      {bookings?.length === 0 ? (
        <div className="p-12 text-center rounded-lg bg-card border border-border">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No bookings yet</h3>
          <p className="text-muted-foreground">Bookings will appear here when customers make them</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="hidden md:block bg-muted rounded-lg overflow-hidden transition-all">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 dark:bg-slate-700/50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
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
                <tbody className="bg-card/70 dark:bg-slate-800/70 divide-y divide-gray-200/70 dark:divide-slate-600/40">
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
      className="p-3 rounded-lg bg-muted transition-all group relative"
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
            <h3 className="font-semibold text-base line-clamp-1">{faq.question}</h3>
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
                  variant="destructive"
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
        <div className="p-12 text-center bg-card rounded-lg">
          <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
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
  avgResponseTime?: string;
  calendarProvider?: string;
  calendarId?: string;
  calendarStaff?: { name: string; calendarId: string }[];
  languageSelectorEnabled?: boolean;
  defaultLanguage?: string;
  lowPerformanceSmsEnabled?: boolean;
  lowPerformanceThresholdSeconds?: number;
  intakeObjectives?: IntakeObjective[];
  excludedUrlRules: UrlRule[];
  useKnowledgeBase?: boolean;
  useFaqs?: boolean;
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
    avgResponseTime: '',
    calendarProvider: 'gohighlevel',
    calendarId: '',
    calendarStaff: [],
    languageSelectorEnabled: false,
    defaultLanguage: 'en',
    lowPerformanceSmsEnabled: false,
    lowPerformanceThresholdSeconds: 300,
    intakeObjectives: [],
    excludedUrlRules: [],
    useKnowledgeBase: true,
    useFaqs: true,
  });
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [kbDriveLink, setKbDriveLink] = useState('');
  const [isKbUploading, setIsKbUploading] = useState(false);
  const objectivesSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const kbFileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [kbSelectedCategoryId, setKbSelectedCategoryId] = useState<number | null>(null);
  const [isKbCategoryDialogOpen, setIsKbCategoryDialogOpen] = useState(false);
  const [isKbDocumentDialogOpen, setIsKbDocumentDialogOpen] = useState(false);
  const [kbCategoryFormData, setKbCategoryFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon: 'BookOpen',
    order: 0,
  });
  const [kbDocumentFormData, setKbDocumentFormData] = useState({
    categoryId: 0,
    title: '',
    content: '',
    order: 0,
    isActive: true,
  });

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

QUALIFICATION GUARDRAILS:
- Ask only for the minimum info needed to identify the correct service (type + size/room). One question at a time.
- If the user already gave the detail, do NOT ask again. Move to the next missing item.
- Never ask for address, email, or phone until they agree to book.
- If they mention multiple services, pick the primary one and confirm in one sentence.
- If the request is unclear, ask a single clarifying question then proceed.

NATURAL INFO COLLECTION:
- After they agree to book, collect info smoothly:
  "Great! What's your name?" → "Email?" → "Phone?" → "Full address?"
- Use update_contact immediately when you get name/email/phone
- Keep it fast - one question per message
- Intake flow order is mandatory: only ask the next missing item from the configured intake objectives.
- Never skip ahead or reorder intake questions. If the user already provided an item, mark it as done and move to the next.

BOOKING FLOW:
- Confirm timezone (America/New_York)
- Use get_availability with service_id
- Show 3-5 slots within 14 days
- After they pick a time and provide address, create booking immediately
- Don't ask "are you sure?" - just confirm after booking is done
- Booking must be completed inside chat using create_booking once all required fields are collected.
- Required fields for create_booking: service_id(s), booking_date, start_time, customer_name, customer_email, customer_phone, customer_address.
- If availability changes, propose the next 3-5 slots and continue.

SOURCES:
- Knowledge base is enabled. Use search_knowledge_base for company-specific policies, prep instructions, service coverage, and internal knowledge.
- FAQs are enabled. If the knowledge base has no relevant info, use search_faqs for general policies, process, products, guarantees, cancellation, payment methods, and common questions.

TOOLS:
- list_services: As soon as you know what they need
- get_service_details: If they ask about a specific service
- get_availability: With service_id after they agree to book
- update_contact: When you get name/email/phone
- create_booking: After slot selection and all required info collected
- get_business_policies: Check minimums only if needed
- search_knowledge_base: Use for company-specific policies, prep instructions, service coverage, or internal knowledge.
- search_faqs: Use when customer asks about general policies, process, products, guarantees, cancellation, payment methods, or common questions.

RULES:
- Never guess prices/availability
- Never invent slots
- Keep responses 1-2 sentences max
- Use markdown for emphasis: **bold** for prices and service names
- Complete bookings in chat
- When asked about policies, products, process, or general questions, ALWAYS use search_knowledge_base first before answering (if enabled).
- If no relevant knowledge base docs are found and FAQs are enabled, use search_faqs next.
- If a knowledge base doc or FAQ provides the answer, use it. Never make up policy information.
- If knowledge base or FAQs are disabled in settings, do not call those tools.
- If a source is enabled in the chat settings, you MUST use it to answer relevant questions by reading its content first.
- If GoHighLevel is enabled, contacts and appointments must be created; if any tool returns an error, ask the user to retry.
- Be direct: lead with the answer and avoid filler phrases.

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

  const { data: responseTimeData, isLoading: responseTimeLoading } = useQuery<{
    averageSeconds: number;
    formatted: string;
    samples: number;
  }>({
    queryKey: ['/api/chat/response-time'],
    queryFn: async () => {
      const response = await fetch('/api/chat/response-time', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch response time');
      return response.json();
    },
  });

  const { data: kbCategories, isLoading: kbCategoriesLoading } = useQuery({
    queryKey: ['/api/knowledge-base/categories'],
    queryFn: async () => {
      const response = await fetch('/api/knowledge-base/categories');
      if (!response.ok) throw new Error('Failed to fetch knowledge base categories');
      return response.json();
    },
  });

  const { data: kbArticles, isLoading: kbArticlesLoading } = useQuery({
    queryKey: ['/api/knowledge-base/articles'],
    queryFn: async () => {
      const response = await fetch('/api/knowledge-base/articles');
      if (!response.ok) throw new Error('Failed to fetch knowledge base articles');
      return response.json();
    },
  });

  const { data: kbAssistantLinks, isLoading: kbAssistantLinksLoading } = useQuery({
    queryKey: ['/api/knowledge-base/assistant-links', kbCategories?.map((category: any) => category.id).join(',')],
    enabled: !!kbCategories?.length,
    queryFn: async () => {
      const entries = await Promise.all(
        (kbCategories || []).map(async (category: any) => {
          const response = await fetch(`/api/knowledge-base/categories/${category.id}/link-assistant`);
          if (!response.ok) throw new Error('Failed to fetch assistant link status');
          const { isLinked } = await response.json();
          return [category.id, isLinked] as const;
        })
      );
      return Object.fromEntries(entries) as Record<number, boolean>;
    },
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
        avgResponseTime: settings.avgResponseTime || '',
        calendarProvider: settings.calendarProvider || 'gohighlevel',
        calendarId: settings.calendarId || '',
        calendarStaff: settings.calendarStaff || [],
        languageSelectorEnabled: settings.languageSelectorEnabled ?? false,
        defaultLanguage: settings.defaultLanguage || 'en',
        lowPerformanceSmsEnabled: settings.lowPerformanceSmsEnabled ?? false,
        lowPerformanceThresholdSeconds: settings.lowPerformanceThresholdSeconds ?? 300,
        intakeObjectives: settings.intakeObjectives && settings.intakeObjectives.length > 0
          ? settings.intakeObjectives
          : DEFAULT_CHAT_OBJECTIVES,
        excludedUrlRules: settings.excludedUrlRules || [],
        useKnowledgeBase: settings.useKnowledgeBase ?? true,
        useFaqs: settings.useFaqs ?? true,
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
      avgResponseTime: prev.avgResponseTime || '',
      calendarProvider: prev.calendarProvider || 'gohighlevel',
      calendarId: prev.calendarId || '',
      calendarStaff: prev.calendarStaff || [],
      languageSelectorEnabled: prev.languageSelectorEnabled ?? false,
      defaultLanguage: prev.defaultLanguage || 'en',
      lowPerformanceSmsEnabled: prev.lowPerformanceSmsEnabled ?? false,
      lowPerformanceThresholdSeconds: prev.lowPerformanceThresholdSeconds ?? 300,
      useKnowledgeBase: prev.useKnowledgeBase ?? true,
      useFaqs: prev.useFaqs ?? true,
    }));
  }, [settings, companySettings, defaultSystemPrompt]);

  useEffect(() => {
    if (kbSelectedCategoryId || !kbCategories?.length) return;
    setKbSelectedCategoryId(kbCategories[0].id);
  }, [kbCategories, kbSelectedCategoryId]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const kbArticleCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    (kbArticles || []).forEach((article: any) => {
      counts[article.categoryId] = (counts[article.categoryId] || 0) + 1;
    });
    return counts;
  }, [kbArticles]);

  const visibleKbDocuments = useMemo(() => {
    if (!kbArticles) return [];
    if (!kbSelectedCategoryId) return kbArticles;
    return kbArticles.filter((article: any) => article.categoryId === kbSelectedCategoryId);
  }, [kbArticles, kbSelectedCategoryId]);

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

  const createKbCategoryMutation = useMutation({
    mutationFn: async (data: typeof kbCategoryFormData) => {
      const response = await apiRequest('POST', '/api/knowledge-base/categories', data);
      return response.json();
    },
    onSuccess: (category: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/categories'] });
      setKbSelectedCategoryId(category.id);
      toast({ title: 'Category created' });
      setIsKbCategoryDialogOpen(false);
      setKbCategoryFormData({ name: '', slug: '', description: '', icon: 'BookOpen', order: 0 });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create category', description: error.message, variant: 'destructive' });
    },
  });

  const createKbDocumentMutation = useMutation({
    mutationFn: (data: typeof kbDocumentFormData) => apiRequest('POST', '/api/knowledge-base/articles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/articles'] });
      toast({ title: 'Document added' });
      setIsKbDocumentDialogOpen(false);
      setKbDocumentFormData({ categoryId: kbSelectedCategoryId || 0, title: '', content: '', order: 0, isActive: true });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to add document', description: error.message, variant: 'destructive' });
    },
  });

  const deleteKbCategoryMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/knowledge-base/categories/${id}`),
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/articles'] });
      if (kbSelectedCategoryId === id) {
        setKbSelectedCategoryId(null);
      }
      toast({ title: 'Category deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete category', description: error.message, variant: 'destructive' });
    },
  });

  const deleteKbDocumentMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/knowledge-base/articles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/articles'] });
      toast({ title: 'Document deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete document', description: error.message, variant: 'destructive' });
    },
  });

  const toggleKbAssistantLinkMutation = useMutation({
    mutationFn: ({ categoryId, isLinked }: { categoryId: number; isLinked: boolean }) =>
      apiRequest('POST', `/api/knowledge-base/categories/${categoryId}/link-assistant`, { isLinked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/assistant-links'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update chat link', description: error.message, variant: 'destructive' });
    },
  });

  const generateKbSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleKbCategoryNameChange = (value: string) => {
    setKbCategoryFormData((prev) => ({
      ...prev,
      name: value,
      slug: prev.slug || generateKbSlug(value),
    }));
  };

  const openKbDocumentDialog = () => {
    if (!kbCategories?.length) {
      toast({ title: 'Create a category first', description: 'Add a category before adding documents.', variant: 'destructive' });
      return;
    }
    const fallbackCategoryId = kbSelectedCategoryId || kbCategories[0].id;
    setKbDocumentFormData((prev) => ({ ...prev, categoryId: fallbackCategoryId }));
    setIsKbDocumentDialogOpen(true);
  };

  const addCalendarStaff = () => {
    const next = [...(settingsDraft.calendarStaff || []), { name: '', calendarId: '' }];
    updateField('calendarStaff', next);
  };

  const updateCalendarStaff = (index: number, field: 'name' | 'calendarId', value: string) => {
    const next = [...(settingsDraft.calendarStaff || [])];
    next[index] = { ...next[index], [field]: value };
    updateField('calendarStaff', next);
  };

  const removeCalendarStaff = (index: number) => {
    const next = (settingsDraft.calendarStaff || []).filter((_, i) => i !== index);
    updateField('calendarStaff', next);
  };

  const handleKbFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsKbUploading(true);
    try {
      const isTextFile = file.type.startsWith('text/')
        || /\.(md|txt|csv|json)$/i.test(file.name);

      if (isTextFile) {
        const text = await file.text();
        const snippet = `# Source: ${file.name}\n${text}`;
        setKbDocumentFormData(prev => ({
          ...prev,
          content: prev.content ? `${prev.content}\n\n${snippet}` : snippet,
        }));
        toast({ title: 'File imported', description: `${file.name} added to the document.` });
      } else {
        const uploadRes = await apiRequest('POST', '/api/upload');
        const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

        await fetch(uploadURL, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });

        const linkLine = `Attachment: ${objectPath}`;
        setKbDocumentFormData(prev => ({
          ...prev,
          content: prev.content ? `${prev.content}\n\n${linkLine}` : linkLine,
        }));
        toast({ title: 'File attached', description: `${file.name} uploaded.` });
      }
    } catch (error: any) {
      toast({ title: 'Attachment failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsKbUploading(false);
      if (kbFileInputRef.current) {
        kbFileInputRef.current.value = '';
      }
    }
  };

  const attachKbDriveLink = () => {
    const link = kbDriveLink.trim();
    if (!link) {
      toast({ title: 'Add a Drive link first', variant: 'destructive' });
      return;
    }
    const line = `Drive link: ${link}`;
    setKbDocumentFormData(prev => ({
      ...prev,
      content: prev.content ? `${prev.content}\n\n${line}` : line,
    }));
    setKbDriveLink('');
    toast({ title: 'Drive link attached' });
  };

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
    const label = status === 'closed' ? 'Archived' : status === 'open' ? 'Open' : status;
    const badgeClass = status === 'open'
      ? 'bg-blue-500/10 text-blue-200 border border-blue-400/50 rounded-full px-3 py-1 text-xs font-semibold'
      : 'bg-slate-700/40 text-slate-300 border border-slate-500/50 rounded-full px-3 py-1 text-xs font-semibold';
    return <span className={badgeClass}>{label}</span>;
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
  const totalConversations = visibleConversations.length;
  const totalPages = Math.max(1, Math.ceil(totalConversations / pageSize));
  const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
  const paginatedConversations = useMemo(() => {
    const start = clampedPageIndex * pageSize;
    return visibleConversations.slice(start, start + pageSize);
  }, [visibleConversations, clampedPageIndex, pageSize]);

  useEffect(() => {
    setPageIndex(0);
  }, [statusFilter, pageSize]);

  useEffect(() => {
    if (pageIndex !== clampedPageIndex) {
      setPageIndex(clampedPageIndex);
    }
  }, [pageIndex, clampedPageIndex]);

  useEffect(() => {
    if (messages.length > 0 && !isMessagesLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, isMessagesLoading]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Chat</h1>
        <p className="text-muted-foreground">Prioritize conversations, then open the settings drawer when needed.</p>
      </div>

      <Card className="shadow-sm border-0 bg-muted dark:bg-slate-800/70">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Conversations</CardTitle>
            <p className="text-sm text-muted-foreground">Review and respond first, then open the settings submenu if needed.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val as 'open' | 'closed' | 'all')}
              >
                <SelectTrigger className="w-[120px] h-9 bg-card/70 border border-border/60 shadow-none focus-visible:ring-0 text-sm">
                  <SelectValue />
                </SelectTrigger>
              <SelectContent className="border-0 shadow-none bg-card text-foreground">
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Archived</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
              </Select>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 min-w-[110px] border-0 bg-slate-200 hover:bg-slate-300 text-slate-950 font-semibold dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100"
              onClick={() => refetchConversations()}
              disabled={loadingConversations}
            >
              {loadingConversations ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
            </Button>
            <div className="h-9 min-w-[110px] flex items-center justify-center bg-[#FFFF01] text-black font-bold rounded-md px-4 text-sm">
              {paginatedConversations.length} shown
            </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 min-w-[72px] rounded-md border border-border/60 bg-card/80 px-3 flex items-center gap-2">
                <p className="text-[11px] text-muted-foreground">Open</p>
                <p className="text-sm font-semibold text-foreground">{openConversations}</p>
              </div>
              <div className="h-9 min-w-[72px] rounded-md border border-border/60 bg-card/80 px-3 flex items-center gap-2">
                <p className="text-[11px] text-muted-foreground">Archived</p>
                <p className="text-sm font-semibold text-foreground">{closedConversations}</p>
              </div>
              <div className="h-9 min-w-[72px] rounded-md border border-border/60 bg-card/80 px-3 flex items-center gap-2">
                <p className="text-[11px] text-muted-foreground">Total</p>
                <p className="text-sm font-semibold text-foreground">{conversations?.length || 0}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingConversations ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : conversations && conversations.length > 0 ? (
            <>
            <div className="overflow-auto rounded-lg bg-muted dark:bg-slate-800/70">
              <table className="w-full text-sm">
                <thead className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Visitor</th>
                    <th className="px-4 py-3 text-left">Source</th>
                    <th className="px-4 py-3 text-left">Last Message</th>
                    <th className="px-4 py-3 text-left">Updated</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-card/70 dark:bg-slate-800/60 divide-y divide-border/60 dark:divide-slate-700/60">
                  {paginatedConversations.map((conv) => (
                    <tr key={conv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
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
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-3">
                      <Button size="sm" variant="ghost" className="min-w-[88px] h-8 justify-center text-sm font-semibold border-0 bg-slate-600 hover:bg-slate-700 text-white dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-white" onClick={() => openConversation(conv)}>
                        View
                      </Button>
                        <div className="flex items-center gap-1">
                          {conv.status === 'open' ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
                                  aria-label="Archive conversation"
                                  data-testid={`button-archive-conversation-${conv.id}`}
                                >
                                  <Archive className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Archive conversation?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This conversation will be moved to archived. You can reopen it later.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => statusMutation.mutate({ id: conv.id, status: 'closed' })}
                                  >
                                    Archive
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
                              onClick={() => statusMutation.mutate({ id: conv.id, status: 'open' })}
                              aria-label="Reopen conversation"
                              data-testid={`button-reopen-conversation-${conv.id}`}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-red-500"
                                data-testid={`button-delete-conversation-${conv.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. All messages in this conversation will be permanently deleted.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(conv.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalConversations > 10 && (
              <div className="mt-3 flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  Page {clampedPageIndex + 1} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                    disabled={clampedPageIndex === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
                    disabled={clampedPageIndex >= totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Rows</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => setPageSize(Number(value) as 10 | 20 | 50)}
                  >
                    <SelectTrigger className="h-8 w-[90px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            </>
          ) : (
            <div className="p-8 text-center bg-card/80 dark:bg-slate-900/70 rounded-lg">
              <p className="text-muted-foreground">
                {conversations && conversations.length > 0
                  ? 'No conversations match this filter.'
                  : 'No conversations yet.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-0 bg-muted dark:bg-slate-800/70">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Knowledge Base for Chat</CardTitle>
            <p className="text-sm text-muted-foreground">Add documents and link categories so the assistant can answer with your content.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsKbCategoryDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Category
            </Button>
            <Button size="sm" onClick={openKbDocumentDialog}>
              <Plus className="w-4 h-4 mr-2" />
              New Document
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={clsx(
                'rounded-full px-2.5 py-1 font-semibold',
                settingsDraft.enabled
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              )}
            >
              Chat {settingsDraft.enabled ? 'enabled' : 'disabled'}
            </span>
            <span className="text-muted-foreground">
              Link categories to make their documents available to the assistant.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/70 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Use knowledge base</p>
                <p className="text-xs text-muted-foreground">Allow the assistant to read linked documents.</p>
              </div>
              <Switch
                checked={settingsDraft.useKnowledgeBase ?? true}
                onCheckedChange={(checked) => updateField('useKnowledgeBase', checked)}
                data-testid="switch-chat-use-knowledge-base"
              />
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/70 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Use FAQs</p>
                <p className="text-xs text-muted-foreground">Allow the assistant to read FAQ content.</p>
              </div>
              <Switch
                checked={settingsDraft.useFaqs ?? true}
                onCheckedChange={(checked) => updateField('useFaqs', checked)}
                data-testid="switch-chat-use-faqs"
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Categories</p>
                <span className="text-xs text-muted-foreground">
                  {kbCategories?.length || 0} total
                </span>
              </div>
              {kbCategoriesLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : kbCategories && kbCategories.length > 0 ? (
                <div className="space-y-2">
                  {kbCategories.map((category: any) => {
                    const isLinked = !!kbAssistantLinks?.[category.id];
                    return (
                      <div
                        key={category.id}
                        className={clsx(
                          'rounded-lg border bg-card/70 px-3 py-3 transition-colors cursor-pointer',
                          kbSelectedCategoryId === category.id && 'border-primary/50 bg-primary/5'
                        )}
                        onClick={() => setKbSelectedCategoryId(category.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">{category.name}</p>
                            {category.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {category.description}
                              </p>
                            )}
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              {kbArticleCounts[category.id] || 0} documents
                            </p>
                          </div>
                          <div className="flex items-center gap-3" onClick={(event) => event.stopPropagation()}>
                            <div className="flex flex-col items-end gap-2">
                              <span className="text-[11px] text-muted-foreground">Use in chat</span>
                              <Switch
                                checked={isLinked}
                                onCheckedChange={(checked) =>
                                  toggleKbAssistantLinkMutation.mutate({ categoryId: category.id, isLinked: checked })
                                }
                                disabled={kbAssistantLinksLoading}
                              />
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={(event) => event.stopPropagation()}
                                  aria-label="Delete category"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(event) => event.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete category?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This removes the category and all documents inside it.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteKbCategoryMutation.mutate(category.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
                  No categories yet. Create one to start adding documents.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Documents</p>
                {kbSelectedCategoryId && (
                  <span className="text-xs text-muted-foreground">
                    {visibleKbDocuments.length} in this category
                  </span>
                )}
              </div>
              {kbArticlesLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : !kbSelectedCategoryId ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
                  Select a category to view its documents.
                </div>
              ) : visibleKbDocuments.length > 0 ? (
                <div className="space-y-3">
                  {visibleKbDocuments.map((doc: any) => (
                    <div key={doc.id} className="rounded-lg border bg-card/70 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{doc.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {doc.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={doc.isActive ? 'default' : 'secondary'}>
                            {doc.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                aria-label="Delete document"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete document?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This document will be permanently removed.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteKbDocumentMutation.mutate(doc.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
                  No documents yet. Add one to power the assistant responses.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isKbCategoryDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsKbCategoryDialogOpen(false);
          setKbCategoryFormData({ name: '', slug: '', description: '', icon: 'BookOpen', order: 0 });
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New Knowledge Base Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="kb-category-name">Name</Label>
              <Input
                id="kb-category-name"
                value={kbCategoryFormData.name}
                onChange={(e) => handleKbCategoryNameChange(e.target.value)}
                placeholder="Policies, Services, Pricing..."
              />
            </div>
            <div>
              <Label htmlFor="kb-category-slug">Slug</Label>
              <Input
                id="kb-category-slug"
                value={kbCategoryFormData.slug}
                onChange={(e) => setKbCategoryFormData((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="policies"
              />
            </div>
            <div>
              <Label htmlFor="kb-category-description">Description</Label>
              <Textarea
                id="kb-category-description"
                value={kbCategoryFormData.description}
                onChange={(e) => setKbCategoryFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Short description for the assistant context."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsKbCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createKbCategoryMutation.mutate(kbCategoryFormData)}
              disabled={!kbCategoryFormData.name.trim() || !kbCategoryFormData.slug.trim()}
            >
              Create Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isKbDocumentDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsKbDocumentDialogOpen(false);
          setKbDocumentFormData({ categoryId: kbSelectedCategoryId || 0, title: '', content: '', order: 0, isActive: true });
          setKbDriveLink('');
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Knowledge Base Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="kb-document-category">Category</Label>
              <Select
                value={String(kbDocumentFormData.categoryId || '')}
                onValueChange={(value) => setKbDocumentFormData((prev) => ({ ...prev, categoryId: Number(value) }))}
              >
                <SelectTrigger id="kb-document-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {kbCategories?.map((category: any) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="kb-document-title">Title</Label>
              <Input
                id="kb-document-title"
                value={kbDocumentFormData.title}
                onChange={(e) => setKbDocumentFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Cancellation policy, Service areas..."
              />
            </div>
            <div>
              <Label htmlFor="kb-document-content">Content</Label>
              <Textarea
                id="kb-document-content"
                value={kbDocumentFormData.content}
                onChange={(e) => setKbDocumentFormData((prev) => ({ ...prev, content: e.target.value }))}
                rows={8}
                placeholder="Write the content the assistant should reference."
              />
            </div>
            <div className="space-y-2">
              <Label>Attachments</Label>
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <Input
                  value={kbDriveLink}
                  onChange={(e) => setKbDriveLink(e.target.value)}
                  placeholder="Paste Google Drive link"
                />
                <Button type="button" variant="outline" onClick={attachKbDriveLink}>
                  Attach link
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={kbFileInputRef}
                  type="file"
                  accept=".txt,.md,.csv,.json,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleKbFileAttach}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => kbFileInputRef.current?.click()}
                  disabled={isKbUploading}
                >
                  {isKbUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Uploading...
                    </>
                  ) : (
                    'Upload file'
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Text files are imported into the document. Other files are attached as links.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div>
                <Label htmlFor="kb-document-order">Order</Label>
                <Input
                  id="kb-document-order"
                  type="number"
                  value={kbDocumentFormData.order}
                  onChange={(e) => setKbDocumentFormData((prev) => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="kb-document-active"
                  checked={kbDocumentFormData.isActive}
                  onCheckedChange={(checked) => setKbDocumentFormData((prev) => ({ ...prev, isActive: checked as boolean }))}
                />
                <Label htmlFor="kb-document-active">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsKbDocumentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createKbDocumentMutation.mutate(kbDocumentFormData)}
              disabled={!kbDocumentFormData.title.trim() || !kbDocumentFormData.content.trim() || !kbDocumentFormData.categoryId}
            >
              Add Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="shadow-sm border-0 bg-muted dark:bg-slate-800/70">
        <CardHeader>
          <CardTitle>Calendars & Staff</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure which calendar the chat should use for availability and bookings.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="chat-calendar-provider">Calendar provider</Label>
              <Select
                value={settingsDraft.calendarProvider || 'gohighlevel'}
                onValueChange={(value) => updateField('calendarProvider', value)}
              >
                <SelectTrigger id="chat-calendar-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gohighlevel">GoHighLevel</SelectItem>
                  <SelectItem value="google">Google Calendar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chat-calendar-id">Calendar ID</Label>
              <Input
                id="chat-calendar-id"
                value={settingsDraft.calendarId || ''}
                onChange={(e) => updateField('calendarId', e.target.value)}
                placeholder="Primary calendar ID"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Staff calendars</Label>
              <Button type="button" variant="outline" size="sm" onClick={addCalendarStaff}>
                <Plus className="w-4 h-4 mr-1" /> Add staff
              </Button>
            </div>
            {(settingsDraft.calendarStaff || []).length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
                No staff calendars yet. Add one if you want to route bookings by staff.
              </div>
            ) : (
              <div className="space-y-2">
                {(settingsDraft.calendarStaff || []).map((staff, index) => (
                  <div key={`${staff.name}-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto] items-center">
                    <Input
                      value={staff.name}
                      onChange={(e) => updateCalendarStaff(index, 'name', e.target.value)}
                      placeholder="Staff name"
                    />
                    <Input
                      value={staff.calendarId}
                      onChange={(e) => updateCalendarStaff(index, 'calendarId', e.target.value)}
                      placeholder="Staff calendar ID"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-foreground"
                      onClick={() => removeCalendarStaff(index)}
                      aria-label="Remove staff calendar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Staff calendars are stored for routing; booking logic can use them when enabled.
            </p>
          </div>
        </CardContent>
      </Card>

      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen} className="rounded-xl bg-card/80 dark:bg-slate-900/70 shadow-none border border-border/70 dark:border-slate-800/70">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="font-semibold text-base">Widget & assistant settings</p>
            <p className="text-xs text-muted-foreground">Open only when you need to tweak the assistant.</p>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              {settingsOpen ? 'Hide' : 'Show'} settings
              <ChevronDown className={clsx('w-4 h-4 transition-transform', settingsOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="p-4 border-t border-border/70 dark:border-slate-800/70 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Card className="border-0 bg-muted dark:bg-slate-800/60 shadow-none">
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
                <div className="space-y-3 bg-card rounded-lg border border-border/70 dark:bg-slate-900/80 dark:border-slate-800/70 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-white/80 dark:bg-slate-800 flex items-center justify-center border border-border/60 dark:border-slate-700/60">
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avg-response-time">Average response time</Label>
                  <div className="flex items-center justify-between rounded-md border border-border/70 bg-card px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">
                        {responseTimeLoading ? 'Calculating...' : responseTimeData?.formatted || 'No responses yet'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {responseTimeData?.samples ? `${responseTimeData.samples} reply samples` : 'Based on chat history'}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">Auto</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card/70 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Low performance SMS alert</p>
                      <p className="text-xs text-muted-foreground">Send Twilio SMS when response time is too high.</p>
                    </div>
                    <Switch
                      checked={settingsDraft.lowPerformanceSmsEnabled ?? false}
                      onCheckedChange={(checked) => updateField('lowPerformanceSmsEnabled', checked)}
                      data-testid="switch-chat-low-performance-sms"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="low-performance-threshold">Alert threshold (seconds)</Label>
                    <Input
                      id="low-performance-threshold"
                      type="number"
                      min="30"
                      step="30"
                      value={settingsDraft.lowPerformanceThresholdSeconds ?? 300}
                      onChange={(e) => updateField('lowPerformanceThresholdSeconds', Number(e.target.value) || 300)}
                    />
                    <p className="text-xs text-muted-foreground">Alert triggers when average response exceeds this.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card/70 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Language selector</p>
                      <p className="text-xs text-muted-foreground">Allow visitors to choose the chat language.</p>
                    </div>
                    <Switch
                      checked={settingsDraft.languageSelectorEnabled ?? false}
                      onCheckedChange={(checked) => updateField('languageSelectorEnabled', checked)}
                      data-testid="switch-chat-language-selector"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default-language">Default language</Label>
                    <Select
                      value={settingsDraft.defaultLanguage || 'en'}
                      onValueChange={(value) => updateField('defaultLanguage', value)}
                    >
                      <SelectTrigger id="default-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <div className="text-sm text-muted-foreground bg-card/80 dark:bg-slate-900/70 border border-border/60 dark:border-slate-800/60 rounded-md p-3">
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

          <Card className="border-0 bg-muted dark:bg-slate-800/60 shadow-none">
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

          <Card className="border-0 bg-muted dark:bg-slate-800/60 shadow-none">
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
        </div>
      </div>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={!!selectedConversation} onOpenChange={(open) => !open && setSelectedConversation(null)}>
        <DialogContent className="w-[95vw] max-w-[640px] p-0 gap-0 overflow-hidden rounded-2xl border-0 bg-white dark:bg-[#0b1220] text-slate-900 dark:text-slate-100 shadow-2xl">
          <DialogHeader className="border-0 bg-slate-50 dark:bg-[#0d1526] px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <DialogTitle className="text-lg">Conversation</DialogTitle>
                {selectedConversation && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{visitorName}</span>
                    {statusBadge(selectedConversation.status)}
                    {selectedConversation.firstPageUrl && (
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                        {selectedConversation.firstPageUrl}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {selectedConversation && conversationLastUpdated && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Updated {format(new Date(conversationLastUpdated), 'PP p')}
                </div>
              )}
            </div>
          </DialogHeader>

          {isMessagesLoading ? (
            <div className="flex justify-center py-12 bg-slate-200 dark:bg-[#0a1222]">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500 dark:text-blue-400" />
            </div>
          ) : (
            <div className="max-h-[450px] overflow-auto bg-slate-200 dark:bg-[#0a1222] px-6 py-6 space-y-6">
              {messages.map((msg) => {
                const isAssistant = msg.role === 'assistant';
                const nameLabel = isAssistant ? assistantName : visitorName;
                return (
                  <div
                    key={msg.id}
                    className={clsx('flex items-end gap-3', isAssistant ? 'justify-start' : 'justify-end')}
                  >
                    {isAssistant && (
                      <div className="h-9 w-9 rounded-full bg-white dark:bg-[#0b1220] border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shadow-sm">
                        {assistantAvatar ? (
                          <img src={assistantAvatar} alt={assistantName} className="h-full w-full object-cover" />
                        ) : (
                          <MessageSquare className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        )}
                      </div>
                    )}
                    <div className="max-w-[78%]">
                      <div
                        className={clsx(
                          'rounded-2xl px-4 py-3 text-sm shadow-sm',
                          isAssistant
                            ? 'bg-white dark:bg-[#111a2e] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800/80'
                            : 'bg-[#3b82f6] text-white'
                        )}
                      >
                        <div className="whitespace-pre-wrap leading-relaxed">{renderMarkdown(msg.content)}</div>
                      </div>
                      <div className={clsx('mt-1 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400', !isAssistant && 'justify-end')}>
                        <span className="font-medium">{nameLabel}</span>
                        <span>•</span>
                        <span>{format(new Date(msg.createdAt), 'PP p')}</span>
                      </div>
                      {msg.metadata?.pageUrl && (
                        <div className={clsx('mt-1 text-[11px] text-slate-500 dark:text-slate-400', !isAssistant && 'text-right')}>
                          Page: {msg.metadata.pageUrl}
                        </div>
                      )}
                    </div>
                    {!isAssistant && (
                      <div className="h-9 w-9 rounded-full bg-[#3b82f6] text-white flex items-center justify-center shadow-sm">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}
              {messages.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400 text-center">No messages yet.</p>}
              <div ref={messagesEndRef} />
            </div>
          )}

          {selectedConversation && (
            <div className="border-0 bg-slate-50 dark:bg-[#0d1526] px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 rounded-full bg-slate-200 dark:bg-slate-800/70 px-4 py-2 text-xs text-slate-600 dark:text-slate-300">
                  <MessageSquare className="w-4 h-4" />
                  <span>Read-only transcript in admin.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100"
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
                      <Button variant="ghost" className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300">
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
      className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-slate-800 dark:border-slate-700"
    >
      <button
        type="button"
        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500 dark:border-slate-600 dark:hover:bg-slate-700 dark:text-slate-400"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1">
        <p className="text-sm font-medium dark:text-slate-200">{objective.label}</p>
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
  const availabilityMenuTitle = menuItems.find((item) => item.id === 'availability')?.title ?? 'Availability & Business Hours';

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
        <h1 className="text-2xl font-bold">{availabilityMenuTitle}</h1>
        <p className="text-muted-foreground">Manage your working hours and time display preferences</p>
      </div>

      <div className="grid gap-6">
        <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Booking Constraints
          </h2>
          <div>
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
          </div>
        </div>

        <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Time Display & Hours
          </h2>
          <div className="space-y-6">
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
                    <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-card rounded-lg border border-border">
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
          </div>
        </div>
      </div>
    </div>
  );
}

interface TwilioSettings {
  enabled: boolean;
  accountSid: string;
  authToken: string;
  fromPhoneNumber: string;
  toPhoneNumber: string;
  notifyOnNewChat: boolean;
}

function TwilioSection() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<TwilioSettings>({
    enabled: false,
    accountSid: '',
    authToken: '',
    fromPhoneNumber: '',
    toPhoneNumber: '',
    notifyOnNewChat: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const { data: twilioSettings, isLoading } = useQuery<TwilioSettings>({
    queryKey: ['/api/integrations/twilio']
  });

  useEffect(() => {
    if (twilioSettings) {
      setSettings(twilioSettings);
    }
  }, [twilioSettings]);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/integrations/twilio', settings);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/twilio'] });
      toast({ title: 'Twilio settings saved successfully' });
    } catch (error: any) {
      toast({
        title: 'Failed to save Twilio settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult('idle');
    setTestMessage(null);
    try {
      const response = await fetch('/api/integrations/twilio/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid: settings.accountSid,
          authToken: settings.authToken,
          fromPhoneNumber: settings.fromPhoneNumber,
          toPhoneNumber: settings.toPhoneNumber
        }),
        credentials: 'include'
      });
      const result = await response.json();

      if (result.success) {
        setTestResult('success');
        setTestMessage('Test message sent successfully!');
        toast({ title: 'Test successful', description: 'Check your phone for the test message.' });
      } else {
        setTestResult('error');
        setTestMessage(result.message || 'Test failed');
        toast({
          title: 'Test failed',
          description: result.message || 'Could not send test message',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setTestResult('error');
      setTestMessage(error.message || 'Connection failed');
      toast({
        title: 'Test failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    if (checked && testResult !== 'success') {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling Twilio.',
        variant: 'destructive'
      });
      return;
    }
    const newSettings = { ...settings, enabled: checked };
    setSettings(newSettings);
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/integrations/twilio', newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/twilio'] });
      toast({ title: checked ? 'Twilio enabled' : 'Twilio disabled' });
    } catch (error: any) {
      toast({
        title: 'Failed to update settings',
        description: error.message,
        variant: 'destructive'
      });
      setSettings(prev => ({ ...prev, enabled: !checked }));
    } finally {
      setIsSaving(false);
    }
  };

  const testButtonClass =
    testResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : testResult === 'error'
      ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
      : '';

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 bg-muted">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F22F46] dark:bg-[#F22F46] flex items-center justify-center">
                <SiTwilio className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Twilio SMS</CardTitle>
                <p className="text-sm text-muted-foreground">Get SMS notifications for new chat conversations</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <Label className="text-sm">
                {settings.enabled ? 'Enabled' : 'Disabled'}
              </Label>
              <Switch
                checked={settings.enabled}
                onCheckedChange={handleToggleEnabled}
                disabled={isSaving}
                data-testid="switch-twilio-enabled"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="twilio-account-sid">Account SID</Label>
              <Input
                id="twilio-account-sid"
                type="text"
                value={settings.accountSid}
                onChange={(e) => setSettings(prev => ({ ...prev, accountSid: e.target.value }))}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                data-testid="input-twilio-account-sid"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-auth-token">Auth Token</Label>
              <Input
                id="twilio-auth-token"
                type="password"
                value={settings.authToken}
                onChange={(e) => setSettings(prev => ({ ...prev, authToken: e.target.value }))}
                placeholder="••••••••••••••••••••••••••••••••"
                data-testid="input-twilio-auth-token"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="twilio-from-phone">From Phone Number</Label>
              <Input
                id="twilio-from-phone"
                type="tel"
                value={settings.fromPhoneNumber}
                onChange={(e) => setSettings(prev => ({ ...prev, fromPhoneNumber: e.target.value }))}
                placeholder="+1234567890"
                data-testid="input-twilio-from-phone"
              />
              <p className="text-xs text-muted-foreground">
                Your Twilio phone number (with country code)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-to-phone">To Phone Number</Label>
              <Input
                id="twilio-to-phone"
                type="tel"
                value={settings.toPhoneNumber}
                onChange={(e) => setSettings(prev => ({ ...prev, toPhoneNumber: e.target.value }))}
                placeholder="+1234567890"
                data-testid="input-twilio-to-phone"
              />
              <p className="text-xs text-muted-foreground">
                Phone number to receive notifications
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="notify-new-chat"
              checked={settings.notifyOnNewChat}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notifyOnNewChat: checked as boolean }))}
              data-testid="checkbox-notify-new-chat"
            />
            <Label htmlFor="notify-new-chat" className="text-sm font-normal cursor-pointer">
              Send SMS when a new chat conversation starts
            </Label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              onClick={saveSettings}
              disabled={isSaving}
              data-testid="button-save-twilio"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
            <Button
              variant="outline"
              className={testButtonClass}
              onClick={testConnection}
              disabled={isTesting || !settings.accountSid || !settings.authToken || !settings.fromPhoneNumber || !settings.toPhoneNumber}
              data-testid="button-test-twilio"
            >
              {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {testResult === 'success' ? 'Test OK' : testResult === 'error' ? 'Test Failed' : 'Send Test SMS'}
            </Button>
          </div>

          {testMessage && (
            <div className={`p-3 rounded-lg text-sm ${
              testResult === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
            }`}>
              {testMessage}
            </div>
          )}

          {settings.enabled && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Check className="w-4 h-4" />
                <span className="font-medium text-sm">Twilio is enabled</span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                You'll receive SMS notifications when new chat conversations start
              </p>
            </div>
          )}
        </CardContent>
      </Card>
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
  const integrationsMenuTitle = menuItems.find((item) => item.id === 'integrations')?.title ?? 'Integrations';

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
        <h1 className="text-2xl font-bold">{integrationsMenuTitle}</h1>
        <p className="text-muted-foreground">Connect your booking system with external services</p>
      </div>

      <div className="space-y-4">
        <Card className="border-0 bg-muted">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <SiOpenai className="w-5 h-5 text-black dark:text-white" />
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
        <Card className="border-0 bg-muted">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-transparent flex items-center justify-center overflow-hidden">
                  <img src={ghlLogo} alt="GoHighLevel" className="w-9 h-9 rounded-md object-contain" />
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

      <TwilioSection />

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 bg-muted">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <SiGoogletagmanager className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
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

          <Card className="border-0 bg-muted">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <SiGoogleanalytics className="w-4 h-4 text-[#E37400] dark:text-[#FFB74D]" />
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

          <Card className="border-0 bg-muted">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <SiFacebook className="w-4 h-4 text-[#1877F2] dark:text-[#5AA2FF]" />
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

      <div className="bg-muted p-6 rounded-lg space-y-4 transition-all">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary" />
          Tracked Events
        </h2>
        <div className="p-4 bg-card/60 rounded-lg">
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
              <div key={event} className="text-xs bg-muted/40 p-2 rounded">
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

function KnowledgeBaseSection() {
  const { toast } = useToast();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isCreateArticleOpen, setIsCreateArticleOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [editingArticle, setEditingArticle] = useState<any | null>(null);

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon: 'Package',
    order: 0,
  });

  const [articleFormData, setArticleFormData] = useState({
    categoryId: 0,
    title: '',
    content: '',
    order: 0,
    isActive: true,
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/knowledge-base/categories'],
    queryFn: async () => {
      const response = await fetch('/api/knowledge-base/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    },
  });

  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['/api/knowledge-base/articles', selectedCategoryId],
    queryFn: async () => {
      const url = selectedCategoryId
        ? `/api/knowledge-base/articles?categoryId=${selectedCategoryId}`
        : '/api/knowledge-base/articles';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch articles');
      return response.json();
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: typeof categoryFormData) => apiRequest('POST', '/api/knowledge-base/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/categories'] });
      toast({ title: 'Category created successfully' });
      setIsCreateCategoryOpen(false);
      resetCategoryForm();
    },
    onError: (err: any) => {
      toast({ title: 'Error creating category', description: err.message, variant: 'destructive' });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof categoryFormData }) =>
      apiRequest('PUT', `/api/knowledge-base/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/categories'] });
      toast({ title: 'Category updated successfully' });
      setEditingCategory(null);
      resetCategoryForm();
    },
    onError: (err: any) => {
      toast({ title: 'Error updating category', description: err.message, variant: 'destructive' });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/knowledge-base/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/articles'] });
      toast({ title: 'Category deleted' });
    },
    onError: (err: any) => {
      toast({ title: 'Error deleting category', description: err.message, variant: 'destructive' });
    },
  });

  const createArticleMutation = useMutation({
    mutationFn: (data: typeof articleFormData) => apiRequest('POST', '/api/knowledge-base/articles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/articles'] });
      toast({ title: 'Article created successfully' });
      setIsCreateArticleOpen(false);
      resetArticleForm();
    },
    onError: (err: any) => {
      toast({ title: 'Error creating article', description: err.message, variant: 'destructive' });
    },
  });

  const updateArticleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof articleFormData }) =>
      apiRequest('PUT', `/api/knowledge-base/articles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/articles'] });
      toast({ title: 'Article updated successfully' });
      setEditingArticle(null);
      resetArticleForm();
    },
    onError: (err: any) => {
      toast({ title: 'Error updating article', description: err.message, variant: 'destructive' });
    },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/knowledge-base/articles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/articles'] });
      toast({ title: 'Article deleted' });
    },
    onError: (err: any) => {
      toast({ title: 'Error deleting article', description: err.message, variant: 'destructive' });
    },
  });

  const toggleAssistantLinkMutation = useMutation({
    mutationFn: ({ categoryId, isLinked }: { categoryId: number; isLinked: boolean }) =>
      apiRequest('POST', `/api/knowledge-base/categories/${categoryId}/link-assistant`, { isLinked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/categories'] });
      toast({ title: 'Assistant link updated successfully' });
    },
    onError: (err: any) => {
      toast({ title: 'Error updating assistant link', description: err.message, variant: 'destructive' });
    },
  });

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: '',
      slug: '',
      description: '',
      icon: 'Package',
      order: 0,
    });
  };

  const resetArticleForm = () => {
    setArticleFormData({
      categoryId: selectedCategoryId || 0,
      title: '',
      content: '',
      order: 0,
      isActive: true,
    });
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleCategoryNameChange = (value: string) => {
    setCategoryFormData(prev => ({
      ...prev,
      name: value,
      slug: prev.slug || generateSlug(value),
    }));
  };

  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      icon: category.icon || 'Package',
      order: category.order || 0,
    });
  };

  const handleEditArticle = (article: any) => {
    setEditingArticle(article);
    setArticleFormData({
      categoryId: article.categoryId,
      title: article.title,
      content: article.content,
      order: article.order || 0,
      isActive: article.isActive ?? true,
    });
  };

  const handleSaveCategory = () => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: categoryFormData });
    } else {
      createCategoryMutation.mutate(categoryFormData);
    }
  };

  const handleSaveArticle = () => {
    if (editingArticle) {
      updateArticleMutation.mutate({ id: editingArticle.id, data: articleFormData });
    } else {
      createArticleMutation.mutate(articleFormData);
    }
  };

  const handleToggleAssistantLink = async (categoryId: number) => {
    try {
      const response = await fetch(`/api/knowledge-base/categories/${categoryId}/link-assistant`);
      const { isLinked } = await response.json();
      toggleAssistantLinkMutation.mutate({ categoryId, isLinked: !isLinked });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to toggle assistant link', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage knowledge base categories and articles for your AI assistant
          </p>
        </div>
        <Button onClick={() => setIsCreateCategoryOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Category
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-0 bg-muted">
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {categoriesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {categories && categories.length > 0 ? (
                  categories.map((category: any) => (
                    <div
                      key={category.id}
                      className={clsx(
                        'p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent',
                        selectedCategoryId === category.id && 'bg-accent'
                      )}
                      onClick={() => setSelectedCategoryId(category.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{category.name}</h4>
                          {category.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {category.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleAssistantLink(category.id);
                            }}
                          >
                            <Sparkles className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCategory(category);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will delete the category and all its articles. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteCategoryMutation.mutate(category.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No categories yet. Create one to get started.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-0 bg-muted">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedCategoryId
                  ? `Articles - ${categories?.find((c: any) => c.id === selectedCategoryId)?.name}`
                  : 'Articles'}
              </CardTitle>
              <Button
                onClick={() => {
                  if (!selectedCategoryId) {
                    toast({
                      title: 'Select a category first',
                      description: 'Please select a category to add articles to',
                      variant: 'destructive',
                    });
                    return;
                  }
                  setArticleFormData(prev => ({ ...prev, categoryId: selectedCategoryId }));
                  setIsCreateArticleOpen(true);
                }}
                disabled={!selectedCategoryId}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Article
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {articlesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {articles && articles.length > 0 ? (
                  articles.map((article: any) => (
                    <div key={article.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{article.title}</h4>
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                            {article.content.substring(0, 200)}...
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant={article.isActive ? 'default' : 'secondary'}>
                              {article.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditArticle(article)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Article</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this article. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteArticleMutation.mutate(article.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {selectedCategoryId
                      ? 'No articles in this category yet.'
                      : 'Select a category to view articles.'}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateCategoryOpen || editingCategory !== null} onOpenChange={(open) => {
        if (!open) {
          setIsCreateCategoryOpen(false);
          setEditingCategory(null);
          resetCategoryForm();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={categoryFormData.name}
                onChange={(e) => handleCategoryNameChange(e.target.value)}
                placeholder="Products Used"
              />
            </div>
            <div>
              <Label htmlFor="category-slug">Slug</Label>
              <Input
                id="category-slug"
                value={categoryFormData.slug}
                onChange={(e) => setCategoryFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="products-used"
              />
            </div>
            <div>
              <Label htmlFor="category-description">Description</Label>
              <Textarea
                id="category-description"
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Information about products used in our services"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="category-icon">Icon (Lucide icon name)</Label>
              <Input
                id="category-icon"
                value={categoryFormData.icon}
                onChange={(e) => setCategoryFormData(prev => ({ ...prev, icon: e.target.value }))}
                placeholder="Package"
              />
            </div>
            <div>
              <Label htmlFor="category-order">Order</Label>
              <Input
                id="category-order"
                type="number"
                value={categoryFormData.order}
                onChange={(e) => setCategoryFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateCategoryOpen(false);
              setEditingCategory(null);
              resetCategoryForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory}>
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateArticleOpen || editingArticle !== null} onOpenChange={(open) => {
        if (!open) {
          setIsCreateArticleOpen(false);
          setEditingArticle(null);
          resetArticleForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingArticle ? 'Edit Article' : 'Create Article'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="article-category">Category</Label>
              <Select
                value={articleFormData.categoryId.toString()}
                onValueChange={(value) => setArticleFormData(prev => ({ ...prev, categoryId: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((category: any) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="article-title">Title</Label>
              <Input
                id="article-title"
                value={articleFormData.title}
                onChange={(e) => setArticleFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="All-Purpose Cleaner Usage Guide"
              />
            </div>
            <div>
              <Label htmlFor="article-content">Content</Label>
              <Textarea
                id="article-content"
                value={articleFormData.content}
                onChange={(e) => setArticleFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Detailed information about the topic..."
                rows={12}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="article-order">Order</Label>
                <Input
                  id="article-order"
                  type="number"
                  value={articleFormData.order}
                  onChange={(e) => setArticleFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="article-active"
                  checked={articleFormData.isActive}
                  onCheckedChange={(checked) => setArticleFormData(prev => ({ ...prev, isActive: checked as boolean }))}
                />
                <Label htmlFor="article-active">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateArticleOpen(false);
              setEditingArticle(null);
              resetArticleForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveArticle}>
              {editingArticle ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BlogSection({ resetSignal }: { resetSignal: number }) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'status'>('newest');
  const [serviceSearch, setServiceSearch] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [isDeletingTag, setIsDeletingTag] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState('');
  const [isRenamingTag, setIsRenamingTag] = useState(false);
  const blogMenuTitle = menuItems.find((item) => item.id === 'blog')?.title ?? 'Blog Posts';
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    metaDescription: '',
    focusKeyword: '',
    tags: '' as string,
    featureImageUrl: '',
    status: 'published',
    authorName: 'Skleanings',
    publishedAt: new Date().toISOString().split('T')[0] as string | null,
    serviceIds: [] as number[],
  });
  const [tagInput, setTagInput] = useState('');
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lastContentRef = useRef('');
  const lastResetSignalRef = useRef(0);

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

  const availableTags = useMemo(() => {
    if (!posts) return [];
    const tagMap = new Map<string, string>();
    posts.forEach((post) => {
      const rawTags = (post.tags || '').split(',');
      rawTags.forEach((tag) => {
        const trimmed = tag.trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (!tagMap.has(key)) {
          tagMap.set(key, trimmed);
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const selectedTagSet = useMemo(() => {
    return new Set(
      formData.tags
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    );
  }, [formData.tags]);

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setFormData((prev) => {
      const existing = prev.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (existing.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      return { ...prev, tags: existing.length ? `${existing.join(',')},${trimmed}` : trimmed };
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      slug: '',
      content: '',
      excerpt: '',
      metaDescription: '',
      focusKeyword: '',
      tags: '',
      featureImageUrl: '',
      status: 'published',
      authorName: 'Skleanings',
      publishedAt: new Date().toISOString().split('T')[0] as string | null,
      serviceIds: [],
    });
    setTagInput('');
  }, []);

  // Reset saved state when form data changes
  useEffect(() => {
    if (isSaved) {
      setIsSaved(false);
    }
  }, [formData]);

  useEffect(() => {
    if (resetSignal === lastResetSignalRef.current) return;
    lastResetSignalRef.current = resetSignal;
    if (editingPost || isCreateOpen) {
      setIsCreateOpen(false);
      setEditingPost(null);
      setServiceSearch('');
      setIsSaved(false);
      resetForm();
    }
  }, [resetSignal, editingPost, isCreateOpen, resetForm]);

  useEffect(() => {
    if (!contentRef.current) return;
    if (formData.content === lastContentRef.current) return;
    if (document.activeElement === contentRef.current) return;
    contentRef.current.innerHTML = formData.content;
    lastContentRef.current = formData.content;
  }, [formData.content]);

  const syncEditorContent = useCallback(() => {
    if (!contentRef.current) return;
    const rawHtml = contentRef.current.innerHTML;
    const text = contentRef.current.textContent?.trim() || '';
    const nextHtml = text ? rawHtml : '';
    lastContentRef.current = nextHtml;
    setFormData(prev => (prev.content === nextHtml ? prev : { ...prev, content: nextHtml }));
  }, []);

  const runEditorCommand = useCallback(
    (command: string, value?: string) => {
      if (!contentRef.current) return;
      contentRef.current.focus();
      document.execCommand(command, false, value);
      syncEditorContent();
    },
    [syncEditorContent]
  );

  const setEditorBlock = useCallback(
    (tag: 'p' | 'h2') => {
      runEditorCommand('formatBlock', `<${tag}>`);
    },
    [runEditorCommand]
  );

  const insertEditorLink = useCallback(() => {
    const url = window.prompt('Enter URL');
    if (!url) return;
    runEditorCommand('createLink', url);
  }, [runEditorCommand]);

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

  const removeTagMutation = useMutation({
    mutationFn: async (tag: string) => {
      await apiRequest('DELETE', `/api/blog/tags/${encodeURIComponent(tag)}`);
    },
    onSuccess: (_data, tag) => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      toast({ title: 'Tag removed', description: `"${tag}" removed from all posts.` });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to remove tag', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      setIsDeletingTag(false);
      setTagToDelete(null);
    }
  });

  const renameTagMutation = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      await apiRequest('PUT', `/api/blog/tags/${encodeURIComponent(from)}`, { name: to });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      toast({ title: 'Tag updated', description: `"${variables.from}" renamed to "${variables.to}".` });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to update tag', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      setIsRenamingTag(false);
      setEditingTag(null);
      setEditingTagValue('');
    }
  });

  const handleConfirmRemoveTag = useCallback(() => {
    if (!tagToDelete || isDeletingTag) return;
    setIsDeletingTag(true);
    removeTagMutation.mutate(tagToDelete);
  }, [tagToDelete, isDeletingTag, removeTagMutation]);

  const handleStartEditTag = useCallback((tag: string) => {
    if (isRenamingTag) return;
    setEditingTag(tag);
    setEditingTagValue(tag);
  }, [isRenamingTag]);

  const handleCancelEditTag = useCallback(() => {
    setEditingTag(null);
    setEditingTagValue('');
  }, []);

  const handleSubmitEditTag = useCallback(() => {
    if (!editingTag || isRenamingTag) return;
    const next = editingTagValue.trim();
    if (!next) {
      handleCancelEditTag();
      return;
    }
    if (next === editingTag) {
      handleCancelEditTag();
      return;
    }
    const nextLower = next.toLowerCase();
    const currentLower = editingTag.toLowerCase();
    const hasDuplicate = availableTags.some(
      (tag) => tag.toLowerCase() === nextLower && tag.toLowerCase() !== currentLower
    );
    if (hasDuplicate) {
      toast({ title: 'Tag already exists', description: `"${next}" is already in use.` });
      return;
    }
    setIsRenamingTag(true);
    renameTagMutation.mutate({ from: editingTag, to: next });
  }, [editingTag, editingTagValue, isRenamingTag, availableTags, renameTagMutation, toast, handleCancelEditTag]);

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
      tags: (post as any).tags || '',
      featureImageUrl: post.featureImageUrl || '',
      status: post.status,
      authorName: post.authorName || 'Admin',
      publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString().split('T')[0] : null,
      serviceIds: postServices.map((s: Service) => s.id),
    });
    setTagInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) {
      toast({ title: 'Content is required', variant: 'destructive' });
      return;
    }
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

  const renderForm = () => {
    const publishedDate = formData.publishedAt
      ? new Date(`${formData.publishedAt}T00:00:00`)
      : undefined;
    const focusScore = (() => {
      const keyword = formData.focusKeyword.toLowerCase().trim();
      if (!keyword) return null;

      const title = formData.title.toLowerCase();
      const slug = formData.slug.toLowerCase();
      const content = formData.content.toLowerCase();
      const metaDesc = formData.metaDescription.toLowerCase();

      let score = 0;
      if (title.includes(keyword)) score += 25;
      if (slug.includes(keyword.replace(/\s+/g, '-'))) score += 15;
      if (metaDesc.includes(keyword)) score += 25;

      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const keywordCount = (content.match(keywordRegex) || []).length;
      const density = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;

      if (keywordCount >= 1) score += 10;
      if (keywordCount >= 3) score += 10;
      if (density >= 0.5 && density <= 2.5) score += 15;

      const barColor = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
      const badgeClass = score >= 80
        ? 'bg-green-500/15 text-green-600 dark:text-green-400'
        : score >= 50
        ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
        : 'bg-red-500/15 text-red-600 dark:text-red-400';

      return { score, barColor, badgeClass };
    })();

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Enter post title"
            className="border-0 bg-background"
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
            className="border-0 bg-background"
            required
            data-testid="input-blog-slug"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="focusKeyword">Focus Keyword</Label>
          <div className="rounded-md bg-background overflow-hidden">
            <div className="relative">
              <Input
                id="focusKeyword"
                value={formData.focusKeyword}
                onChange={(e) => setFormData(prev => ({ ...prev, focusKeyword: e.target.value }))}
                placeholder="Primary SEO keyword"
                className="pr-14 rounded-none border-0 bg-transparent"
                data-testid="input-blog-keyword"
              />
              {focusScore && (
                <span
                  className={clsx(
                    "absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    focusScore.badgeClass
                  )}
                >
                  {focusScore.score}/100
                </span>
              )}
            </div>
            {focusScore && (
              <div className="h-[3px] bg-slate-200 dark:bg-slate-700">
                <div className={clsx("h-full transition-all", focusScore.barColor)} style={{ width: `${focusScore.score}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content *</Label>
        <div className="rounded-md bg-background overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 border-b border-border/50 px-2 py-2 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => setEditorBlock('p')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              P
            </button>
            <button
              type="button"
              onClick={() => setEditorBlock('h2')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              H2
            </button>
            <span className="mx-1 h-4 w-px bg-border/60" />
            <button
              type="button"
              onClick={() => runEditorCommand('bold')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => runEditorCommand('italic')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => runEditorCommand('insertUnorderedList')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              UL
            </button>
            <button
              type="button"
              onClick={() => runEditorCommand('insertOrderedList')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              OL
            </button>
            <button
              type="button"
              onClick={insertEditorLink}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              Link
            </button>
            <button
              type="button"
              onClick={() => runEditorCommand('removeFormat')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setIsEditorExpanded(prev => !prev)}
              className="ml-auto rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              {isEditorExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
          <div
            id="content"
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            onInput={syncEditorContent}
            onBlur={syncEditorContent}
            data-placeholder="Write your blog post content here..."
            className={clsx(
              "admin-editor px-3 py-2 text-sm focus:outline-none prose prose-sm dark:prose-invert max-w-none overflow-y-auto",
              isEditorExpanded
                ? "min-h-[320px] max-h-[65vh] sm:min-h-[420px] sm:max-h-[70vh]"
                : "min-h-[180px] max-h-[40vh] sm:min-h-[220px] sm:max-h-[45vh]"
            )}
            data-testid="textarea-blog-content"
          />
        </div>
        <p className="text-xs text-muted-foreground">Supports HTML formatting</p>
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
            placeholder="Short description for SEO and blog cards..."
            className="min-h-[100px] border-0 bg-background"
            data-testid="textarea-blog-meta"
          />
          <p className="text-xs text-muted-foreground">{formData.metaDescription.length}/155 characters · Used for SEO and blog cards</p>
        </div>
        <div className="space-y-2">
          <Label>Feature Image</Label>
          <div
            className="relative w-full sm:w-1/2 aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden group"
            onClick={() => document.getElementById('featureImageInput')?.click()}
          >
            {formData.featureImageUrl ? (
              <>
                <img
                  src={formData.featureImageUrl}
                  alt="Feature"
                  className="w-full h-full object-cover"
                  data-testid="img-blog-feature-preview"
                />
                <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                  Uploaded
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-medium">Click to change</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFormData(prev => ({ ...prev, featureImageUrl: '' }));
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                <Image className="w-8 h-8 mb-2" />
                <span className="text-sm">Click to upload</span>
                <span className="text-xs mt-1">1200x675px (16:9)</span>
              </div>
            )}
            <input
              id="featureImageInput"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              data-testid="input-blog-feature-image"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2 min-h-9 rounded-md bg-background px-3 py-2">
            {formData.tags.split(',').filter(t => t.trim()).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary"
              >
                {tag.trim()}
                <button
                  type="button"
                  onClick={() => {
                    const tags = formData.tags.split(',').filter(t => t.trim());
                    tags.splice(index, 1);
                    setFormData(prev => ({ ...prev, tags: tags.join(',') }));
                  }}
                  className="hover:text-destructive"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  const newTag = tagInput.trim();
                  if (newTag && !formData.tags.split(',').map(t => t.trim().toLowerCase()).includes(newTag.toLowerCase())) {
                    setFormData(prev => ({
                      ...prev,
                      tags: prev.tags ? `${prev.tags},${newTag}` : newTag
                    }));
                  }
                  setTagInput('');
                }
              }}
              placeholder={formData.tags ? "Add more..." : "Type and press Enter..."}
              className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
            />
          </div>
          <p className="text-xs text-muted-foreground">Press Enter or comma to add a tag</p>
          {availableTags.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Available tags</p>
              <div className="flex flex-wrap gap-2">
                {availableTags
                  .filter((tag) => !selectedTagSet.has(tag.toLowerCase()))
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    >
                      + {tag}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Related Services (max 3)</Label>
          <div className="rounded-md bg-background overflow-hidden">
            <Input
              placeholder="Search services..."
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              className="rounded-none border-0 bg-transparent"
              data-testid="input-service-search"
            />
            <div className="grid gap-2 max-h-[120px] overflow-y-auto border-t border-border/50 p-3">
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
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger className="border-0 bg-background" data-testid="select-blog-status">
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
          <Popover>
            <PopoverTrigger asChild>
              <button
                id="publishedAt"
                type="button"
                className={clsx(
                  "flex h-9 w-full items-center justify-between rounded-md bg-background px-3 py-2 text-sm",
                  !publishedDate && "text-muted-foreground"
                )}
                data-testid="input-blog-date"
              >
                <span className="truncate">
                  {publishedDate ? format(publishedDate, "MM/dd/yyyy") : "Select date"}
                </span>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto rounded-2xl border-0 p-0 shadow-lg overflow-hidden"
              align="end"
              side="bottom"
              sideOffset={8}
            >
              <CalendarPicker
                mode="single"
                selected={publishedDate}
                onSelect={(date) =>
                  setFormData(prev => ({
                    ...prev,
                    publishedAt: date ? format(date, "yyyy-MM-dd") : null
                  }))
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="authorName">Author</Label>
          <Input
            id="authorName"
            value={formData.authorName}
            onChange={(e) => setFormData(prev => ({ ...prev, authorName: e.target.value }))}
            placeholder="Skleanings"
            className="border-0 bg-background"
            data-testid="input-blog-author"
          />
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-border/70">
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
            variant="ghost"
            onClick={() => {
              setIsCreateOpen(false);
              setEditingPost(null);
              setServiceSearch('');
              setIsSaved(false);
              resetForm();
            }}
            className="text-muted-foreground hover:text-foreground"
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
  };

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
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
            <h1 className="text-2xl font-bold">{editingPost ? 'Edit Post' : 'Create New Post'}</h1>
          </div>
          {editingPost && formData.slug && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/blog/${formData.slug}`, '_blank')}
              className="border-0"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Post
            </Button>
          )}
        </div>
        <div className="bg-muted p-4 sm:p-6 rounded-lg space-y-6 transition-all">
          {renderForm()}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-blog-title">{blogMenuTitle}</h1>
          <p className="text-sm text-muted-foreground">Manage your blog content and SEO</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Dialog open={isTagManagerOpen} onOpenChange={setIsTagManagerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto border-0">
                <Tag className="w-4 h-4 mr-2" />
                Manage Tags
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md border-0">
              <DialogHeader>
                <DialogTitle>Manage Tags</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {availableTags.length > 0 ? (
                  availableTags.map((tag) => (
                    <div
                      key={tag}
                      className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2"
                      onDoubleClick={() => handleStartEditTag(tag)}
                    >
                      {editingTag === tag ? (
                        <Input
                          value={editingTagValue}
                          onChange={(e) => setEditingTagValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSubmitEditTag();
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelEditTag();
                            }
                          }}
                          onBlur={handleSubmitEditTag}
                          autoFocus
                          className="h-8 border-0 bg-transparent px-0 text-sm"
                          data-testid={`input-tag-edit-${tag}`}
                        />
                      ) : (
                        <span className="text-sm font-medium">{tag}</span>
                      )}
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEditTag(tag)}
                          disabled={isDeletingTag || isRenamingTag}
                          data-testid={`button-tag-edit-${tag}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setTagToDelete(tag)}
                          disabled={isDeletingTag || editingTag === tag || isRenamingTag}
                          data-testid={`button-tag-delete-${tag}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No tags available.</p>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Select value={sortBy} onValueChange={(value: typeof sortBy) => setSortBy(value)}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-blog-sort">
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
          <Button className="w-full sm:w-auto" onClick={() => setIsCreateOpen(true)} data-testid="button-blog-create">
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Button>
        </div>
      </div>

      <div className="bg-muted p-4 sm:p-6 rounded-lg space-y-6 transition-all">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Posts
        </h2>
        {sortedPosts && sortedPosts.length > 0 ? (
          <div className="space-y-3">
            {sortedPosts.map(post => (
              <div key={post.id} className="flex flex-col gap-4 p-3 sm:p-4 bg-card/90 dark:bg-slate-900/70 rounded-lg sm:flex-row sm:items-start" data-testid={`row-blog-${post.id}`}>
                {post.featureImageUrl ? (
                  <img
                    src={post.featureImageUrl}
                    alt={post.title}
                    className="w-full h-[160px] object-cover rounded-sm cursor-pointer hover:opacity-80 transition-opacity sm:w-[100px] sm:h-[68px] sm:flex-shrink-0"
                    onClick={() => handleEdit(post)}
                    data-testid={`img-blog-${post.id}`}
                  />
                ) : (
                  <div
                    className="w-full h-[160px] bg-muted rounded-sm flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors sm:w-[100px] sm:h-[68px] sm:flex-shrink-0"
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
                <div className="flex items-center gap-2 self-end sm:self-center">
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
      </div>
      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove tag</AlertDialogTitle>
            <AlertDialogDescription>
              {tagToDelete
                ? `Remove "${tagToDelete}" from all posts? This cannot be undone.`
                : 'Remove this tag from all posts?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTag}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemoveTag} disabled={isDeletingTag}>
              {isDeletingTag ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
