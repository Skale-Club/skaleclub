// Quick 260906-qwl — opt-in dark styling for managed landing sections.
// `undefined` and "light" both mean "render exactly as before this task".
// Never use a `dark:` Tailwind variant here: ThemeContext forces the `dark`
// class on the whole public site, which would restyle every landing at once.
import { z } from "zod";

export const sectionThemeSchema = z.enum(["light", "dark"]).optional();
export type SectionTheme = z.infer<typeof sectionThemeSchema>;
