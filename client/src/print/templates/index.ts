import type { FolderTemplate } from "../types";
import { editorialTemplate } from "./editorial";
import { showcaseTemplate } from "./showcase";
import { catalogTemplate } from "./catalog";

/**
 * Template registry. Order here is the order shown in the toolbar picker; the
 * first entry is the default.
 *
 * To add a template: implement `FolderTemplate` in a sibling file and append it
 * here. Nothing else in the print pipeline needs to change — paper geometry,
 * bleed, crop marks, the print stylesheet and the CMYK step are all owned by
 * the shell (`PrintFolder.tsx`), not by templates.
 */
export const FOLDER_TEMPLATES: FolderTemplate[] = [
  editorialTemplate,
  showcaseTemplate,
  catalogTemplate,
];

export const DEFAULT_TEMPLATE_ID = FOLDER_TEMPLATES[0].id;

export function getTemplate(id: string): FolderTemplate {
  return FOLDER_TEMPLATES.find((t) => t.id === id) ?? FOLDER_TEMPLATES[0];
}
