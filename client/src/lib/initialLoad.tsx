import { createContext, lazy, useContext, useEffect, useRef, type ComponentType, type ReactNode } from "react";

// Context to track initial app load state (the pre-React loader in index.html).
export const InitialLoadContext = createContext<{ isInitialLoad: boolean; markLoaded: () => void }>({
  isInitialLoad: true,
  markLoaded: () => { },
});

// Hook to hide initial loader after first page renders
function useHideInitialLoader() {
  const { isInitialLoad, markLoaded } = useContext(InitialLoadContext);
  const hasRun = useRef(false);

  useEffect(() => {
    if (isInitialLoad && !hasRun.current) {
      hasRun.current = true;
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
