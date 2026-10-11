import { createElement, type ComponentType } from "react";
import type { z } from "zod";
import {
  registeredSectionTypes,
  sectionDefinitionMetadata,
  sectionPropsSchemas,
  type RegisteredSectionType,
  type SectionDefinitionMetadata,
} from "@shared/section-definitions";
import { HeroSectionAdapter } from "./sections/HeroSectionAdapter";
import { HeroWebsitesSection } from "./sections/HeroWebsitesSection";
import { TrustBadgesAdapter } from "./sections/TrustBadgesAdapter";
import { ServicesAdapter } from "./sections/ServicesAdapter";
import { OurServicesAdapter } from "./sections/OurServicesAdapter";
import { ReviewsAdapter } from "./sections/ReviewsAdapter";
import { BlogAdapter } from "./sections/BlogAdapter";
import { AboutAdapter } from "./sections/AboutAdapter";
import { AreasServedAdapter } from "./sections/AreasServedAdapter";
import { LeadFormCtaAdapter } from "./sections/LeadFormCtaAdapter";
import { WhatsAppGroupSection } from "./sections/WhatsAppGroupSection";
import { ProcessStepperSection } from "./sections/ProcessStepperSection";
import { PricingTableSection } from "./sections/PricingTableSection";
import { FaqAccordionSection } from "./sections/FaqAccordionSection";
import { ContentBlocksSection } from "./sections/ContentBlocksSection";
import { FeatureGridSection } from "./sections/FeatureGridSection";
import { AiReceptionSection } from "./sections/AiReceptionSection";
import { PricingPlansSection } from "./sections/PricingPlansSection";
import { LinkCalloutSection } from "./sections/LinkCalloutSection";
import { SectionRoleProvider } from "@/components/editorial";

export interface SectionEntry {
  component: ComponentType<{ props: unknown }>;
  propsSchema: z.ZodType<unknown>;
  metadata: SectionDefinitionMetadata;
}

type SectionProps<Type extends RegisteredSectionType> = z.infer<(typeof sectionPropsSchemas)[Type]>;

function bindSection<Type extends RegisteredSectionType>(
  type: Type,
  component: ComponentType<{ props: SectionProps<Type> }>,
): SectionEntry {
  const metadata = sectionDefinitionMetadata[type];
  const ManagedRenderer = ({ props }: { props: SectionProps<Type> }) => createElement(
    SectionRoleProvider,
    { role: metadata.role },
    createElement(component, { props }),
  );

  return {
    component: ManagedRenderer as ComponentType<{ props: unknown }>,
    propsSchema: sectionPropsSchemas[type],
    metadata,
  };
}

// Client-only map from a shared section definition to its React renderer.
// Schema, role, label and version live in shared/section-definitions.ts so the
// editor, API and renderer all enforce the same contract.
const registeredSectionRenderers: Record<RegisteredSectionType, SectionEntry> = {
  hero: bindSection("hero", HeroSectionAdapter),
  heroWebsites: bindSection("heroWebsites", HeroWebsitesSection),
  trustBadges: bindSection("trustBadges", TrustBadgesAdapter),
  services: bindSection("services", ServicesAdapter),
  ourServices: bindSection("ourServices", OurServicesAdapter),
  reviews: bindSection("reviews", ReviewsAdapter),
  blog: bindSection("blog", BlogAdapter),
  about: bindSection("about", AboutAdapter),
  areasServed: bindSection("areasServed", AreasServedAdapter),
  leadFormCta: bindSection("leadFormCta", LeadFormCtaAdapter),
  whatsappGroup: bindSection("whatsappGroup", WhatsAppGroupSection),
  processStepper: bindSection("processStepper", ProcessStepperSection),
  pricingTable: bindSection("pricingTable", PricingTableSection),
  faqAccordion: bindSection("faqAccordion", FaqAccordionSection),
  contentBlocks: bindSection("contentBlocks", ContentBlocksSection),
  featureGrid: bindSection("featureGrid", FeatureGridSection),
  aiReception: bindSection("aiReception", AiReceptionSection),
  pricingPlans: bindSection("pricingPlans", PricingPlansSection),
  linkCallout: bindSection("linkCallout", LinkCalloutSection),
};

export const sectionRegistry: Readonly<Record<string, SectionEntry>> = registeredSectionRenderers;

export { registeredSectionTypes };
