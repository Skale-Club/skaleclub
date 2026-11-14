import { createContext, lazy, useContext, useEffect, useRef, type ComponentType, type ReactNode } from "react";

// Context to track initial app load state (the pre-React loader in index.html).
export const InitialLoadContext = createContext<{ isInitialLoad: boolean; markLoaded: () => void }>({
  isInitialLoad: true,
  markLoaded: () => { },
});

// Server-rendered page text (server/seo/content) that stands in for the loader
// on indexable pages so the raw HTML is never empty for crawlers.
const SEO_CONTENT_ID = "seo-content";

/** Removes everything index.html shows before React: the loader and the page text. */
export function clearInitialShell() {
  document.getElementById("initial-loader")?.remove();
  document.getElementById(SEO_CONTENT_ID)?.remove();
}

// Hook to hide initial loader after first page renders
function useHideInitialLoader() {
  const { isInitialLoad, markLoaded } = useContext(InitialLoadContext);
  const hasRun = useRef(false);

  useEffect(() => {
    if (isInitialLoad && !hasRun.current) {
      hasRun.current = true;
      // The route is mounted: its real content replaces the server summary.
      document.getElementById(SEO_CONTENT_ID)?.remove();
      const loader = document.getElementById("initial-loader");
      if (loader) {
        loader.classList.add("loader-fade-out");
        setTimeout(() => {
          loader.remove();
          markLoaded();
        }, 150);
      } else {
        markLoaded();
      }
    }
  }, [isInitialLoad, markLoaded]);
}

// Wrapper to call the hook when a lazy component mounts
export function PageWrapper({ children }: { children: ReactNode }) {
  useHideInitialLoader();
  return <>{children}</>;
}

/** React.lazy for a route component that also dismisses the initial loader once mounted. */
export function lazyPage(loader: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(() =>
    loader().then((m) => ({
      default: () => (
        <PageWrapper>
          <m.default />
        </PageWrapper>
      ),
    })),
  );
}
