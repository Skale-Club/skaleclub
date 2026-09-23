// Quick 260906-qwl — opt-in dark styling for managed landing sections.
// `undefined` and "light" both mean "render exactly as before this task".
// Never use a `dark:` Tailwind variant here: ThemeContext forces the `dark`
// class on the whole public site, which would restyle every landing at once.
import { z } from "zod";

export const sectionThemeSchema = z.enum(["light", "dark"]).optional();
export type SectionTheme = z.infer<typeof sectionThemeSchema>;

// One navy surface for every dark section (the NFC pages), matching the
// /portfolio page instead of the old neutral #0f1014 / #111 mix. Sections sit
// on the same colour and are told apart by spacing and hairlines, so the page
// reads as one surface.
export const DARK_SURFACE = "bg-[#0a1428]";
export const DARK_HAIRLINE = "border-[rgba(180,192,216,0.14)]";
