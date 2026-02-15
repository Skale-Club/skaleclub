import { Building2, FileText, HelpCircle, Image, LayoutDashboard, MessageSquare, Puzzle, Search, Sparkles, Users } from 'lucide-react';
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
  icon: LucideIcon;
}

export const SIDEBAR_MENU_ITEMS: SidebarMenuItem[] = [
  { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard },
  { id: 'company', title: 'Company Infos', icon: Building2 },
  { id: 'hero', title: 'Website', icon: Image },
  { id: 'leads', title: 'Leads', icon: Sparkles },
  { id: 'chat', title: 'Chat', icon: MessageSquare },
  { id: 'faqs', title: 'FAQs', icon: HelpCircle },
  { id: 'users', title: 'Users', icon: Users },
  { id: 'blog', title: 'Blog', icon: FileText },
  { id: 'seo', title: 'SEO', icon: Search },
  { id: 'integrations', title: 'Integrations', icon: Puzzle },
];
