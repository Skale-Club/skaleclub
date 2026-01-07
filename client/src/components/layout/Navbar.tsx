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
            <img 
              src="https://storage.googleapis.com/msgsndr/q6UKnlWOQwyTk82yZPAs/media/695dbac289c99d91ea25f488.svg" 
              alt="Skleanings" 
              className="h-12 w-auto"
            />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/services" className="text-sm font-semibold text-[#1D1D1D] hover:text-primary transition-colors">Services</Link>
            <span className="text-sm font-semibold text-[#1D1D1D]">Areas Served</span>
            <span className="text-sm font-semibold text-[#1D1D1D]">FAQ</span>
            <span className="text-sm font-semibold text-[#1D1D1D]">Gift Cards</span>
            <span className="text-sm font-semibold text-[#1D1D1D]">Blog</span>
            
            <a href="tel:3033094226" className="px-4 py-2 bg-secondary text-secondary-foreground font-bold rounded-full hover-elevate transition-all text-sm">
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
