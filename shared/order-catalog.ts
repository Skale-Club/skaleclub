/**
 * Priced order forms: one catalogue per `FormConfig["pricing"].model`.
 *
 * The order widgets (product picker, quantity slider, price panel), the shared
 * quote helper and the server's completion handler all read the product list,
 * quantity range and price function through here, so a form only has to name
 * its model. Each product's numbers stay in its own pricing file.
 *
 * Imports only the two pricing files (no schema barrel), so it is safe in the
 * browser bundle.
 */
import {
  NFC_KEYCHAIN_TYPES,
  NFC_QUANTITY,
  quantityFromSliderPosition,
  quoteNfcOrder,
  sliderPositionFromQuantity,
  snapQuantity,
  type NfcQuote,
} from "./nfc-pricing.js";
import { NFC_PLAQUE_QUANTITY, NFC_PLAQUE_TYPES, quotePlaqueOrder, snapPlaqueQuantity } from "./nfc-plaque-pricing.js";

export const ORDER_PRICING_MODELS = ["nfc-keychain", "nfc-plaque"] as const;
export type OrderPricingModel = (typeof ORDER_PRICING_MODELS)[number];

export type OrderProductType = {
  id: string;
  label: string;
  description: string;
  quoteOnRequest?: boolean;
  /** Replaces the "from $x / unit" line on the picker card when the price is a rule, not a unit. */
  priceSummary?: string;
  active: boolean;
};

export type OrderCatalog = {
  model: OrderPricingModel;
  types: OrderProductType[];
  quantity: { min: number; max: number; step: number };
  /** English source words for the unit; the UI passes them through t(). */
  unit: { singular: string; plural: string; fewer: string; more: string };
  /** Whether "have you ordered before?" changes the price (the art fee). */
  usesReturningCustomer: boolean;
  snapQuantity(quantity: number): number;
  /** Quantity <-> slider position (0..1). */
  quantityFromPosition(position: number): number;
  positionFromQuantity(quantity: number): number;
  quote(input: { quantity: number; typeId?: string | null; isFirstOrder?: boolean }): NfcQuote;
};

const KEYCHAIN_CATALOG: OrderCatalog = {
  model: "nfc-keychain",
  types: NFC_KEYCHAIN_TYPES,
  quantity: NFC_QUANTITY,
  unit: { singular: "piece", plural: "pieces", fewer: "Fewer pieces", more: "More pieces" },
  usesReturningCustomer: true,
  snapQuantity,
  // Exponential track: most orders sit at the low end of 20..200.
  quantityFromPosition: quantityFromSliderPosition,
  positionFromQuantity: sliderPositionFromQuantity,
  quote: quoteNfcOrder,
};

const { min: PLAQUE_MIN, max: PLAQUE_MAX } = NFC_PLAQUE_QUANTITY;

const PLAQUE_CATALOG: OrderCatalog = {
  model: "nfc-plaque",
  types: NFC_PLAQUE_TYPES,
  quantity: NFC_PLAQUE_QUANTITY,
  unit: { singular: "plaque", plural: "plaques", fewer: "Fewer plaques", more: "More plaques" },
  usesReturningCustomer: false,
  snapQuantity: snapPlaqueQuantity,
  // Linear track: 1..10 is short enough that every stop gets equal travel.
  quantityFromPosition: (position) =>
    snapPlaqueQuantity(PLAQUE_MIN + (PLAQUE_MAX - PLAQUE_MIN) * (Number.isFinite(position) ? position : 0)),
  positionFromQuantity: (quantity) => (snapPlaqueQuantity(quantity) - PLAQUE_MIN) / (PLAQUE_MAX - PLAQUE_MIN),
  quote: ({ quantity, typeId }) => quotePlaqueOrder({ quantity, typeId }),
};

const CATALOGS: Record<OrderPricingModel, OrderCatalog> = {
  "nfc-keychain": KEYCHAIN_CATALOG,
  "nfc-plaque": PLAQUE_CATALOG,
};

/** The catalogue for a pricing model, or null for an unpriced / unknown form. */
export function getOrderCatalog(model?: string | null): OrderCatalog | null {
  return model && Object.hasOwn(CATALOGS, model) ? CATALOGS[model as OrderPricingModel] : null;
}

/** Active product types, falling back to the whole list if none is active. */
export function activeOrderTypes(catalog: OrderCatalog): OrderProductType[] {
  const active = catalog.types.filter((type) => type.active);
  return active.length > 0 ? active : catalog.types;
}
