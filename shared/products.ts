/**
 * The two products that live under /products, as /portfolio lists them.
 *
 * The pages themselves are DB-driven managed landings
 * (scripts/seed-products-landing.ts); this is only the card each one gets in
 * the portfolio's Products section and the navbar menu. Copy and image paths
 * mirror that seed. Keep them in step when the seed changes.
 */
export interface ProductCard {
  /** The /products/<slug> URL segment; see PRODUCT_ROUTES in landingSeo.ts. */
  slug: string;
  /** English keys; the UI passes them through t(). */
  title: string;
  description: string;
  href: string;
  /** Photo for the card; the plaque has no product shot yet, so it borrows the counter-tap scene. */
  image?: { src: string; alt: string };
}

export const PRODUCT_CARDS: readonly ProductCard[] = [
  {
    slug: "nfc-review-plaque",
    title: "NFC review plaque",
    description: "A plaque for your counter that opens your Google review page in one tap.",
    href: "/products/nfc-review-plaque",
    image: {
      src: "/nfc-guide/tap.webp",
      alt: "A customer tapping a phone on an NFC tag at a shop counter",
    },
  },
  {
    slug: "nfc-keychains",
    title: "NFC keychains",
    description: "Custom keychains with your branding, plus a display to sell them at your counter.",
    href: "/products/nfc-keychains",
    image: {
      src: "/nfc-guide/hero.webp",
      alt: "Three custom 3D-printed NFC keychains on a work table",
    },
  },
];
