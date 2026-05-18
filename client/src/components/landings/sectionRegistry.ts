import type { ComponentType } from "react";
import type { z } from "zod";
import { HeroSectionAdapter, heroPropsSchema } from "./sections/HeroSectionAdapter";
import { HeroWebsitesSection, heroWebsitesPropsSchema } from "./sections/HeroWebsitesSection";
import { TrustBadgesAdapter, trustBadgesPropsSchema } from "./sections/TrustBadgesAdapter";
import { ServicesAdapter, servicesPropsSchema } from "./sections/ServicesAdapter";
import { ReviewsAdapter, reviewsPropsSchema } from "./sections/ReviewsAdapter";
import { BlogAdapter, blogPropsSchema } from "./sections/BlogAdapter";
import { AboutAdapter, aboutPropsSchema } from "./sections/AboutAdapter";
import { AreasServedAdapter, areasServedPropsSchema } from "./sections/AreasServedAdapter";
import { LeadFormCtaAdapter, leadFormCtaPropsSchema } from "./sections/LeadFormCtaAdapter";
import { WhatsAppGroupSection, whatsAppGroupPropsSchema } from "./sections/WhatsAppGroupSection";
import { ProcessStepperSection, processStepperPropsSchema } from "./sections/ProcessStepperSection";

export interface SectionEntry {
  component: ComponentType<{ props: any }>;
  propsSchema: z.ZodTypeAny;
}

// Map of section `type` → React component + zod props schema.
// Add new section types here. Server-side validation lives in
// shared/landingSectionRegistry (built in 43-02) and must stay in sync.
//
export const sectionRegistry: Record<string, SectionEntry> = {
  hero:          { component: HeroSectionAdapter,    propsSchema: heroPropsSchema },
  heroWebsites:  { component: HeroWebsitesSection,   propsSchema: heroWebsitesPropsSchema },
  trustBadges:   { component: TrustBadgesAdapter,    propsSchema: trustBadgesPropsSchema },
  services:      { component: ServicesAdapter,       propsSchema: servicesPropsSchema },
  reviews:       { component: ReviewsAdapter,        propsSchema: reviewsPropsSchema },
  blog:          { component: BlogAdapter,           propsSchema: blogPropsSchema },
  about:         { component: AboutAdapter,          propsSchema: aboutPropsSchema },
  areasServed:   { component: AreasServedAdapter,    propsSchema: areasServedPropsSchema },
  leadFormCta:   { component: LeadFormCtaAdapter,    propsSchema: leadFormCtaPropsSchema },
  whatsappGroup:  { component: WhatsAppGroupSection,  propsSchema: whatsAppGroupPropsSchema },
  processStepper: { component: ProcessStepperSection, propsSchema: processStepperPropsSchema },
};

export const registeredSectionTypes = Object.keys(sectionRegistry);
