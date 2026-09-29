// Opt-in dark styling for managed landing sections.
// `undefined` and "light" both mean the light variant.
// Never use a `dark:` Tailwind variant here: ThemeContext forces the `dark`
// class on the whole public site, which would restyle every landing at once.
import { z } from "zod";

export const sectionThemeSchema = z.enum(["light", "dark"]).optional();
export type SectionTheme = z.infer<typeof sectionThemeSchema>;

// Editorial-kit tokens (tailwind.config.ts). Sections sit on the same navy
// surface and are told apart by spacing and hairlines.
export const DARK_SURFACE = "bg-navy-950";
export const DARK_HAIRLINE = "border-white/10";
