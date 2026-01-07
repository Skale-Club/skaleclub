import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-200 py-12">
      <div className="container-custom mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-2">
          <Link href="/" className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-white/40 blur-[1px]"></div>
            </div>
            <span className="font-display font-bold text-2xl text-white tracking-tight">
              BlueSpring <span className="text-emerald-400 font-medium text-lg">cleaning</span>
            </span>
          </Link>
          <p className="text-slate-400 max-w-sm">
            Professional cleaning services in Denver, CO. 
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
      <div className="container-custom mx-auto mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
        © {new Date().getFullYear()} BlueSpring Cleaning Services. All rights reserved.
      </div>
    </footer>
  );
}
