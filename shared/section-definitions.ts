import { z } from "zod";

export const sectionRoles = ["editorial", "dense", "compact", "pill", "cta", "bridge", "flush", "hero"] as const;
export type SectionRole = (typeof sectionRoles)[number];
export type SectionFamily = "section" | "hero";
export type SectionContentSource = "local" | "global" | "local-with-global-fallback";

export const sectionThemeSchema = z.enum(["light", "dark"]).optional();

export const whatsappCtaSchema = z
  .object({
    number: z.string().regex(/^\+?[0-9 ()-]{8,20}$/, "WhatsApp number, digits with country code"),
    label: z.string().optional(),
    messages: z.object({ en: z.string().min(1), pt: z.string().min(1) }),
  })
  .optional();

const optionalUrl = z.preprocess(
  (value) => (value === null || value === "" ? undefined : value),
  z.string().refine(
    (value) => value.startsWith("/") || z.string().url().safeParse(value).success,
    "Expected an absolute URL or a root-relative asset path",
  ).optional(),
);

const rootAsset = z.string().regex(/^\/(?![\/\\])/);
const sitePath = z.string().regex(/^\/(?![\/\\])[a-z0-9/-]*$/);
const anchorId = z.string().regex(/^[a-z][a-z0-9-]*$/);

export const processStepperIconNames = [
  "Search", "Palette", "Code2", "Rocket",
  "MessageCircle", "PenTool", "Factory", "Truck",
  "Nfc", "Smartphone", "QrCode", "Star",
  "CreditCard", "Package", "Link2", "Check",
  "PhoneCall", "Bot", "CalendarCheck", "Bell",
] as const;

export const featureGridIconNames = [
  "Star", "Instagram", "IdCard", "UtensilsCrossed", "Globe", "MessageCircle",
  "Store", "ConciergeBell", "Car", "KeyRound", "Nfc", "Smartphone",
  "PhoneMissed", "CalendarX", "CalendarClock",
] as const;

export const featureGridBrands = ["google", "instagram", "whatsapp", "vcard", "menu", "web"] as const;

const badgeSchema = z.object({
  title: z.string(),
  description: z.string(),
  icon: z.string().optional(),
});

const processStepSchema = z.object({
  title: z.string(),
  description: z.string(),
});

const priceLineSchema = z.object({
  label: z.string(),
  price: z.string(),
  note: z.string().optional(),
  kind: z.enum(["one-time", "per-unit", "minimum", "bundle"]),
});

const faqItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const contentBlockSchema = z.object({
  heading: z.string(),
  paragraphs: z.array(z.string()),
  bullets: z.array(z.string()).optional(),
});

const featureGridItemSchema = z.object({
  icon: z.enum(featureGridIconNames),
  brand: z.enum(featureGridBrands).optional(),
  title: z.string(),
  description: z.string(),
  imageUrl: rootAsset.optional(),
  imageAlt: z.string().optional(),
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional(),
  href: sitePath.optional(),
});

const pricingPlanSchema = z.object({
  name: z.string(),
  title: z.string(),
  imageUrl: rootAsset.optional(),
  imageAlt: z.string().optional(),
  price: z.string(),
  priceUnit: z.string().optional(),
  priceNote: z.string().optional(),
  features: z.array(z.string()).max(6).optional(),
  example: z.string().optional(),
  highlight: z.boolean().optional(),
});

const catalogSelectionSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("product"), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }),
  z.object({ source: z.literal("service"), title: z.string().min(1).max(120) }),
]);

export const heroPropsSchema = z.object({}).passthrough();

export const heroWebsitesPropsSchema = z.object({
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  ctaLabel: z.string().optional(),
  secondaryCtaLabel: z.string().optional(),
  secondaryCtaHref: z.string().regex(/^(\/[a-z0-9/-]*|#[a-z][a-z0-9-]*|tel:\+?[0-9]{7,15})$/).optional(),
  secondaryCtaNote: z.string().optional(),
  eyebrow: z.string().optional(),
  backgroundImageUrl: optionalUrl,
  backgroundImageAlt: z.string().optional(),
  bgVideoUrl: optionalUrl,
  whatsapp: whatsappCtaSchema,
  theme: sectionThemeSchema,
});

export const trustBadgesPropsSchema = z.object({
  theme: sectionThemeSchema,
  badges: z.array(badgeSchema).max(6).optional(),
}).passthrough();

export const servicesPropsSchema = z.object({
  mode: z.enum(["steps", "services"]).optional(),
});

export const ourServicesPropsSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  items: z.array(catalogSelectionSchema).min(1).max(8).optional(),
});

