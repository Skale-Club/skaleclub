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
  /** Transparent product cut-out (WebP), shown contained on the card's panel. */
  image: { src: string; alt: string };
}

export const PRODUCT_CARDS: readonly ProductCard[] = [
  {
    slug: "nfc-review-plaque",
    title: "NFC review plaque",
    description: "A plaque for your counter that opens your Google review page in one tap.",
    href: "/products/nfc-review-plaque",
    image: {
      src: "/nfc-plaque-pair.webp",
      alt: "Google Review and Instagram NFC plaques side by side",
    },
  },
  {
    slug: "nfc-keychains",
    title: "NFC keychains",
    description: "Custom keychains with your branding, plus a display to sell them at your counter.",
    // First level is the keychain landing; the guide (/nfc-guide) is its second
    // level, linked from there. /products/nfc-keychains 301s to the landing.
    href: "/nfc-keychains",
    image: {
      // Blender render of three real client keychains from their print files
      // ("3D Printing/Keychains/_render/render_keychains.py").
      src: "/nfc-keychains-trio.webp",
      alt: "Three custom NFC keychains made for businesses, with their logos in raised relief",
    },
  },
];
