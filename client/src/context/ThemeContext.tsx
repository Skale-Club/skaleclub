import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

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
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'dark';
}

function isInAdminArea(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/admin');
}

function isInAdminThemeArea(): boolean {
  if (typeof window === 'undefined') return false;

  const { pathname } = window.location;
  if (!pathname.startsWith('/admin')) return false;

  return pathname !== '/admin/login' && pathname !== '/admin/signup';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  const [isAdminArea, setIsAdminArea] = useState(() => isInAdminThemeArea());
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    // Site-wide default: dark. Admin themeable area can override via stored pref.
    if (!isInAdminThemeArea()) return 'dark';
    const stored = getStoredTheme();
    return stored === 'system' ? getSystemTheme() : stored;
  });

  const applyTheme = useCallback((newTheme: 'light' | 'dark', forceAdmin = false) => {
    const inAdmin = forceAdmin || isInAdminThemeArea();
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    // Site-wide default: dark. Only admin themeable area can flip to light
    // (via user preference). Everything else stays dark.
    const themeToApply: 'light' | 'dark' = inAdmin ? newTheme : 'dark';

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
      const inAdmin = isInAdminThemeArea();
      setIsAdminArea(inAdmin);

      if (inAdmin) {
        const resolved = theme === 'system' ? getSystemTheme() : theme;
        applyTheme(resolved, true);
      } else {
        // Site-wide default: dark everywhere outside admin themeable area.
        applyTheme('dark', false);
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