export const reviewsXphereConfigSchema = z.object({
  token: z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/),
  layout: z.enum(["carousel", "grid", "list"]).optional(),
  theme: z.enum(["light", "dark"]).optional(),
  minRating: z.number().int().min(1).max(5).optional(),
  sort: z.enum(["recent", "highest", "lowest"]).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  showHero: z.boolean().optional(),
  heroStyle: z.enum(["full", "lite"]).optional(),
  cardShape: z.enum(["rounded", "square"]).optional(),
  equalHeight: z.boolean().optional(),
  footerCta: z.boolean().optional(),
});

export const reviewsPropsSchema = z.object({
  xphere: reviewsXphereConfigSchema.optional(),
  // Deprecated compatibility input. It is parsed into an allowlisted Xphere
  // config or a trusted iframe URL; arbitrary scripts are never executed.
  embedUrl: z.string().max(10_000).optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
});

export const blogPropsSchema = z.object({}).passthrough();

export const aboutPropsSchema = z.object({
  tone: z.enum(["dark", "light"]).optional(),
}).passthrough();

export const areasServedPropsSchema = z.object({}).passthrough();

export const leadFormCtaPropsSchema = z.object({
  formSlug: z.string().min(1),
  ctaLabel: z.string().optional(),
  heading: z.string().optional(),
  subheading: z.string().optional(),
  note: z.string().optional(),
  imageUrl: z.string().regex(/^\//).optional(),
  imageAlt: z.string().optional(),
  whatsapp: whatsappCtaSchema,
  secondaryLabel: z.string().optional(),
  secondaryHref: z.string().regex(/^\/[a-z0-9/-]*$/).optional(),
  theme: sectionThemeSchema,
});

export const whatsAppGroupPropsSchema = z.object({
  badgeLabel: z.string().optional(),
  groupName: z.string().optional(),
  groupSubtitle: z.string().optional(),
  groupLabel: z.string().optional(),
  groupOfficialLabel: z.string().optional(),
  socialProofLabel: z.string().optional(),
  headline: z.string().optional(),
  headlineAccent: z.string().optional(),
  subheadline: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  formTitle: z.string().optional(),
  formSubtitle: z.string().optional(),
  formHelper: z.string().optional(),
  phoneCountryAriaLabel: z.string().optional(),
  submitLabel: z.string().optional(),
  privacyLabel: z.string().optional(),
  submitEndpoint: z.string().optional(),
  successTitle: z.string().optional(),
  successBody: z.string().optional(),
  toastSuccessTitle: z.string().optional(),
  toastSuccessBody: z.string().optional(),
  toastErrorTitle: z.string().optional(),
  phoneInvalidPrefix: z.string().optional(),
  theme: sectionThemeSchema,
});

export const processStepperPropsSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  subheading: z.string().optional(),
  steps: z.array(processStepSchema).length(4).optional(),
  icons: z.array(z.enum(processStepperIconNames)).length(4).optional(),
  anchorId: anchorId.optional(),
  theme: sectionThemeSchema,
});

export const pricingTablePropsSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  subheading: z.string().optional(),
  lines: z.array(priceLineSchema).min(1).optional(),
  footnote: z.string().optional(),
  theme: sectionThemeSchema,
});

export const faqAccordionPropsSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  subheading: z.string().optional(),
  items: z.array(faqItemSchema).min(1).optional(),
  theme: sectionThemeSchema,
});

export const contentBlocksPropsSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  subheading: z.string().optional(),
  headingLevel: z.enum(["h1", "h2"]).optional(),
  blocks: z.array(contentBlockSchema).min(1).optional(),
  theme: sectionThemeSchema,
  imageUrl: rootAsset.optional(),
  imageAlt: z.string().optional(),
  imageSide: z.enum(["left", "right"]).optional(),
});

