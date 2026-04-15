import { Building2, Briefcase, ClipboardList, FileText, HelpCircle, Image, LayoutDashboard, Link, MessageSquare, Puzzle, Search, Sparkles, Users, Smartphone, MapPinned } from 'lucide-react';
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
}

export const SIDEBAR_MENU_ITEMS: SidebarMenuItem[] = [
  { id: 'dashboard', title: 'Dashboard', description: 'Performance snapshot for leads, chat and growth', icon: LayoutDashboard },
  { id: 'company', title: 'Company Infos', description: 'Business details, contact info and operating hours', icon: Building2 },
  { id: 'website', title: 'Website', description: 'Customize homepage content and sections', icon: Image },
  { id: 'portfolio', title: 'Portfolio', description: 'Services shown on the portfolio page — drag to reorder, click to edit', icon: Briefcase },
  { id: 'leads', title: 'Leads', description: 'All captured leads with ratings and follow-up status', icon: Sparkles },
  { id: 'forms', title: 'Forms', description: 'Manage lead capture forms — questions, scoring, and thresholds', icon: ClipboardList },
  { id: 'chat', title: 'Chat', description: 'AI assistant conversations and response settings', icon: MessageSquare },
  { id: 'faqs', title: 'FAQs', description: 'Questions and answers shown on the FAQ page', icon: HelpCircle },
  { id: 'users', title: 'Users', description: 'Manage admin and team member accounts', icon: Users },
  { id: 'blog', title: 'Blog', description: 'Articles, drafts and SEO-optimized content', icon: FileText },
  { id: 'seo', title: 'SEO', description: 'Meta tags, sitemap and analytics configuration', icon: Search },
  { id: 'integrations', title: 'Integrations', description: 'Connect external services — AI, CRM, communication', icon: Puzzle },
  { id: 'links', title: 'Links Page', description: 'Bio links and social media profiles', icon: Link },
  { id: 'vcards', title: 'VCards', description: 'Digital business cards for your team', icon: Smartphone },
  { id: 'fieldSales', title: 'Xpot', description: 'Field sales check-ins, visits and rep tracking', icon: MapPinned },
];
