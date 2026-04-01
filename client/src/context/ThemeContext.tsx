import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { isXpotContext } from '@/lib/xpot';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isAdminArea: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'skale-club-admin-theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'light';
}

function isInAdminArea(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/admin');
}

function isInXpotArea(): boolean {
  if (typeof window === 'undefined') return false;
  return isXpotContext(window.location.pathname, window.location.hostname);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  const [isAdminArea, setIsAdminArea] = useState(() => isInAdminArea());
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    // Always dark in Xpot area
    if (isInXpotArea()) return 'dark';
    // Only apply stored theme in admin area
    if (!isInAdminArea()) return 'light';
    const stored = getStoredTheme();
    return stored === 'system' ? getSystemTheme() : stored;
  });

  const applyTheme = useCallback((newTheme: 'light' | 'dark', forceAdmin = false) => {
    const inAdmin = forceAdmin || isInAdminArea();
    const inXpot = isInXpotArea();
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    // Dark theme in admin area (user-controlled) or always dark in Xpot area
    const themeToApply = inXpot ? 'dark' : inAdmin ? newTheme : 'light';
    root.classList.add(themeToApply);
    setResolvedTheme(themeToApply);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);

    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;
    applyTheme(resolved, true);
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  // Check for admin area on route changes
  useEffect(() => {
    const checkAdminArea = () => {
      const inAdmin = isInAdminArea();
      setIsAdminArea(inAdmin);

      if (inAdmin) {
        const resolved = theme === 'system' ? getSystemTheme() : theme;
        applyTheme(resolved, true);
      } else if (isInXpotArea()) {
        // Always dark mode in Xpot area
        applyTheme('dark', false);
      } else {
        // Always light mode on frontend
        applyTheme('light', false);
      }
    };

    // Initial check
    checkAdminArea();

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', checkAdminArea);

    // Use MutationObserver to detect SPA navigation
    const observer = new MutationObserver(() => {
      checkAdminArea();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('popstate', checkAdminArea);
      observer.disconnect();
    };
  }, [theme, applyTheme]);

  // Handle system theme changes (only in admin)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === 'system' && isAdminArea) {
        applyTheme(e.matches ? 'dark' : 'light', true);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, isAdminArea, applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme, isAdminArea }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
