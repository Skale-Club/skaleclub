// Hand-written pt-BR for the `nfc-plaque-order` form and the plaque catalogue
// (shared/nfc-plaque-pricing.ts) as rendered by the order widgets.
//
// DRY-RUN by default: lists the rows. Add --apply to write.
// Run: npx tsx --env-file=.env scripts/seed-nfc-plaque-order-translations.ts [--apply]
//
// Same two passes as scripts/seed-nfc-order-translations.ts:
//   1. en -> pt  Portuguese for the form on the /br pages
//   2. pt -> en  IDENTITY rows so the EN pages are not "translated"
//
// Strings the keychain form already seeded ("What's your WhatsApp?", "Send us
// your logo", "Where should we ship them?", "Estimated total", "Quantity", ...)
// are NOT repeated: one row per source string serves both forms.
//
// The two price-summary rows are BUILT from NFC_PLAQUE_PRICES, the same way the
// catalogue builds the English source, so a price change keeps both in step
// (re-run this script after changing prices).
import "dotenv/config";
import { pool } from "../server/db.js";
import { seedEnglishIdentityRows, upsertTranslations, type TranslationPair } from "./lib/seed-translations.js";
import { NFC_PLAQUE_PRICES, NFC_PLAQUE_PRICE_SUMMARY, NFC_PLAQUE_TYPES } from "../shared/nfc-plaque-pricing.js";

const ptDollars = (cents: number) => `US$ ${cents / 100}`;
const P = NFC_PLAQUE_PRICES;

const CATALOGUE_PT: Record<string, { label: string; description: string }> = {
  google: {
    label: "Placa de avaliação do Google",
    description:
      "Nosso design pronto \"Avalie a gente no Google\". Encostar ou escanear abre a sua página de avaliação, e a gente troca o link quando você quiser.",
  },
  instagram: {
    label: "Placa do Instagram",
    description:
      "Nosso design pronto \"Siga a gente no Instagram\". Encostar ou escanear abre o seu perfil, e a gente troca o link quando você quiser.",
  },
  custom: {
    label: "Placa personalizada",
    description: "A sua logo, nome ou @ na placa. Encostar ou escanear abre direto o seu próprio link.",
  },
};

const PT_TRANSLATIONS: TranslationPair[] = [
  // ── Form questions ──────────────────────────────────────────────────────
  { source: "Which plaque do you want?", translated: "Qual placa você quer?" },
  { source: "How many plaques do you need?", translated: "Quantas placas você precisa?" },
  { source: "Where should the tap and the QR send people?", translated: "Para onde o toque e o QR devem levar as pessoas?" },
  {
    source: "Your Google review link or Instagram profile. Not sure? Leave it blank and we find it.",
    translated: "O link de avaliação do Google ou o seu perfil do Instagram. Não sabe? Deixe em branco que a gente encontra.",
  },
  {
    source: "Standard plaques use our ready-made design, so no logo is needed. Tap Next to skip this step.",
    translated: "As placas padrão usam o nosso design pronto, então não precisa de logo. Toque em Próximo para pular esta etapa.",
  },

  // ── Catalogue (labels + descriptions per model) ─────────────────────────
  ...NFC_PLAQUE_TYPES.flatMap((type) => {
    const pt = CATALOGUE_PT[type.id];
    if (!pt) throw new Error(`No pt-BR copy for plaque type "${type.id}"`);
    return [
      { source: type.label, translated: pt.label },
      { source: type.description, translated: pt.description },
    ];
  }),
  {
    source: NFC_PLAQUE_PRICE_SUMMARY.standard,
    translated: `${ptDollars(P.standardUnitCents)} cada, ou 2 por ${ptDollars(P.standardPairCents)}`,
  },
  {
    source: NFC_PLAQUE_PRICE_SUMMARY.custom,
    translated: `${ptDollars(P.customFirstCents)} a primeira, ${ptDollars(P.customAdditionalCents)} cada adicional`,
  },

  // ── Units and price-panel lines ─────────────────────────────────────────
  { source: "plaque", translated: "placa" },
  { source: "plaques", translated: "placas" },
  { source: "Fewer plaques", translated: "Menos placas" },
  { source: "More plaques", translated: "Mais placas" },
  { source: "Pair of plaques", translated: "Par de placas" },
  { source: "Single plaque", translated: "Placa avulsa" },
  { source: "First plaque, custom artwork included", translated: "Primeira placa, com a arte personalizada" },
  { source: "Additional plaque", translated: "Placa adicional" },
  // PricingTableSection chip for the "2 for $79" row on the plaque landing.
  { source: "Bundle", translated: "Combo" },
];

async function main() {
  const apply = process.argv.includes("--apply");
  for (const pair of PT_TRANSLATIONS) console.log(`  ${pair.source}\n    -> ${pair.translated}`);
  if (!apply) {
    console.log(`\nDry run: ${PT_TRANSLATIONS.length} en -> pt rows (plus identity rows). Re-run with --apply to write.`);
    return;
  }
  const ptResult = await upsertTranslations(PT_TRANSLATIONS, { sourceLanguage: "en", targetLanguage: "pt" });
  console.log(`en -> pt: ${ptResult.inserted} inserted, ${ptResult.updated} updated.`);
  const enResult = await seedEnglishIdentityRows(PT_TRANSLATIONS.map((pair) => pair.source));
  console.log(`pt -> en identity: ${enResult.inserted} inserted, ${enResult.updated} updated.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
