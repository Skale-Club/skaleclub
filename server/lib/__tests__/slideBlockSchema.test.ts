// Run: npx tsx server/lib/__tests__/slideBlockSchema.test.ts
// Covers PRES-12: all 8 SlideBlock layout variants validate via Zod
import { z } from "zod";
import { slideBlockSchema } from "../../../shared/schema.js";

const fixtures = [
  { layout: "cover",        heading: "Cover Title",    headingPt: "Título da Capa" },
  { layout: "section-break", heading: "Chapter One" },
  { layout: "title-body",   heading: "Title",          body: "Body text here",      headingPt: "Título",   bodyPt: "Corpo do texto" },
  { layout: "bullets",      heading: "Key Points",     bullets: ["A", "B", "C"],    bulletsPt: ["A-PT", "B-PT", "C-PT"] },
  { layout: "stats",        stats: [{ label: "Clients", value: "120", labelPt: "Clientes" }] },
  { layout: "two-column",   heading: "Left Column",    body: "Right column content" },
  { layout: "image-focus",  heading: "Image Caption" },
  { layout: "closing",      heading: "Thank You",      headingPt: "Obrigado" },
];

const schema = z.array(slideBlockSchema);
const result = schema.safeParse(fixtures);

if (!result.success) {
  console.error("FAIL: SlideBlock schema validation errors:");
  console.error(JSON.stringify(result.error.errors, null, 2));
  process.exit(1);
}

console.log(`PASS: All ${result.data.length} SlideBlock variants validate correctly`);
