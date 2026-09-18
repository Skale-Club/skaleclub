import { useBrowserLocation } from "wouter/use-browser-location";
import type { BaseLocationHook } from "wouter";
import { splitLanguagePath, withLanguage } from "@shared/languagePath";

// Read from the URL at call time (never the context) so a PT-only page such as
// /grupo can't leak a `/br` prefix into its outgoing links.
const currentLanguage = () => splitLanguagePath(window.location.pathname).language;

// Routes see the path without its `/br` prefix; navigation re-appends it while in pt.
export const useLanguageLocation: BaseLocationHook = (router) => {
  const [rawPath, navigate] = useBrowserLocation(router);
  return [
    splitLanguagePath(rawPath).path,
    (to: string, options?: { replace?: boolean; state?: unknown }) =>
      navigate(withLanguage(to, currentLanguage()), options),
  ];
};

export const languageHref = (href: string) => withLanguage(href, currentLanguage());
