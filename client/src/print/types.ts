import type { CompanySettings } from "@shared/schema";
import type { FolderItem } from "./items";

/**
 * Everything a template needs to draw a folder. Templates are pure presentation:
 * they receive this and render panels, and never fetch or decide business data.
 */
export interface FolderData {
  settings?: CompanySettings;
  /**
   * The folder is a bi-fold: one sheet, one fold, four panels. Panel 1 is the
   * cover, panels 2 and 3 are the inside spread, panel 4 is the back.
   *
   * Apps and services are kept apart rather than merged into one list, because
   * the spread gives each its own panel: panel 2 is the app line-up, panel 3 is
   * the services. Templates that want everything together can concatenate.
   */
  apps: FolderItem[];
  services: FolderItem[];
  /** Millimetres of bleed on each side (0 disables crop marks). */
  bleed: number;
  /** Whether price/priceLabel are printed on the cards. */
  showPrices: boolean;
  /** Resolved company strings, pre-computed so every template agrees. */
  brand: {
    name: string;
    phone: string;
    email: string;
    address: string;
    siteUrl: string;
    siteLabel: string;
    /** Logo that reads on a dark surface — every template prints on navy. */
    logoOnDark: string;
    /**
     * The photo on the cover. Defaults to the site's hero image so the folder
     * shows the same face as the website, but it is chosen explicitly in the
     * toolbar: a brochure must never quietly go to print with whatever happens
     * to be in a settings field.
     */
    coverPhoto: string;
    heroTitle: string;
    heroSubtitle: string;
    ctaText: string;
    socialLinks: { platform: string; url: string }[];
  };
}

export interface FolderTemplate {
  id: string;
  /** Shown in the toolbar picker. */
  name: string;
  /** One line describing the visual idea, shown under the picker. */
  description: string;
  /** Sheet 1 — the outside: back cover (left panel) and front cover (right panel). */
  Outside: (props: FolderData) => JSX.Element;
  /** Sheet 2 — the inside spread: panel 2 (apps) on the left, panel 3 (services) on the right. */
  Inside: (props: FolderData) => JSX.Element;
  /**
   * Background of each sheet, so the shell can paint the bleed area to match
   * the template instead of assuming white.
   */
  sheetBackground: { outside: string; inside: string };
}
