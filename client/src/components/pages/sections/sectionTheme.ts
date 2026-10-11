// Opt-in dark styling for managed landing sections.
// `undefined` and "light" both mean the light variant.
// Never use a `dark:` Tailwind variant here: ThemeContext forces the `dark`
// class on the whole public site, which would restyle every landing at once.
export type SectionTheme = "light" | "dark" | undefined;

// Editorial-kit tokens (tailwind.config.ts). Sections sit on the same navy
// surface and are told apart by spacing and hairlines.
export const DARK_SURFACE = "bg-navy-950";
