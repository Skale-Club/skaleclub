import { PRODUCT_CARDS } from "@shared/products";
import { nfcEntryPrice } from "@shared/nfc-price-lines";
import { NFC_PLAQUE_PRICES } from "@shared/nfc-plaque-pricing";

/**
 * The physical NFC products, as the folder prints them.
 *
 * Title, description and image come from PRODUCT_CARDS (the same cards
 * /portfolio shows), and every price is derived from the pricing modules the
 * order forms charge from, so the folder can never advertise a number the
 * form does not quote. Only the feature lines are print-specific: the site
 * spreads them over a whole landing page.
 */
export interface FolderProduct {
  key: string;
  title: string;
  description: string;
  /** Transparent cut-out (WebP), shown contained on a panel. */
  image: string;
  features: string[];
  price: { prefix: string; value: string; label: string };
}

const dollars = (cents: number) => `$${cents / 100}`;

const PRINT_DETAILS: Record<string, Pick<FolderProduct, "features" | "price">> = {
  "nfc-review-plaque": {
    features: ["NFC chip and QR code", "Google, Instagram or your logo", "No app required"],
    price: {
      prefix: "From",
      value: dollars(NFC_PLAQUE_PRICES.standardUnitCents),
      label: `each | 2 for ${dollars(NFC_PLAQUE_PRICES.standardPairCents)}`,
    },
  },
  "nfc-keychains": {
    features: ["Flat, raised relief or custom shape", "Display to sell at your counter", "No app required"],
    price: {
      prefix: "From",
      value: nfcEntryPrice().en,
      label: `each | ${nfcEntryPrice().minimum}-piece minimum`,
    },
  },
};

export const FOLDER_PRODUCTS: FolderProduct[] = PRODUCT_CARDS.map((card) => ({
  key: `nfc:${card.slug}`,
  title: card.title,
  description: card.description,
  image: card.image.src,
  ...(PRINT_DETAILS[card.slug] ?? { features: [], price: { prefix: "", value: "", label: "" } }),
}));
