import { useState, useEffect, useRef, useCallback } from 'react';
import { useAdminAuth } from '@/context/AuthContext';
import { useLocation, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
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
  SidebarProvider
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
  ListFilter,
  Users,
  Puzzle
} from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import type { Category, Service, Booking, Subcategory } from '@shared/schema';

type AdminSection = 'dashboard' | 'categories' | 'subcategories' | 'services' | 'bookings' | 'hero' | 'company' | 'users' | 'availability' | 'integrations';

const menuItems = [
  { id: 'dashboard' as AdminSection, title: 'Dashboard', icon: LayoutDashboard },
  { id: 'categories' as AdminSection, title: 'Categories', icon: FolderOpen },
  { id: 'subcategories' as AdminSection, title: 'Subcategories', icon: ListFilter },
  { id: 'services' as AdminSection, title: 'Services', icon: Package },
  { id: 'bookings' as AdminSection, title: 'Bookings', icon: Calendar },
  { id: 'hero' as AdminSection, title: 'Hero Section', icon: Image },
  { id: 'company' as AdminSection, title: 'Company Infos', icon: Building2 },
  { id: 'users' as AdminSection, title: 'Users', icon: Users },
  { id: 'availability' as AdminSection, title: 'Availability', icon: Clock },
  { id: 'integrations' as AdminSection, title: 'Integrations', icon: Puzzle },
];

