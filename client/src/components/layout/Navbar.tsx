import { Link, useLocation } from "wouter";
import { useCart } from "@/context/CartContext";
import { ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";

export function Navbar() {
  const [location] = useLocation();
  const { items } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/services", label: "Services" },
    { href: "/admin", label: "Admin" },
  ];

  return (
    <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
      <div className="container-custom mx-auto">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-white/40 blur-[1px]"></div>
            </div>
            <span className="font-display font-bold text-2xl text-slate-900 tracking-tight">
              BlueSpring <span className="text-emerald-600 font-medium text-lg">cleaning</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/services" className="text-sm font-semibold text-slate-700 hover:text-emerald-600 transition-colors">Services</Link>
            <span className="text-sm font-semibold text-slate-700">Areas Served</span>
            <span className="text-sm font-semibold text-slate-700">FAQ</span>
            <span className="text-sm font-semibold text-slate-700">Gift Cards</span>
            <span className="text-sm font-semibold text-slate-700">Blog</span>
            
            <a href="tel:3033094226" className="px-4 py-2 bg-[#c8ff44] text-slate-900 font-bold rounded-full hover:bg-[#b8ef34] transition-all text-sm">
              (303) 309 4226
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-slate-600"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 py-4 px-4 space-y-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block text-base font-medium text-slate-600 hover:text-primary"
              onClick={() => setIsMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/booking" onClick={() => setIsMenuOpen(false)}>
            <div className="flex items-center gap-2 text-primary font-medium">
              <ShoppingBag className="w-5 h-5" />
              <span>Cart ({items.length})</span>
            </div>
          </Link>
        </div>
      )}
    </nav>
  );
}
