import type { CompanySettings, PortfolioService } from "@shared/schema";

/**
 * Everything a template needs to draw a folder. Templates are pure presentation:
 * they receive this and render panels, and never fetch or decide business data.
 */
export interface FolderData {
  settings?: CompanySettings;
  /** Services chosen in the toolbar, in display order. */
  services: PortfolioService[];
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
    /** Logo that reads on a dark surface. */
    logoOnDark: string;
    /** Logo that reads on a light surface. */
    logoOnLight: string;
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
  /** Sheet 2 — the inside spread, read as one continuous surface. */
  Inside: (props: FolderData) => JSX.Element;
  /**
   * Background of each sheet, so the shell can paint the bleed area to match
   * the template instead of assuming white.
   */
  sheetBackground: { outside: string; inside: string };
}