export default function Admin() {
  const { toast } = useToast();
  const { isAdmin, email, firstName, lastName, loading, signOut } = useAdminAuth();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [sectionsOrder, setSectionsOrder] = useState<AdminSection[]>(menuItems.map(item => item.id));
  const [draggedSectionId, setDraggedSectionId] = useState<AdminSection | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) {
      setLocation('/admin/login');
    }
  }, [loading, isAdmin, setLocation]);

  const handleSectionDragStart = (e: React.DragEvent, id: AdminSection) => {
    setDraggedSectionId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSectionDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

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

  const handleSectionDrop = (e: React.DragEvent, targetId: AdminSection) => {
    e.preventDefault();
    if (draggedSectionId === null || draggedSectionId === targetId) return;

    const newOrder = [...sectionsOrder];
    const draggedIndex = newOrder.indexOf(draggedSectionId);
    const targetIndex = newOrder.indexOf(targetId);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedSectionId);

    updateSectionOrder(newOrder);
    setDraggedSectionId(null);
  };

  const { data: companySettings } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings']
  });

  useEffect(() => {
    if (companySettings?.sectionsOrder && companySettings.sectionsOrder.length > 0) {
      setSectionsOrder(companySettings.sectionsOrder as AdminSection[]);
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

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full bg-slate-50">
        <Sidebar className="border-r border-gray-200">
          <SidebarHeader className="p-4 border-b border-gray-100">
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
          
          <SidebarContent className="p-2">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sectionsOrder.map((sectionId) => {
                    const item = menuItems.find(i => i.id === sectionId)!;
                    return (
                      <SidebarMenuItem 
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleSectionDragStart(e, item.id)}
                        onDragOver={handleSectionDragOver}
                        onDrop={(e) => handleSectionDrop(e, item.id)}
                        onDragEnd={() => setDraggedSectionId(null)}
                        className={clsx(
                          "transition-all",
                          draggedSectionId === item.id && "opacity-50"
                        )}
                      >
                        <SidebarMenuButton
                          onClick={() => setActiveSection(item.id)}
                          isActive={activeSection === item.id}
                          data-testid={`nav-${item.id}`}
                          className="group/btn"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover/btn:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" />
                            <item.icon className="w-4 h-4" />
                            <span>{item.title}</span>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-gray-100 mt-auto">
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

        <main className="flex-1 overflow-auto p-6 md:p-8">
          {activeSection === 'dashboard' && <DashboardSection />}
          {activeSection === 'categories' && <CategoriesSection />}
          {activeSection === 'subcategories' && <SubcategoriesSection />}
          {activeSection === 'services' && <ServicesSection />}
          {activeSection === 'bookings' && <BookingsSection />}
          {activeSection === 'hero' && <HeroSettingsSection />}
          {activeSection === 'company' && <CompanySettingsSection />}
          {activeSection === 'users' && (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed">
              <Users className="w-12 h-12 mb-4 opacity-20" />
              <p>User management coming soon</p>
            </div>
          )}
          {activeSection === 'availability' && (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed">
              <Clock className="w-12 h-12 mb-4 opacity-20" />
              <p>Availability management coming soon</p>
            </div>
          )}
          {activeSection === 'integrations' && (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed">
              <Puzzle className="w-12 h-12 mb-4 opacity-20" />
              <p>Integrations coming soon</p>
            </div>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}

function DashboardSection() {
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
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">Recent Bookings</h2>
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
                      <p className="text-xs text-muted-foreground">{format(new Date(booking.bookingDate), "MMM dd, yyyy")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${booking.totalPrice}</p>
                    <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                      {booking.status}
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
  const [heroTitle, setHeroTitle] = useState('Professional Cleaning Services');
  const [heroSubtitle, setHeroSubtitle] = useState('Book your cleaning service today and enjoy a sparkling clean home');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [ctaText, setCtaText] = useState('Book Now');

  const handleSave = () => {
    toast({ title: 'Hero settings saved', description: 'Your changes have been saved successfully.' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hero Settings</h1>
        <p className="text-muted-foreground">Customize your landing page hero section</p>
      </div>

      <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg space-y-6 transition-all">
        <div className="space-y-2">
          <Label htmlFor="heroTitle">Hero Title</Label>
          <Input 
            id="heroTitle" 
            value={heroTitle} 
            onChange={(e) => setHeroTitle(e.target.value)}
            placeholder="Enter hero title"
            data-testid="input-hero-title"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
          <Textarea 
            id="heroSubtitle" 
            value={heroSubtitle} 
            onChange={(e) => setHeroSubtitle(e.target.value)}
            placeholder="Enter hero subtitle"
            data-testid="input-hero-subtitle"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="heroImage">Hero Background Image URL</Label>
          <Input 
            id="heroImage" 
            value={heroImageUrl} 
            onChange={(e) => setHeroImageUrl(e.target.value)}
            placeholder="https://..."
            data-testid="input-hero-image"
          />
          {heroImageUrl && (
            <img src={heroImageUrl} alt="Hero preview" className="w-full h-48 object-cover rounded-lg mt-2" />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ctaText">Call to Action Button Text</Label>
          <Input 
            id="ctaText" 
            value={ctaText} 
            onChange={(e) => setCtaText(e.target.value)}
            placeholder="Book Now"
            data-testid="input-cta-text"
          />
        </div>

        <Button onClick={handleSave} data-testid="button-save-hero">
          Save Changes
        </Button>
      </div>
    </div>
  );
}

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

  const updateField = useCallback((field: keyof CompanySettingsData, value: string) => {
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

              <div className="space-y-4 col-span-full border-t pt-6 mt-2">
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

          <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Working Hours
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="workingHoursStart">Opening Time</Label>
                <Input 
                  id="workingHoursStart" 
                  type="time"
                  value={settings.workingHoursStart || '08:00'} 
                  onChange={(e) => updateField('workingHoursStart', e.target.value)}
                  data-testid="input-hours-start"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workingHoursEnd">Closing Time</Label>
                <Input 
                  id="workingHoursEnd" 
                  type="time"
                  value={settings.workingHoursEnd || '18:00'} 
                  onChange={(e) => updateField('workingHoursEnd', e.target.value)}
                  data-testid="input-hours-end"
                />
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
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories']
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['/api/services']
  });

  useEffect(() => {
    if (categories) {
      setOrderedCategories(categories);
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

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedId === null || draggedId === targetId) return;

    const newOrder = [...orderedCategories];
    const draggedIndex = newOrder.findIndex(c => c.id === draggedId);
    const targetIndex = newOrder.findIndex(c => c.id === targetId);

    const [draggedItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);

    setOrderedCategories(newOrder);
    setDraggedId(null);
    toast({ title: 'Category order updated' });
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground">Manage your service categories. Drag to reorder.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingCategory(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-category">
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
        <div className="grid gap-3">
          {orderedCategories?.map((category) => (
            <div
              key={category.id}
              draggable
              onDragStart={(e) => handleDragStart(e, category.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, category.id)}
              onDragEnd={handleDragEnd}
              className={clsx(
                "flex items-center gap-4 p-4 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-grab active:cursor-grabbing transition-all",
                draggedId === category.id && "opacity-50 scale-[0.98]"
              )}
              data-testid={`category-item-${category.id}`}
            >
              <div className="text-muted-foreground cursor-grab">
                <GripVertical className="w-5 h-5" />
              </div>
              {category.imageUrl && (
                <img 
                  src={category.imageUrl} 
                  alt={category.name} 
                  className="w-24 h-14 rounded-md object-cover flex-shrink-0" 
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{category.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{category.description}</p>
                <Badge variant="secondary" className="mt-2">
                  {getServiceCount(category.id)} services
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setEditingCategory(category); setIsDialogOpen(true); }}
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
                        {getServiceCount(category.id) > 0 
                          ? `This category has ${getServiceCount(category.id)} services. You must delete or reassign them first.`
                          : 'This action cannot be undone.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => deleteCategory.mutate(category.id)}
                        disabled={getServiceCount(category.id) > 0}
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
      queryClient.invalidateQueries({ queryKey: ['/api/service-addons'] });
      toast({ title: 'Service deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete service', description: error.message, variant: 'destructive' });
    }
  });

  const filteredServices = services?.filter(service => {
    const matchesCategory = filterCategory === 'all' || service.categoryId === Number(filterCategory);
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryName = (categoryId: number) => {
    return categories?.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Services</h1>
          <p className="text-muted-foreground">Manage your cleaning services</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingService(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-service">
              <Plus className="w-4 h-4 mr-2" />
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
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Input 
          placeholder="Search services..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
          data-testid="input-search-services"
        />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-category">
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {filteredServices?.map((service) => (
            <div key={service.id} className="overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 transition-all">
              {service.imageUrl && (
                <div className="w-full aspect-[4/3] overflow-hidden">
                  <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="flex flex-col gap-2 mb-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-lg line-clamp-1">{service.name}</h3>
                    {service.isHidden && <Badge variant="secondary" className="text-xs border-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Add-on Only</Badge>}
                  </div>
                  <div className="text-2xl font-bold text-primary">${service.price}</div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{service.description}</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{Math.floor(service.durationMinutes / 60)}h {service.durationMinutes % 60}m</span>
                  </div>
                  <Badge variant="secondary" className="border-0 bg-slate-200 dark:bg-slate-700">{getCategoryName(service.categoryId)}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingService(service); setIsDialogOpen(true); }}
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
                          onClick={() => deleteService.mutate(service.id)}
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
          ))}
        </div>
      )}
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
                          ×
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

function BookingsSection() {
  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ['/api/bookings']
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">View all customer bookings</p>
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
        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden transition-all">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4 text-left">Customer</th>
                  <th className="px-6 py-4 text-left">Schedule</th>
                  <th className="px-6 py-4 text-left">Address</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {bookings?.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-200/30 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{booking.customerName}</p>
                          <p className="text-xs text-slate-500">{booking.customerEmail}</p>
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
                    <td className="px-6 py-4">
                      <span className={clsx(
                        "px-2.5 py-1 rounded-full text-xs font-bold",
                        booking.status === "confirmed" ? "bg-green-100 text-green-700" :
                        booking.status === "cancelled" ? "bg-red-100 text-red-700" :
                        "bg-slate-200 text-slate-700"
                      )}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center justify-end gap-1">
                        {booking.paymentMethod === "site" && (
                          <span className="text-[10px] text-orange-600 bg-orange-100 px-1.5 rounded uppercase">Unpaid</span>
                        )}
                        ${booking.totalPrice}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
