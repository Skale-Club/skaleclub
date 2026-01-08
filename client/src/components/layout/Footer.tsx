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
    <footer className="bg-slate-900 text-slate-200 py-6">
      <div className="container-custom mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-2">
          <Link href="/" className="flex items-center gap-2 mb-4">
            {companySettings?.logoDark ? (
              <img 
                src={companySettings.logoDark} 
                alt={companySettings.companyName || "Skleanings"} 
                className="h-7 w-auto"
              />
            ) : companySettings?.logoIcon ? (
              <img 
                src={companySettings.logoIcon} 
                alt={companySettings.companyName || "Skleanings"} 
                className="h-7 w-auto brightness-0 invert"
              />
            ) : (
              <img 
                src="https://storage.googleapis.com/msgsndr/q6UKnlWOQwyTk82yZPAs/media/695dbac289c99d91ea25f488.svg" 
                alt="Skleanings" 
                className="h-7 w-auto brightness-0 invert"
              />
            )}
          </Link>
          <p className="text-slate-400 max-w-sm mb-6">
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
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
        
        <div>
          <h4 className="font-bold text-white mb-4">Services</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link href="/services" className="hover:text-primary">Home Cleaning</Link></li>
            <li><Link href="/services" className="hover:text-primary">Carpet Cleaning</Link></li>
            <li><Link href="/services" className="hover:text-primary">Upholstery</Link></li>
            <li><Link href="/services" className="hover:text-primary">Move-in/Move-out</Link></li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-bold text-white mb-4">Company</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link href="/about" className="hover:text-primary">About Us</Link></li>
            <li><Link href="/contact" className="hover:text-primary">Contact</Link></li>
            <li><Link href="/admin" className="hover:text-primary">Admin Login</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-custom mx-auto mt-6 pt-6 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} Skleanings Services. All rights reserved.</p>
        <div className="flex gap-6">
          <Link href="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link>
          <Link href="/terms-of-service" className="hover:text-primary transition-colors">Terms of Service</Link>
        </div>
      </div>
    </footer>
  );
}
