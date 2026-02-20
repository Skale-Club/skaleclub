import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/useTranslation";
import { Menu, X, User, LogOut, Phone } from "lucide-react";
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
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { MobileLanguageToggle } from "@/components/ui/MobileLanguageToggle";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { trackEvent } from "@/lib/analytics";

export function Navbar() {
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const displayPhone = companySettings?.companyPhone || "";
  const telPhone = displayPhone.replace(/\D/g, '');

  const navLinks = [
    { href: "/", label: t("Home") },
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
    <nav className="bg-[#1c1e24]/85 backdrop-blur-md fixed top-0 left-0 right-0 z-50">
      <div className="container-custom mx-auto">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 min-h-[40px] min-w-[54px]">
            {companySettings?.logoMain ? (
              <img
                src={companySettings.logoMain}
                alt={companySettings.companyName || ''}
                className="h-auto w-[54px] object-contain p-1.5"
              />
            ) : (
              companySettings?.companyName ? (
                <span className="text-white font-semibold">{companySettings.companyName}</span>
              ) : null
            )}
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {/* Language Toggle */}
            <LanguageToggle />

            {/* Phone Button */}
            {displayPhone && (
              <a
                href={`tel:${telPhone}`}
                onClick={() => trackEvent('click_call', { location: 'navbar', label: displayPhone })}
                className="px-4 py-2 bg-[#406EF1] hover:bg-[#355CD0] text-white font-bold rounded-full hover-elevate transition-all text-sm flex items-center gap-2"
              >
                <Phone className="w-4 h-4 fill-current" />
                {displayPhone}
              </a>
            )}

            {/* User Login/Profile — fixed-size wrapper prevents layout shift */}
            <div className="w-10 h-10 flex items-center justify-center">
              {!isLoading && (
                isAuthenticated && user ? (
                  <DropdownMenu modal={false}>
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
                        <DropdownMenuItem
                          asChild
                          className="cursor-pointer data-[highlighted]:bg-slate-100 data-[highlighted]:text-[#1D1D1D]"
                        >
                          <Link href="/admin" className="w-full flex items-center" data-testid="link-admin">
                            <User className="mr-2 h-4 w-4" />
                            {t("Admin Panel")}
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => logout()}
                        data-testid="button-logout"
                        className="text-[#1D1D1D] focus:text-[#1D1D1D] data-[highlighted]:bg-slate-100 data-[highlighted]:text-[#1D1D1D] cursor-pointer"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        {t("Logout")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Link
                    href="/admin/login"
                    className="text-sm font-semibold text-white bg-transparent border border-white/40 px-4 py-2 rounded-full hover:bg-white/10 transition-colors"
                    data-testid="button-login"
                  >
                    {t("Login")}
                  </Link>
                )
              )}
            </div>
          </div>

          {/* Mobile Right Actions */}
          <div className="flex md:hidden items-center gap-3">
            <div className="scale-90 origin-right">
              <LanguageToggle />
            </div>
            <button
              className="p-2 -mr-2 text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 py-6 px-6 flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-5">
            {navLinks.map((link) => {
              const isHashLink = link.href.startsWith("/#");
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
                        {t("Admin Panel")}
                      </Link>
                    )}
                    <button
                      onClick={() => { setIsMenuOpen(false); logout(); }}
                      className="flex items-center gap-2 text-base font-semibold text-slate-500 hover:text-red-500 transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                      {t("Logout")}
                    </button>
                  </div>
                </div>
              ) : (
                <Link
                  href="/admin/login"
                  className="flex items-center gap-3 text-lg font-bold text-primary hover:opacity-80 transition-opacity"
                  data-testid="button-mobile-login"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <User className="w-6 h-6" />
                  {t("Login")}
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
