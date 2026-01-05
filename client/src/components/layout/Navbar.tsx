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
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-display font-bold text-xl text-slate-900 tracking-tight">
              SparkleClean
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "text-sm font-medium transition-colors hover:text-primary",
                  location === link.href ? "text-primary" : "text-slate-600"
                )}
              >
                {link.label}
              </Link>
            ))}
            
            <Link href={items.length > 0 ? "/booking" : "/services"}>
              <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors group">
                <ShoppingBag className="w-6 h-6 text-slate-700 group-hover:text-primary transition-colors" />
                {items.length > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white transform translate-x-1 -translate-y-1">
                    {items.length}
                  </span>
                )}
              </button>
            </Link>
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
