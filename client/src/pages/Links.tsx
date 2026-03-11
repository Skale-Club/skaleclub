import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExternalLink, Instagram, Linkedin, Twitter, Youtube, Globe, Mail } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function Links() {
  const { t } = useTranslation();

  const links = [
    {
      title: "Skale Club Official Website",
      url: "https://skale.club",
      icon: <Globe className="w-5 h-5 mr-3" />,
    },
    {
      title: "Book a Strategy Call",
      url: "https://skale.club/contact",
      icon: <ExternalLink className="w-5 h-5 mr-3" />,
    },
    {
      title: "View Our Portfolio",
      url: "https://skale.club/portfolio",
      icon: <ExternalLink className="w-5 h-5 mr-3" />,
    },
    {
      title: "Read Our Blog",
      url: "https://skale.club/blog",
      icon: <ExternalLink className="w-5 h-5 mr-3" />,
    }
  ];

  const socialLinks = [
    {
      icon: <Instagram className="w-6 h-6" />,
      url: "#", // Replace with actual
      label: "Instagram"
    },
    {
      icon: <Linkedin className="w-6 h-6" />,
      url: "#", // Replace with actual
      label: "LinkedIn"
    },
    {
      icon: <Twitter className="w-6 h-6" />,
      url: "#", // Replace with actual
      label: "Twitter"
    },
    {
      icon: <Youtube className="w-6 h-6" />,
      url: "#", // Replace with actual
      label: "YouTube"
    },
    {
      icon: <Mail className="w-6 h-6" />,
      url: "mailto:hello@skale.club", 
      label: "Email"
    }
  ];

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
          <AvatarImage src="/attached_assets/ghl-logo.webp" alt="Skale Club" className="object-cover" />
          <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">SC</AvatarFallback>
        </Avatar>

        <h1 className="text-2xl font-bold mb-2 tracking-tight">Skale Club</h1>
        <p className="text-gray-400 text-center mb-10 px-4">
          Data-Driven Marketing & Scalable Growth Solutions
        </p>

        <div className="w-full space-y-4 mb-12">
          {links.map((link, index) => (
            <motion.a
              key={index}
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
                  {link.icon}
                  <span className="font-medium text-lg">{link.title}</span>
                </div>
              </Card>
            </motion.a>
          ))}
        </div>

        <motion.div 
          className="flex justify-center gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          {socialLinks.map((social, index) => (
            <a
              key={index}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
              className="text-gray-400 hover:text-white transition-colors hover:scale-110 transform duration-200"
            >
              {social.icon}
            </a>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
