import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { 
  SiFacebook, 
  SiInstagram, 
  SiX, 
  SiYoutube, 
  SiLinkedin, 
  SiTiktok 
} from "react-icons/si";

const platformIcons: Record<string, any> = {
  facebook: SiFacebook,
  instagram: SiInstagram,
  twitter: SiX,
  x: SiX,
  youtube: SiYoutube,
  linkedin: SiLinkedin,
  tiktok: SiTiktok,
};

export function Footer() {
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  

  return (
    <footer className="bg-[#1F1F1F] text-slate-300 py-6 pt-[40px] pb-[40px]">
      <div className="container-custom mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-2">
          <Link href="/" className="flex items-center gap-2 mb-4">
            {companySettings?.logoDark ? (
              <img 
                src={companySettings.logoDark} 
                alt={companySettings.companyName || "Skleanings"} 
                className="h-auto w-[52px]"
              />
            ) : companySettings?.logoIcon ? (
              <img 
                src={companySettings.logoIcon} 
                alt={companySettings.companyName || "Skleanings"} 
                className="h-auto w-[52px] brightness-0 invert"
              />
            ) : (
              <img 
                src="https://storage.googleapis.com/msgsndr/q6UKnlWOQwyTk82yZPAs/media/695dbac289c99d91ea25f488.svg" 
                alt="Skleanings" 
                className="h-auto w-[52px] brightness-0 invert"
              />
            )}
          </Link>
          <p className="text-gray-400 max-w-sm mb-6 text-[14px]">
            Professional cleaning services. 
            We provide upfront pricing and easy online booking for your convenience.
          </p>
          
          {companySettings && (companySettings as any).socialLinks && Array.isArray((companySettings as any).socialLinks) && (companySettings as any).socialLinks.length > 0 && (
            <div className="flex gap-4">
              {((companySettings as any).socialLinks as {platform: string, url: string}[]).map((link, i) => {
                const Icon = platformIcons[link.platform.toLowerCase()] || SiFacebook;
                return (
                  <a 
                    key={i} 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
        
        
        <div>
          <h4 className="font-bold text-white mb-4">Company</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li><Link href="/about" className="hover:text-gray-200">About Us</Link></li>
            <li><Link href="/contact" className="hover:text-gray-200">Contact</Link></li>
            <li><Link href="/faq" className="hover:text-gray-200">FAQ</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-custom mx-auto mt-6 pt-6 border-t border-[#2A2A2A] flex flex-col md:flex-row justify-between items-center gap-4 text-gray-400 text-sm">
        <p>© {new Date().getFullYear()} Skleanings. All rights reserved.</p>
        <div className="flex gap-6">
          <Link href="/privacy-policy" className="text-gray-400 hover:text-gray-200 transition-colors">Privacy Policy</Link>
          <Link href="/terms-of-service" className="text-gray-400 hover:text-gray-200 transition-colors">Terms of Service</Link>
        </div>
      </div>
    </footer>
  );
}
