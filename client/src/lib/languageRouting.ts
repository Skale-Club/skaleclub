import { useBrowserLocation, usePathname } from "wouter/use-browser-location";
import { useRouter, type BaseLocationHook } from "wouter";
import { splitLanguagePath, withLanguage, type SiteLanguage } from "@shared/languagePath";

// In the browser the language is read from the URL at call time (never the
// context) so a PT-only page such as /grupo can't leak a `/br` prefix into its
// outgoing links. On the server there is no URL to read: the request path
// reaches wouter as the router's `ssrPath`.
const currentLanguage = (router?: { ssrPath?: string }): SiteLanguage =>
  splitLanguagePath(typeof window === "undefined" ? (router?.ssrPath ?? "/") : window.location.pathname).language;

// Blog posts exist in English only: /br/blog/<slug> redirects to /blog/<slug>, so links to a
// post skip the redirect and point at the English URL directly.
const UNTRANSLATED_PATH = /^\/blog\/[^/?#]+\/?(?:[?#].*)?$/;

// Routes see the path without its `/br` prefix; navigation re-appends it while in pt.
export const useLanguageLocation: BaseLocationHook = (router) => {
  const [rawPath, navigate] = useBrowserLocation(router);
  return [
    splitLanguagePath(rawPath).path,
    (to: string, options?: { replace?: boolean; state?: unknown }) =>
      navigate(UNTRANSLATED_PATH.test(to) ? to : withLanguage(to, currentLanguage()), options),
  ];
};

export const languageHref = (href: string, router?: { ssrPath?: string }) =>
  UNTRANSLATED_PATH.test(href) ? href : withLanguage(href, currentLanguage(router));

/**
 * The raw pathname, `/br` prefix included. Same as wouter's usePathname(), but it
 * resolves against the router's `ssrPath` when rendering on the server, where there
 * is no `window.location`.
 */
export function useRawPathname(): string {
  return usePathname({ ssrPath: useRouter().ssrPath });
}
