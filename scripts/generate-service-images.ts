/**
 * Generate "Other Services" card images with Gemini 2.5 Flash Image ("Nano Banana").
 *
 * Produces one 16:10 illustration per homepage service (S06) and writes them to
 * client/public/service-images/<slug>.png — directly web-servable at
 * /service-images/<slug>.png, which you can paste into each card's imageUrl,
 * or upload through the admin Website editor.
 *
 * The Gemini key is resolved from (in order): GEMINI_API_KEY / GOOGLE_API_KEY env,
 * then the "gemini" chat integration stored in the DB (same source the app uses),
 * so it works with your existing configured key without copying it anywhere.
 *
 * Usage:
 *   npx tsx scripts/generate-service-images.ts
 *   (needs DATABASE_URL in .env to read the stored key; or set GEMINI_API_KEY directly)
 *
 * Optional env:
 *   GEMINI_IMAGE_MODEL   override model (default: gemini-2.5-flash-image)
 *   ONLY=slug1,slug2     regenerate only the given slugs
 */
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

async function resolveApiKey(): Promise<string | undefined> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY;
  // Fall back to the key stored in the DB "gemini" chat integration.
  try {
    const { storage } = await import('../server/storage.js');
    const integration = await storage.getChatIntegration('gemini');
    return integration?.apiKey || undefined;
  } catch (err) {
    console.warn(`Could not read stored Gemini key from DB: ${(err as Error).message}`);
    return undefined;
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'client', 'public', 'service-images');
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

// Shared style so all eight images read as one cohesive set on the dark cards.
const STYLE =
  'Modern minimal 3D isometric illustration. Dark navy background (#0d1320). ' +
  'Electric blue accent color (#4f6bff). Soft studio lighting, clean, high detail, ' +
  'subtle depth of field. Wide 16:10 aspect ratio. No text, no words, no letters.';

interface Service {
  slug: string;
  title: string;
  subject: string;
}

// Matches the 7 "Other Services" cards as actually entered in the admin
// (Digital Marketing Consultation -> CRM and Marketing Automation).
const SERVICES: Service[] = [
  {
    slug: 'digital-marketing-consultation',
    title: 'Digital Marketing Consultation',
    subject:
      'A marketing strategy scene: a floating analytics dashboard with growth line charts, ' +
      'an upward trending arrow, and a strategy roadmap.',
  },
  {
    slug: 'website-design-development',
    title: 'Website Design & Development',
    subject:
      'A responsive web design scene: a sleek modern website shown across a laptop, tablet and ' +
      'smartphone, with UI wireframe blocks, a shopping cart icon, and a small color palette.',
  },
  {
    slug: 'paid-advertising',
    title: 'Paid Advertising',
    subject:
      'A digital advertising scene: ad campaign cards, concentric audience-targeting rings with a ' +
      'bullseye, and a conversion funnel with a cursor click.',
  },
  {
    slug: 'content-creation',
    title: 'Content Creation',
    subject:
      'A content creation scene: a video play button, a camera, stacked social post cards, and a ' +
      'floating blog document with a pen.',
  },
  {
    slug: 'branding-graphic-design',
    title: 'Branding & Graphic Design',
    subject:
      'A brand identity scene: a logo mark on a card, color swatch chips, typography sample ' +
      'blocks, and a business card and flyer.',
  },
  {
    slug: 'lead-generation',
    title: 'Lead Generation',
    subject:
      'A lead generation scene: a large magnet attracting floating contact avatars, message ' +
      'bubbles and email icons into a funnel.',
  },
  {
    slug: 'crm-marketing-automation',
    title: 'CRM and Marketing Automation',
    subject:
      'A marketing automation scene: a connected workflow diagram of nodes with gears, a sales ' +
      'pipeline board, an email icon, an SMS bubble, and a friendly chatbot robot icon.',
  },
];

function extractImage(response: any): Buffer | null {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const data = part?.inlineData?.data;
    if (data) return Buffer.from(data, 'base64');
  }
  return null;
}

async function main() {
  const apiKey = await resolveApiKey();
  if (!apiKey) {
    console.error(
      'No Gemini API key found. Set GEMINI_API_KEY (or GOOGLE_API_KEY) in your env/.env, ' +
        'or configure the Gemini integration in the admin (needs DATABASE_URL to read it).',
    );
    process.exit(1);
  }

  const only = (process.env.ONLY || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const targets = only.length ? SERVICES.filter((s) => only.includes(s.slug)) : SERVICES;

  await mkdir(OUT_DIR, { recursive: true });
  const ai = new GoogleGenAI({ apiKey });

  console.log(`Generating ${targets.length} image(s) with ${MODEL}...\n`);
  const ok: string[] = [];
  const failed: string[] = [];

  for (const svc of targets) {
    process.stdout.write(`- ${svc.title} ... `);
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: `${svc.subject}\n\n${STYLE}`,
      });
      const img = extractImage(response);
      if (!img) {
        console.log('no image returned');
        failed.push(svc.slug);
        continue;
      }
      const outPath = join(OUT_DIR, `${svc.slug}.png`);
      await writeFile(outPath, img);
      console.log(`saved (${Math.round(img.length / 1024)} KB)`);
      ok.push(svc.slug);
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
      failed.push(svc.slug);
    }
  }

  console.log(`\nDone. ${ok.length} saved, ${failed.length} failed.`);
  console.log(`Output: ${OUT_DIR}`);
  if (ok.length) {
    console.log('\nReference each in its card imageUrl as:');
    for (const slug of ok) console.log(`  /service-images/${slug}.png`);
  }
  if (failed.length) {
    console.log(`\nRetry failures with: ONLY=${failed.join(',')} npx tsx scripts/generate-service-images.ts`);
    process.exitCode = 1;
  }
}

main();
