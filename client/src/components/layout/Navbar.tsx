import { Link, useLocation } from "wouter";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/use-auth";
import { ShoppingBag, Menu, X, User, LogOut } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Navbar() {
  const [location] = useLocation();
  const { items } = useCart();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/services", label: "Services" },
  ];

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
      <div className="container-custom mx-auto">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <img 
              src="https://storage.googleapis.com/msgsndr/q6UKnlWOQwyTk82yZPAs/media/695dbac289c99d91ea25f488.svg" 
              alt="Skleanings" 
              className="h-10 w-auto"
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
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="flex-col items-start">
                      <span className="font-medium">{user.firstName} {user.lastName}</span>
                      <span className="text-sm text-muted-foreground">{user.email}</span>
                    </DropdownMenuItem>
                    {user.isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer" data-testid="link-admin">
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => logout()} data-testid="button-logout">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.location.href = '/api/login'}
                  data-testid="button-login"
                >
                  <User className="mr-2 h-4 w-4" />
                  Entrar
                </Button>
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
          
          {/* Mobile Login/User */}
          {!isLoading && (
            isAuthenticated && user ? (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || 'User'} />
                    <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                {user.isAdmin && (
                  <Link 
                    href="/admin" 
                    className="block text-base font-medium text-slate-600 hover:text-primary"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Admin Panel
                  </Link>
                )}
                <button 
                  onClick={() => { setIsMenuOpen(false); logout(); }}
                  className="flex items-center gap-2 text-base font-medium text-slate-600 hover:text-primary"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            ) : (
              <button 
                onClick={() => window.location.href = '/api/login'}
                className="flex items-center gap-2 text-base font-medium text-primary"
                data-testid="button-mobile-login"
              >
                <User className="w-5 h-5" />
                Entrar
              </button>
            )
          )}
        </div>
      )}
    </nav>
  );
}
