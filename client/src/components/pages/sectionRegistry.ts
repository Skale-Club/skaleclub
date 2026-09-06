import type { ComponentType } from "react";
import type { z } from "zod";
import { HeroSectionAdapter, heroPropsSchema } from "./sections/HeroSectionAdapter";
import { HeroWebsitesSection, heroWebsitesPropsSchema } from "./sections/HeroWebsitesSection";
import { TrustBadgesAdapter, trustBadgesPropsSchema } from "./sections/TrustBadgesAdapter";
import { ServicesAdapter, servicesPropsSchema } from "./sections/ServicesAdapter";
import { OurServicesAdapter, ourServicesPropsSchema } from "./sections/OurServicesAdapter";
import { ReviewsAdapter, reviewsPropsSchema } from "./sections/ReviewsAdapter";
import { BlogAdapter, blogPropsSchema } from "./sections/BlogAdapter";
import { AboutAdapter, aboutPropsSchema } from "./sections/AboutAdapter";
import { AreasServedAdapter, areasServedPropsSchema } from "./sections/AreasServedAdapter";
import { LeadFormCtaAdapter, leadFormCtaPropsSchema } from "./sections/LeadFormCtaAdapter";
import { WhatsAppGroupSection, whatsAppGroupPropsSchema } from "./sections/WhatsAppGroupSection";
import { ProcessStepperSection, processStepperPropsSchema } from "./sections/ProcessStepperSection";
import { PricingTableSection, pricingTablePropsSchema } from "./sections/PricingTableSection";
import { FaqAccordionSection, faqAccordionPropsSchema } from "./sections/FaqAccordionSection";
import { ContentBlocksSection, contentBlocksPropsSchema } from "./sections/ContentBlocksSection";

export interface SectionEntry {
  component: ComponentType<{ props: any }>;
  propsSchema: z.ZodTypeAny;
}

// Map of section `type` → React component + zod props schema.
// Add new section types here. This registry is the ONLY registration point:
// there is no server-side section registry — `insertPageSchema` accepts
// `props: z.record(z.unknown())`, so the server stores each section's props
// bag unvalidated and DynamicLanding validates via `propsSchema.safeParse`
// at render time (a failed parse renders nothing in production).
//
export const sectionRegistry: Record<string, SectionEntry> = {
  hero:          { component: HeroSectionAdapter,    propsSchema: heroPropsSchema },
  heroWebsites:  { component: HeroWebsitesSection,   propsSchema: heroWebsitesPropsSchema },
  trustBadges:   { component: TrustBadgesAdapter,    propsSchema: trustBadgesPropsSchema },
  services:      { component: ServicesAdapter,       propsSchema: servicesPropsSchema },
  ourServices:   { component: OurServicesAdapter,    propsSchema: ourServicesPropsSchema },
  reviews:       { component: ReviewsAdapter,        propsSchema: reviewsPropsSchema },
  blog:          { component: BlogAdapter,           propsSchema: blogPropsSchema },
  about:         { component: AboutAdapter,          propsSchema: aboutPropsSchema },
  areasServed:   { component: AreasServedAdapter,    propsSchema: areasServedPropsSchema },
  leadFormCta:   { component: LeadFormCtaAdapter,    propsSchema: leadFormCtaPropsSchema },
  whatsappGroup:  { component: WhatsAppGroupSection,  propsSchema: whatsAppGroupPropsSchema },
  processStepper: { component: ProcessStepperSection, propsSchema: processStepperPropsSchema },
  pricingTable:   { component: PricingTableSection,   propsSchema: pricingTablePropsSchema },
  faqAccordion:   { component: FaqAccordionSection,   propsSchema: faqAccordionPropsSchema },
  contentBlocks:  { component: ContentBlocksSection,  propsSchema: contentBlocksPropsSchema },
};

export const registeredSectionTypes = Object.keys(sectionRegistry);
