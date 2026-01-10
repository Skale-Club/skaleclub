import { Link, useLocation } from "wouter";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/use-auth";
import { ShoppingBag, Menu, X, User, LogOut, Phone } from "lucide-react";
import { useState, useCallback } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";

export function Navbar() {
  const [location] = useLocation();
  const { items } = useCart();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const displayPhone = companySettings?.companyPhone || "(303) 309 4226";
  const telPhone = displayPhone.replace(/\D/g, '');

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/services", label: "Services" },
    { href: "/#areas-served", label: "Areas Served" },
    { href: "/blog", label: "Blog" },
    { href: "/faq", label: "FAQ" },
  ];

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  const handleHashNavigation = useCallback((hash: string) => {
    if (location === '/') {
      // Already on home page, just scroll to the element
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // Navigate to home page first, then scroll after page loads
      window.location.href = `/#${hash}`;
    }
  }, [location]);

  return (
    <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
      <div className="container-custom mx-auto">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            {companySettings?.logoMain ? (
              <img 
                src={companySettings.logoMain} 
                alt={companySettings.companyName || "Skleanings"} 
                className="h-[30px] md:h-10 w-auto"
              />
            ) : (
              <img 
                src="https://storage.googleapis.com/msgsndr/q6UKnlWOQwyTk82yZPAs/media/695dbac289c99d91ea25f488.svg" 
                alt="Skleanings" 
                className="h-[30px] md:h-10 w-auto"
              />
            )}
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="/services" className="text-sm font-semibold text-[#1D1D1D] hover:text-primary transition-colors cursor-pointer">Services</a>
            <button
              onClick={() => handleHashNavigation('areas-served')}
              className="text-sm font-semibold text-[#1D1D1D] hover:text-primary transition-colors cursor-pointer"
            >
              Areas Served
            </button>
            <a href="/blog" className="text-sm font-semibold text-[#1D1D1D] hover:text-primary transition-colors cursor-pointer">Blog</a>
            <a href="/faq" className="text-sm font-semibold text-[#1D1D1D] hover:text-primary transition-colors cursor-pointer">FAQ</a>
            
            <a href={`tel:${telPhone}`} className="px-4 py-2 bg-secondary text-secondary-foreground font-bold rounded-full hover-elevate transition-all text-sm flex items-center gap-2">
              <Phone className="w-4 h-4 fill-current" />
              {displayPhone}
            </a>

            {/* User Login/Profile */}
            {!isLoading && (
              isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid="button-user-menu">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || 'User'} />
                        <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white border border-gray-100 shadow-lg">
                    <div className="px-2 py-2 border-b border-gray-100 mb-1">
                      <p className="font-medium text-sm leading-none">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-none">{user.email}</p>
                    </div>
                    {user.isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer w-full flex items-center" data-testid="link-admin">
                          <User className="mr-2 h-4 w-4" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => logout()} data-testid="button-logout" className="text-[#1D1D1D] focus:text-[#1D1D1D] focus:bg-accent cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button 
                  onClick={() => window.location.href = '/api/login'}
                  className="text-sm font-semibold text-[#1D1D1D] hover:text-primary transition-colors"
                  data-testid="button-login"
                >
                  Login
                </button>
              )
            )}
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
        <div className="md:hidden bg-white border-b border-gray-100 py-6 px-6 flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-5">
            {navLinks.map((link) => {
              const isHashLink = link.href.startsWith("/#");
              const isExternal = link.href === "/services";
              const Content = (
                <span className="text-lg font-semibold text-slate-700 hover:text-primary transition-colors">
                  {link.label}
                </span>
              );

              if (isHashLink) {
                const hash = link.href.replace("/#", "");
                return (
                  <button
                    key={link.href}
                    className="block text-left"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleHashNavigation(hash);
                    }}
                  >
                    {Content}
                  </button>
                );
              }
              if (isExternal) {
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    className="block"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {Content}
                  </a>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {Content}
                </Link>
              );
            })}
          </div>

          <div className="pt-6 border-t border-gray-100 flex flex-col gap-6">
            <Link href="/booking" onClick={() => setIsMenuOpen(false)}>
              <div className="flex items-center gap-3 text-primary font-bold text-lg">
                <ShoppingBag className="w-6 h-6" />
                <span>Cart ({items.length})</span>
              </div>
            </Link>
            
            {/* Mobile Login/User */}
            {!isLoading && (
              isAuthenticated && user ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                      <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || 'User'} />
                      <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-slate-900 leading-none text-base">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-slate-500 mt-1">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 px-1">
                    {user.isAdmin && (
                      <Link 
                        href="/admin" 
                        className="text-base font-semibold text-slate-700 hover:text-primary transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Admin Panel
                      </Link>
                    )}
                    <button 
                      onClick={() => { setIsMenuOpen(false); logout(); }}
                      className="flex items-center gap-2 text-base font-semibold text-slate-500 hover:text-red-500 transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => window.location.href = '/api/login'}
                  className="flex items-center gap-3 text-lg font-bold text-primary hover:opacity-80 transition-opacity"
                  data-testid="button-mobile-login"
                >
                  <User className="w-6 h-6" />
                  Login
                </button>
              )
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
