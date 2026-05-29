/**
 * Phase 4 validation harness for "Presentation System Improvements".
 *
 * Calls Gemini with the EXACT system prompt + tool schema used by
 * POST /api/presentations/generate, then audits the output for the
 * quality goals in the Final Spec: color variety, layout variety,
 * specific (non-generic) content, visual hierarchy, bilingual fields.
 *
 * Does NOT write to the database — read-only against prod (guidelines + key only).
 * Run: npx tsx scripts/test-presentation-generation.ts
 */
import "dotenv/config";
import { z } from "zod";
import { slideBlockSchema } from "#shared/schema.js";
import { storage } from "../server/storage.js";
import { getGeminiClient } from "../server/lib/gemini.js";
import { getRuntimeGeminiKey } from "../server/lib/ai-provider.js";
import {
  buildGeneratorSystemPrompt,
  GENERATE_SLIDES_TOOL,
} from "../server/routes/presentationsGenerator.js";

const TEST_PROMPTS: { title: string; prompt: string }[] = [
  {
    title: "Lançamento de Produto SaaS",
    prompt:
      "Create an 8-10 slide pitch deck for the launch of a B2B SaaS analytics product called PulseBoard, " +
      "targeting marketing directors at mid-size e-commerce companies. Include real-sounding adoption metrics, " +
      "a clear problem, the solution, and a closing call to action to book a demo.",
  },
  {
    title: "Proposta de Reposicionamento de Marca",
    prompt:
      "Create a 9-slide brand repositioning proposal for a regional coffee chain moving upmarket. " +
      "Cover the market shift, the new positioning, customer personas, the rollout plan, and expected outcomes. " +
      "Use specific numbers and concrete language, not generic corporate filler.",
  },
  {
    title: "Relatório Trimestral de Performance",
    prompt:
      "Create a 10-slide quarterly performance review deck for a digital marketing agency presenting Q2 results " +
      "to a retainer client. Include channel-level stats, a key win, a challenge, and next-quarter priorities.",
  },
];

const FORBIDDEN = [
  "Strategic Alignment",
  "Operational Efficiency",
  "Market Penetration",
  "Customer Satisfaction",
  "Deep dive into the data",
  "Comprehensive strategy presentation",
  "In today's dynamic landscape",
];
const TEXT_ONLY = new Set(["title-body", "bullets", "section-break"]);
const IMAGE_LAYOUTS = new Set(["image-left", "image-right", "full-bleed-image", "image-focus"]);

type Slide = z.infer<typeof slideBlockSchema>;

function maxConsecutiveTextOnly(slides: Slide[]): number {
  let max = 0;
  let run = 0;
  for (const s of slides) {
    if (TEXT_ONLY.has(s.layout)) {
      run++;
      max = Math.max(max, run);
    } else {
      run = 0;
    }
  }
  return max;
}

function auditDeck(label: string, slides: Slide[]) {
  const layouts = slides.map((s) => s.layout);
  const distinctLayouts = new Set(layouts);
  const bgColors = slides.map((s) => s.style?.bgColor).filter(Boolean) as string[];
  const distinctBg = new Set(bgColors);

  const everySlideHasStyle = slides.every((s) => s.style?.bgColor && s.style?.alignment);
  const imageSlidesMissingUrl = slides.filter(
    (s) => IMAGE_LAYOUTS.has(s.layout) && !s.style?.bgImageUrl,
  ).length;
  const maxTextRun = maxConsecutiveTextOnly(slides);

  const allText = JSON.stringify(slides);
  const forbiddenHits = FORBIDDEN.filter((p) => allText.includes(p));

  // Bilingual coverage: any EN field should have its PT twin populated.
  const bilingualGaps = slides.filter((s) => {
    if (s.heading && !s.headingPt) return true;
    if (s.body && !s.bodyPt) return true;
    if (s.bullets?.length && !(s.bulletsPt?.length)) return true;
    return false;
  }).length;

  const checks = [
    [`slides generated`, slides.length, slides.length >= 8 && slides.length <= 12],
    [`distinct layouts (>=4)`, distinctLayouts.size, distinctLayouts.size >= 4],
    [`distinct bg colors (>=3)`, distinctBg.size, distinctBg.size >= 3],
    [`style on every slide`, everySlideHasStyle, everySlideHasStyle === true],
    [`no 3+ consecutive text slides`, `max run ${maxTextRun}`, maxTextRun < 3],
    [`image layouts have bgImageUrl`, `${imageSlidesMissingUrl} missing`, imageSlidesMissingUrl === 0],
    [`no forbidden generic phrases`, forbiddenHits.length ? forbiddenHits.join(", ") : "none", forbiddenHits.length === 0],
    [`bilingual fields populated`, `${bilingualGaps} gaps`, bilingualGaps === 0],
  ] as const;

  console.log(`\n===== ${label} =====`);
  console.log(`layouts: ${layouts.join(" → ")}`);
  console.log(`bgColors: ${Array.from(distinctBg).join(", ")}`);
  let passed = 0;
  for (const [name, value, ok] of checks) {
    console.log(`  ${ok ? "✅" : "❌"} ${name}: ${value}`);
    if (ok) passed++;
  }
  console.log(`  → ${passed}/${checks.length} checks passed`);
  return passed === checks.length;
}

async function main() {
  const geminiIntegration = await storage.getChatIntegration("gemini");
  const apiKey =
    getRuntimeGeminiKey() || process.env.GEMINI_API_KEY || geminiIntegration?.apiKey;
  if (!apiKey) {
    console.error("No Gemini API key available (env GEMINI_API_KEY or chat_integrations.gemini).");
    process.exit(1);
  }
  const model =
    process.env.GEMINI_PRESENTATION_MODEL ||
    geminiIntegration?.presentationModel ||
    geminiIntegration?.model ||
    "gemini-2.5-flash";

  const guidelinesRow = await storage.getBrandGuidelines();
  const guidelines = guidelinesRow?.content ?? "";
  console.log(`Model: ${model} | brand guidelines: ${guidelines ? `${guidelines.length} chars` : "EMPTY"}`);

  const client = getGeminiClient(apiKey);
  const systemPrompt = buildGeneratorSystemPrompt(guidelines);

  let allPassed = true;
  for (const { title, prompt } of TEST_PROMPTS) {
    try {
      const response = await client.chat.completions.create({
        model,
        max_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        tools: [GENERATE_SLIDES_TOOL as any],
        tool_choice: { type: "function", function: { name: "generate_slides" } },
      });
      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.type !== "function") {
        console.log(`\n===== ${title} =====\n  ❌ Gemini did not invoke the tool`);
        allPassed = false;
        continue;
      }
      const rawInput = JSON.parse(toolCall.function.arguments);
      const validation = z.array(slideBlockSchema).safeParse(rawInput.slides);
      if (!validation.success) {
        console.log(`\n===== ${title} =====\n  ❌ Zod validation failed: ${validation.error.errors.length} errors`);
        console.log(JSON.stringify(validation.error.errors.slice(0, 3), null, 2));
        allPassed = false;
        continue;
      }
      const ok = auditDeck(title, validation.data);
      allPassed = allPassed && ok;
    } catch (err) {
      console.log(`\n===== ${title} =====\n  ❌ API error: ${(err as Error).message}`);
      allPassed = false;
    }
  }

  console.log(`\n${allPassed ? "✅ ALL DECKS PASSED" : "⚠️  SOME CHECKS FAILED — review above"}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
