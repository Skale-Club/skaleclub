// Translation keys and values live in shared/i18n/pt.ts so the server can use them too.
import { translations } from '@shared/i18n/pt';

export { translations };
export type TranslationKey = keyof typeof translations.pt;
