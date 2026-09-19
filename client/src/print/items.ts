import type { CatalogItem, CatalogKind } from "@shared/catalog";

/**
 * The folder reads the same CatalogItem as the website (shared/catalog.ts):
 * same fields, same order of information, same cover and fallback logic. The
 * print cards stay separate components (millimetres and paper constraints are
 * another medium), but there is one model, so a product can no longer show one
 * image on the site and another on paper.
 */
export { buildCatalog } from "@shared/catalog";
export type FolderItem = CatalogItem;
export type FolderItemSource = CatalogKind;

export const SOURCE_LABEL: Record<FolderItemSource, string> = {
  product: "Produtos",
  service: "Serviços",
};