export const featureGridPropsSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string(),
  subheading: z.string().optional(),
  imageUrl: rootAsset.optional(),
  imageAlt: z.string().optional(),
  imagePosition: z.enum(["left", "right"]).optional(),
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional(),
  items: z.array(featureGridItemSchema).min(2).max(6),
  theme: sectionThemeSchema,
});

export const pricingPlansPropsSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  subheading: z.string().optional(),
  plans: z.array(pricingPlanSchema).min(1).max(3),
  ctaLabel: z.string().optional(),
  footnote: z.string().optional(),
  anchorId: anchorId.optional(),
  theme: sectionThemeSchema,
});

export const linkCalloutPropsSchema = z.object({
  eyebrow: z.string().optional(),
  text: z.string(),
  linkLabel: z.string(),
  href: sitePath,
  theme: sectionThemeSchema,
});

export const sectionPropsSchemas = {
  hero: heroPropsSchema,
  heroWebsites: heroWebsitesPropsSchema,
  trustBadges: trustBadgesPropsSchema,
  services: servicesPropsSchema,
  ourServices: ourServicesPropsSchema,
  reviews: reviewsPropsSchema,
  blog: blogPropsSchema,
  about: aboutPropsSchema,
  areasServed: areasServedPropsSchema,
  leadFormCta: leadFormCtaPropsSchema,
  whatsappGroup: whatsAppGroupPropsSchema,
  processStepper: processStepperPropsSchema,
  pricingTable: pricingTablePropsSchema,
  faqAccordion: faqAccordionPropsSchema,
  contentBlocks: contentBlocksPropsSchema,
  featureGrid: featureGridPropsSchema,
  pricingPlans: pricingPlansPropsSchema,
  linkCallout: linkCalloutPropsSchema,
} as const satisfies Record<string, z.ZodTypeAny>;

export type RegisteredSectionType = keyof typeof sectionPropsSchemas;

export interface SectionDefinitionMetadata {
  label: string;
  family: SectionFamily;
  role: SectionRole;
  version: number;
  contentSource: SectionContentSource;
}

export const sectionDefinitionMetadata: Record<RegisteredSectionType, SectionDefinitionMetadata> = {
  hero: { label: "Homepage hero", family: "hero", role: "hero", version: 1, contentSource: "global" },
  heroWebsites: { label: "Landing hero", family: "hero", role: "hero", version: 1, contentSource: "local" },
  trustBadges: { label: "Trust badges", family: "section", role: "compact", version: 1, contentSource: "local-with-global-fallback" },
  services: { label: "Services", family: "section", role: "editorial", version: 1, contentSource: "global" },
  ourServices: { label: "Our services", family: "section", role: "editorial", version: 1, contentSource: "local-with-global-fallback" },
  reviews: { label: "Reviews", family: "section", role: "editorial", version: 1, contentSource: "local-with-global-fallback" },
  blog: { label: "Blog", family: "section", role: "editorial", version: 1, contentSource: "global" },
  about: { label: "About", family: "section", role: "editorial", version: 1, contentSource: "global" },
  areasServed: { label: "Areas served", family: "section", role: "editorial", version: 1, contentSource: "global" },
  leadFormCta: { label: "Lead form CTA", family: "section", role: "cta", version: 1, contentSource: "local" },
  whatsappGroup: { label: "WhatsApp group hero", family: "hero", role: "hero", version: 1, contentSource: "local" },
  processStepper: { label: "Process stepper", family: "section", role: "editorial", version: 1, contentSource: "local" },
  pricingTable: { label: "Pricing table", family: "section", role: "editorial", version: 1, contentSource: "local" },
  faqAccordion: { label: "FAQ accordion", family: "section", role: "editorial", version: 1, contentSource: "local" },
  contentBlocks: { label: "Content blocks", family: "section", role: "editorial", version: 1, contentSource: "local" },
  featureGrid: { label: "Feature grid", family: "section", role: "editorial", version: 1, contentSource: "local" },
  pricingPlans: { label: "Pricing plans", family: "section", role: "editorial", version: 1, contentSource: "local" },
  linkCallout: { label: "Link callout", family: "section", role: "pill", version: 1, contentSource: "local" },
};

export const registeredSectionTypes = Object.keys(sectionPropsSchemas) as RegisteredSectionType[];

