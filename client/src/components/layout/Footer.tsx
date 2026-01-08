import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";

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
          <p className="text-slate-400 max-w-sm">
            Professional cleaning services. 
            We provide upfront pricing and easy online booking for your convenience.
          </p>
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
      <div className="container-custom mx-auto mt-6 pt-6 border-t border-slate-800 text-center text-slate-500 text-sm">
        © {new Date().getFullYear()} Skleanings Services. All rights reserved.
      </div>
    </footer>
  );
}
