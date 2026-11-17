import { Facebook, Github, Instagram, Linkedin, Twitch, Twitter, Youtube } from "@/components/ui/brand-icons";
import type { SiteIcon } from "@/components/ui/brand-icons";
import {
  // social
  Send, Rss, Share2, Hash, AtSign, Music, Podcast,
  // contact
  Phone, PhoneCall, Mail, MessageCircle, MessageSquare, MapPin, Map, Navigation, Globe, Link, ExternalLink, Calendar, CalendarCheck, Clock, User, Users, Contact, QrCode,
  // commerce
  ShoppingCart, ShoppingBag, Store, Tag, Gift, CreditCard, Wallet, DollarSign, Percent, Package, Truck, Receipt, BadgePercent, Ticket,
  // media
  Video, Camera, Image, Film, Mic, Headphones, Play, Newspaper, BookOpen, Radio, Tv, Clapperboard,
  // business
  Briefcase, Building, Building2, Handshake, TrendingUp, BarChart3, PieChart, Target, Rocket, Award, Trophy, Star, Heart, ThumbsUp, Lightbulb, Zap, Shield, ShieldCheck, FileText, Download, Megaphone, Sparkles, Laptop, Smartphone, Code,
  // travel
  Plane, Hotel, Bed, Luggage, Compass, Palmtree, Umbrella, Ship, Bus, Train, Tent, Mountain,
  // food
  Utensils, UtensilsCrossed, Coffee, Pizza, Beer, Wine, IceCream, Cake, Cookie, Soup, Sandwich, Croissant,
  // real estate
  Home, Key, Sofa, Hammer, Wrench, Ruler, PaintBucket, Bath, Fence,
  // beauty / barber
  Scissors, Brush, Flower2, Gem, Crown, Smile, Eye, Droplets, Sun, Moon, Feather,
  // automotive
  Car, Bike, Fuel, CarFront, Gauge, Settings, Cog,
  // health
  Stethoscope, Pill, Syringe, Activity, HeartPulse, Dumbbell, Apple, Cross, Baby, Dog, Cat,
  // education
  GraduationCap, School, Library, Book, Pencil, NotebookPen, Brain, Languages, Microscope,
  // events
  PartyPopper, Music2, Guitar, Drama, Presentation, Mic2, CalendarDays,
} from "lucide-react";

/** Curated UI and brand icons offered for /links buttons. */
export const LINK_ICONS: Record<string, SiteIcon> = {
  Instagram, Facebook, Youtube, Linkedin, Twitter, Github, Twitch, Send, Rss, Share2, Hash, AtSign, Music, Podcast,
  Phone, PhoneCall, Mail, MessageCircle, MessageSquare, MapPin, Map, Navigation, Globe, Link, ExternalLink, Calendar, CalendarCheck, Clock, User, Users, Contact, QrCode,
  ShoppingCart, ShoppingBag, Store, Tag, Gift, CreditCard, Wallet, DollarSign, Percent, Package, Truck, Receipt, BadgePercent, Ticket,
  Video, Camera, Image, Film, Mic, Headphones, Play, Newspaper, BookOpen, Radio, Tv, Clapperboard,
  Briefcase, Building, Building2, Handshake, TrendingUp, BarChart3, PieChart, Target, Rocket, Award, Trophy, Star, Heart, ThumbsUp, Lightbulb, Zap, Shield, ShieldCheck, FileText, Download, Megaphone, Sparkles, Laptop, Smartphone, Code,
  Plane, Hotel, Bed, Luggage, Compass, Palmtree, Umbrella, Ship, Bus, Train, Tent, Mountain,
  Utensils, UtensilsCrossed, Coffee, Pizza, Beer, Wine, IceCream, Cake, Cookie, Soup, Sandwich, Croissant,
  Home, Key, Sofa, Hammer, Wrench, Ruler, PaintBucket, Bath, Fence,
  Scissors, Brush, Flower2, Gem, Crown, Smile, Eye, Droplets, Sun, Moon, Feather,
  Car, Bike, Fuel, CarFront, Gauge, Settings, Cog,
  Stethoscope, Pill, Syringe, Activity, HeartPulse, Dumbbell, Apple, Cross, Baby, Dog, Cat,
  GraduationCap, School, Library, Book, Pencil, NotebookPen, Brain, Languages, Microscope,
  PartyPopper, Music2, Guitar, Drama, Presentation, Mic2, CalendarDays,
};

/** Icon for a stored icon name, or undefined when it is not in the curated set. */
export function getLinkIcon(name: string | undefined | null): SiteIcon | undefined {
  return name ? LINK_ICONS[name] : undefined;
}