/** Valid starter props used by the admin's generated template picker. */
export const sectionStarterProps: Record<RegisteredSectionType, Record<string, unknown>> = {
  hero: {},
  heroWebsites: {},
  trustBadges: {},
  services: {},
  ourServices: {},
  reviews: {},
  blog: {},
  about: {},
  areasServed: {},
  leadFormCta: { formSlug: "default" },
  whatsappGroup: {},
  processStepper: {},
  pricingTable: {},
  faqAccordion: {},
  contentBlocks: {},
  featureGrid: {
    heading: "New feature section",
    items: [
      { icon: "Star", title: "Feature one", description: "Describe the first feature." },
      { icon: "Star", title: "Feature two", description: "Describe the second feature." },
    ],
  },
  pricingPlans: {
    plans: [{ name: "Plan", title: "Plan title", price: "$0" }],
  },
  linkCallout: { text: "Callout text", linkLabel: "Learn more", href: "/" },
};

export interface PersistedManagedSection {
  type: string;
  version?: number;
  props: Record<string, unknown>;
}

type SectionMigration = (props: Record<string, unknown>) => Record<string, unknown>;

/**
 * Add `N: migrateNtoNPlusOne` when a definition's version is incremented.
 * Migration tooling calls migrateManagedSection repeatedly until current.
 */
export const sectionMigrations: Partial<Record<RegisteredSectionType, Record<number, SectionMigration>>> = {};

export function migrateManagedSection(section: PersistedManagedSection): PersistedManagedSection {
  const type = section.type as RegisteredSectionType;
  const definition = sectionDefinitionMetadata[type];
  if (!definition) throw new Error(`Cannot migrate unknown section type: ${section.type}`);

  let version = section.version ?? 1;
  let props = structuredClone(section.props ?? {});
  if (version > definition.version) {
    throw new Error(`${type} version ${version} is newer than supported version ${definition.version}`);
  }

  while (version < definition.version) {
    const migrate = sectionMigrations[type]?.[version];
    if (!migrate) throw new Error(`Missing ${type} migration from version ${version} to ${version + 1}`);
    props = migrate(props);
    version += 1;
  }

  return { type, version: definition.version, props };
}

const currentManagedPageSectionSchema = z.object({
  type: z.string().min(1).max(80),
  version: z.number().int().positive().optional(),
  props: z.record(z.unknown()).default({}),
}).superRefine((section, ctx) => {
  const schema = sectionPropsSchemas[section.type as RegisteredSectionType];
  if (!schema) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["type"],
      message: `Unknown section type: ${section.type}`,
    });
    return;
  }

  const currentVersion = sectionDefinitionMetadata[section.type as RegisteredSectionType].version;
  if (section.version !== undefined && section.version !== currentVersion) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["version"],
      message: `Unsupported version ${section.version}; current version is ${currentVersion}`,
    });
  }

  const parsed = schema.safeParse(section.props);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["props", ...issue.path],
        message: issue.message,
      });
    }
  }
});

/**
 * The storage boundary always normalizes a known older section before current
 * validation. This makes the migration table operational instead of leaving
 * it as a helper that future callers could forget to invoke.
 */
export const managedPageSectionSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.type !== "string") return value;
  if (!sectionDefinitionMetadata[candidate.type as RegisteredSectionType]) return value;
  if (candidate.props !== undefined && (typeof candidate.props !== "object" || candidate.props === null || Array.isArray(candidate.props))) {
    return value;
  }

  try {
    return migrateManagedSection({
      type: candidate.type,
      version: typeof candidate.version === "number" ? candidate.version : undefined,
      props: (candidate.props as Record<string, unknown> | undefined) ?? {},
    });
  } catch {
    // Let the current schema report the precise type/version/props issue.
    return value;
  }
}, currentManagedPageSectionSchema);

export const managedPageSectionsSchema = z.array(managedPageSectionSchema);

export function validateSectionProps(type: string, props: unknown) {
  const schema = sectionPropsSchemas[type as RegisteredSectionType];
  if (!schema) return { success: false as const, error: `Unknown section type: ${type}` };
  const parsed = schema.safeParse(props ?? {});
  if (!parsed.success) return { success: false as const, error: parsed.error };
  return { success: true as const, data: parsed.data };
}
