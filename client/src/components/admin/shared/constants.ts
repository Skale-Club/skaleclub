import { Building2, Briefcase, ClipboardList, FileText, HelpCircle, Image, LayoutDashboard, LayoutPanelLeft, Link, Puzzle, Receipt, Search, Sparkles, Users, Smartphone, Presentation, RadioTower, Bell, TrendingUp, Shapes } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AdminSection, BusinessHours, IntakeObjective } from './types';

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday: { isOpen: true, start: '08:00', end: '18:00' },
  tuesday: { isOpen: true, start: '08:00', end: '18:00' },
  wednesday: { isOpen: true, start: '08:00', end: '18:00' },
  thursday: { isOpen: true, start: '08:00', end: '18:00' },
  friday: { isOpen: true, start: '08:00', end: '18:00' },
  saturday: { isOpen: false, start: '09:00', end: '14:00' },
  sunday: { isOpen: false, start: '09:00', end: '14:00' },
};

export const DEFAULT_CHAT_OBJECTIVES: IntakeObjective[] = [
  { id: 'zipcode', label: 'Zip code', description: 'Ask for zip/postal code to validate service area', enabled: true },
  { id: 'name', label: 'Name', description: 'Capture the customer name', enabled: true },
  { id: 'phone', label: 'Phone', description: 'Collect phone for confirmations', enabled: true },
  { id: 'serviceType', label: 'Service type', description: 'Which service they want to book', enabled: true },
  { id: 'serviceDetails', label: 'Service details', description: 'Extra info (rooms, size, notes)', enabled: true },
  { id: 'date', label: 'Date & time', description: 'Pick a date/time slot from availability', enabled: true },
  { id: 'address', label: 'Address', description: 'Full address with street, unit, city, state', enabled: true },
];

export interface SidebarMenuItem {
  id: AdminSection;
  title: string;
  description: string;
  icon: LucideIcon;
  group: SidebarGroupId;
}

export type SidebarGroupId = 'workspace' | 'growth' | 'content' | 'channels' | 'system' | 'production';

export interface SidebarGroupDefinition {
  id: SidebarGroupId;
  title: string;
}

export const SIDEBAR_GROUPS: SidebarGroupDefinition[] = [
  { id: 'workspace', title: 'Workspace' },
  { id: 'growth', title: 'Growth & Sales' },
  { id: 'content', title: 'Content & Website' },
  { id: 'channels', title: 'Digital Presence' },
  { id: 'system', title: 'System' },
  { id: 'production', title: 'Production' },
];

export const SIDEBAR_MENU_ITEMS: SidebarMenuItem[] = [
  { id: 'dashboard', title: 'Dashboard', description: 'Performance snapshot for leads, chat and growth', icon: LayoutDashboard, group: 'workspace' },
  { id: 'company', title: 'Company Infos', description: 'Business details, contact info and operating hours', icon: Building2, group: 'workspace' },
  { id: 'users', title: 'Users', description: 'Manage admin and team member accounts', icon: Users, group: 'workspace' },
  { id: 'leads', title: 'Leads', description: 'All captured leads with ratings and follow-up status', icon: Sparkles, group: 'growth' },
  { id: 'forms', title: 'Forms', description: 'Manage lead capture forms — questions, scoring, and thresholds', icon: ClipboardList, group: 'growth' },
  { id: 'estimates', title: 'Estimates', description: 'Client proposals with shareable links', icon: Receipt, group: 'growth' },
  { id: 'presentations', title: 'Presentations', description: 'Build AI-powered slide decks and share them as immersive fullscreen experiences.', icon: Presentation, group: 'growth' },
  { id: 'website', title: 'Website', description: 'Customize homepage content and sections', icon: Image, group: 'content' },
  { id: 'portfolio', title: 'Portfolio', description: 'Services shown on the portfolio page — drag to reorder, click to edit', icon: Briefcase, group: 'content' },
  { id: 'pages', title: 'Pages', description: 'Build managed pages at any /slug — composable sections, no code.', icon: LayoutPanelLeft, group: 'content' },
  { id: 'blog', title: 'Blog', description: 'Articles, drafts and SEO-optimized content', icon: FileText, group: 'content' },
  { id: 'faqs', title: 'FAQs', description: 'Questions and answers shown on the FAQ page', icon: HelpCircle, group: 'content' },
  { id: 'seo', title: 'SEO', description: 'Meta tags, sitemap and analytics configuration', icon: Search, group: 'content' },
  // { id: 'chat', title: 'Chat', description: 'AI assistant conversations and response settings', icon: MessageSquare },
  { id: 'links', title: 'Links Page', description: 'Bio links and social media profiles', icon: Link, group: 'channels' },
  { id: 'vcards', title: 'VCards', description: 'Digital business cards for your team', icon: Smartphone, group: 'channels' },
  { id: 'skaleHub', title: 'Skale Hub', description: 'Manage weekly lives, registration gates, and active session access.', icon: RadioTower, group: 'channels' },
  { id: 'integrations', title: 'Integrations', description: 'Connect external services — AI, CRM, communication', icon: Puzzle, group: 'system' },
  { id: 'notifications', title: 'Notifications', description: 'Configure notification templates for SMS and Telegram alerts.', icon: Bell, group: 'system' },
  { id: 'traffic', title: 'Traffic', description: 'Analytics for visits, sources, campaigns, and conversions.', icon: TrendingUp, group: 'system' },
  { id: 'vectorizer', title: 'Logo Vectorizer', description: 'Convert PNG / JPEG logos into clean SVG (Figma, Illustrator, Fusion 360) and 3MF.', icon: Shapes, group: 'production' },
  // { id: 'redirects', title: 'Redirects', description: 'Short vanity links — /meet → your Meet URL, etc.', icon: Link2 },
];
