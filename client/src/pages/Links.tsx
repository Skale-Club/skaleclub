import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  ExternalLink,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  Globe,
  Mail,
  Github,
  Facebook,
  Send,
} from "lucide-react";
import * as LucideIcons from 'lucide-react';
import type { LinksPageLink } from '@shared/schema';
import { useTranslation } from "@/hooks/useTranslation";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettingsData } from "@/components/admin/shared/types";
import { Loader2 } from '@/components/ui/loader';
import { buildPagePaths } from "@shared/pageSlugs";

const iconMap: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-6 h-6" />,
  linkedin: <Linkedin className="w-6 h-6" />,
  twitter: <Twitter className="w-6 h-6" />,
  x: <Twitter className="w-6 h-6" />,
  youtube: <Youtube className="w-6 h-6" />,
  github: <Github className="w-6 h-6" />,
  facebook: <Facebook className="w-6 h-6" />,
  telegram: <Send className="w-6 h-6" />,
  email: <Mail className="w-6 h-6" />,
  website: <Globe className="w-6 h-6" />,
};

const getSocialIcon = (platform: string) => {
  const p = platform.toLowerCase();
  return iconMap[p] || <ExternalLink className="w-6 h-6" />;
};

const getLinkIcon = (url: string) => {
  if (url.includes('mailto:')) return <Mail className="w-5 h-5 mr-3" />;
  if (url.includes('skale.club') || url.startsWith('/')) return <Globe className="w-5 h-5 mr-3" />;
  return <ExternalLink className="w-5 h-5 mr-3" />;
};

const renderLinkIcon = (link: LinksPageLink) => {
  if (link.iconType === 'lucide' && link.iconValue) {
    const Icon = (LucideIcons as any)[link.iconValue];
    if (Icon) return <Icon className="w-5 h-5 mr-3" />;
  }
  if (link.iconType === 'upload' && link.iconValue) {
    return (
      <img
        src={link.iconValue}
        alt=""
        className="w-5 h-5 mr-3 object-contain"
      />
    );
  }
  return getLinkIcon(link.url);
};

export default function Links() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings'],
  });
  const pagePaths = buildPagePaths(settings?.pageSlugs);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f1014] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const config = settings?.linksPageConfig || {
    avatarUrl: "/ghl-logo.webp",
    title: "Skale Club",
    description: "Data-Driven Marketing & Scalable Growth Solutions",
    links: [
      { title: "Skale Club Official Website", url: pagePaths.home, order: 0 },
      { title: "Book a Strategy Call", url: pagePaths.contact, order: 1 },
      { title: "View Our Portfolio", url: pagePaths.portfolio, order: 2 },
      { title: "Read Our Blog", url: pagePaths.blog, order: 3 }
    ],
    socialLinks: [
      { platform: "instagram", url: "#", order: 0 },
      { platform: "linkedin", url: "#", order: 1 },
      { platform: "twitter", url: "#", order: 2 },
      { platform: "youtube", url: "#", order: 3 },
      { platform: "email", url: "mailto:hello@skale.club", order: 4 }
    ]
  };

  return (
    <div className="min-h-screen bg-[#0f1014] text-white flex flex-col items-center py-16 px-4 sm:px-6 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        className="w-full max-w-md z-10 flex flex-col items-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Avatar className="w-28 h-28 border-4 border-white/10 shadow-xl mb-4">
          <AvatarImage src={config.avatarUrl} alt={config.title} className="object-cover" />
          <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">
            {config.title.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <h1 className="text-2xl font-bold mb-2 tracking-tight text-center">{config.title}</h1>
        <p className="text-gray-400 text-center mb-10 px-4 whitespace-pre-wrap">
          {config.description}
        </p>

        <div className="w-full space-y-4 mb-12">
          {[...config.links]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .filter((l) => l.visible !== false)
            .map((link, index) => (
              <motion.a
                key={link.id ?? index}
                href={link.url}
                target={link.url.startsWith('http') ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className="block w-full"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card className="p-4 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer flex items-center justify-between group rounded-xl">
                  <div className="flex items-center text-gray-100 group-hover:text-white transition-colors">
                    {renderLinkIcon(link)}
                    <span className="font-medium text-lg">{link.title}</span>
                  </div>
                </Card>
              </motion.a>
            ))}
        </div>

        <motion.div 
          className="flex flex-wrap justify-center gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          {config.socialLinks.map((social, index) => (
            <a
              key={index}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.platform}
              className="text-gray-400 hover:text-white transition-colors hover:scale-110 transform duration-200"
            >
              {getSocialIcon(social.platform)}
            </a>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
