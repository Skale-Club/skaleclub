import "dotenv/config";
import { pool } from "../server/db.js";
import { storage } from "../server/storage.js";
import {
  DEFAULT_COMPANY_SETTINGS_SEED,
  DEFAULT_FAQS,
  DEFAULT_PORTFOLIO_SERVICES,
} from "../shared/defaults/cms.js";

type SeedCounts = {
  created: number;
  updated: number;
  skipped: number;
};

const GENERIC_COMPANY_DEFAULTS = {
  companyName: "Company Name",
  companyEmail: "contact@company.com",
  heroTitle: "Your 5-Star Marketing Company",
  heroSubtitle: "Book your marketing service today and watch your business grow",
  ctaText: "Book Now",
  seoTitle: "Company Name - Professional Services",
  seoDescription: "Professional marketing services for homes and businesses.",
};

function isEmptyObject(value: unknown) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0;
}

async function seedCompanySettings(): Promise<SeedCounts> {
  const current = await storage.getCompanySettings();
  const patch: Partial<typeof current> = {};

  if (!current.companyName || current.companyName === GENERIC_COMPANY_DEFAULTS.companyName) {
    patch.companyName = DEFAULT_COMPANY_SETTINGS_SEED.companyName ?? current.companyName;
  }
  if (!current.companyEmail || current.companyEmail === GENERIC_COMPANY_DEFAULTS.companyEmail) {
    patch.companyEmail = DEFAULT_COMPANY_SETTINGS_SEED.companyEmail ?? current.companyEmail;
  }
  if (!current.heroTitle || current.heroTitle === GENERIC_COMPANY_DEFAULTS.heroTitle) {
    patch.heroTitle = DEFAULT_COMPANY_SETTINGS_SEED.heroTitle ?? current.heroTitle;
  }
  if (!current.heroSubtitle || current.heroSubtitle === GENERIC_COMPANY_DEFAULTS.heroSubtitle) {
    patch.heroSubtitle = DEFAULT_COMPANY_SETTINGS_SEED.heroSubtitle ?? current.heroSubtitle;
  }
  if (!current.ctaText || current.ctaText === GENERIC_COMPANY_DEFAULTS.ctaText) {
    patch.ctaText = DEFAULT_COMPANY_SETTINGS_SEED.ctaText ?? current.ctaText;
  }
  if (!current.seoTitle || current.seoTitle === GENERIC_COMPANY_DEFAULTS.seoTitle) {
    patch.seoTitle = DEFAULT_COMPANY_SETTINGS_SEED.seoTitle ?? current.seoTitle;
  }
  if (!current.seoDescription || current.seoDescription === GENERIC_COMPANY_DEFAULTS.seoDescription) {
    patch.seoDescription = DEFAULT_COMPANY_SETTINGS_SEED.seoDescription ?? current.seoDescription;
  }
  if (!current.homepageContent || isEmptyObject(current.homepageContent)) {
    patch.homepageContent = DEFAULT_COMPANY_SETTINGS_SEED.homepageContent ?? current.homepageContent;
  }

  if (Object.keys(patch).length === 0) {
    return { created: 0, updated: 0, skipped: 1 };
  }

  await storage.updateCompanySettings(patch);
  return { created: 0, updated: 1, skipped: 0 };
}

async function seedFaqs(): Promise<SeedCounts> {
  const existingFaqs = await storage.getFaqs();
  const existingQuestions = new Set(existingFaqs.map((faq) => faq.question.trim().toLowerCase()));
  let created = 0;
  let skipped = 0;

  for (const faq of DEFAULT_FAQS) {
    if (existingQuestions.has(faq.question.trim().toLowerCase())) {
      skipped += 1;
      continue;
    }

    await storage.createFaq(faq);
    created += 1;
  }

  return { created, updated: 0, skipped };
}

async function seedPortfolioServices(): Promise<SeedCounts> {
  let created = 0;
  let skipped = 0;

  for (const service of DEFAULT_PORTFOLIO_SERVICES) {
    const existing = await storage.getPortfolioServiceBySlug(service.slug);
    if (existing) {
      skipped += 1;
      continue;
    }

    await storage.createPortfolioService(service);
    created += 1;
  }

  return { created, updated: 0, skipped };
}

async function seedDefaultForm(): Promise<SeedCounts> {
  const existingDefault = await storage.getDefaultForm();
  await storage.ensureDefaultForm();
  return existingDefault
    ? { created: 0, updated: 0, skipped: 1 }
    : { created: 1, updated: 0, skipped: 0 };
}

async function main() {
  console.log("Running unified seed...\n");

  const companyResult = await seedCompanySettings();
  const faqResult = await seedFaqs();
  const portfolioResult = await seedPortfolioServices();
  const formResult = await seedDefaultForm();

  console.log("company_settings", companyResult);
  console.log("faqs", faqResult);
  console.log("portfolio_services", portfolioResult);
  console.log("forms", formResult);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
