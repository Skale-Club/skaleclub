import { z } from "zod";
import type { SlideBlock } from "./schema/presentations.js";
import type { EstimateServiceItem } from "./schema/estimates.js";

export const liveLanguageSchema = z.enum(["en", "pt-BR"]);
export const liveKindSchema = z.enum(["presentation", "estimate"]);
export type LiveLanguage = z.infer<typeof liveLanguageSchema>;
export type LiveKind = z.infer<typeof liveKindSchema>;
export interface LiveBranding {
  companyName: string | null;
  logoAvatarFull: string | null;
  logoDark: string | null;
  logoMain: string | null;
  logoAvatarMark: string | null;
  logoIcon: string | null;
}
export interface LiveEstimate {
  id: number;
  slug: string;
  clientName: string;
  companyName: string | null;
  contactName: string | null;
  note: string | null;
  services: EstimateServiceItem[];
  createdAt: string | null;
  hasAccessCode: boolean;
}
export type LiveSnapshot = {
  title: string;
  branding: LiveBranding;
} & ({ kind: "presentation"; slides: SlideBlock[] } | { kind: "estimate"; estimate: LiveEstimate });
export interface LiveState {
  id: string;
  slideIndex: number;
  language: LiveLanguage;
  revision: number;
  status: "live" | "disconnected" | "ended" | "expired";
  expiresAt: string;
}
export interface LiveSessionView {
  state: LiveState;
  snapshot: LiveSnapshot;
  requiresAccessCode: boolean;
}
export const createLiveSchema = z.object({
  kind: liveKindSchema,
  sourceId: z.string().min(1).max(100),
  language: liveLanguageSchema.default("en"),
}).strict();
export const liveCommandSchema = z.object({
  controllerToken: z.string().min(32).max(128),
  commandId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
  command: z.discriminatedUnion("type", [
    z.object({ type: z.literal("navigate"), slideIndex: z.number().int().nonnegative() }).strict(),
    z.object({ type: z.literal("language"), language: liveLanguageSchema }).strict(),
    z.object({ type: z.literal("end") }).strict(),
  ]),
}).strict();
export type LiveCommand = z.infer<typeof liveCommandSchema>;
export function liveSlideCount(snapshot: LiveSnapshot): number {
  return snapshot.kind === "presentation" ? snapshot.slides.length : snapshot.estimate.services.length + 3;
}
