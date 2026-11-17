import { storage } from "../storage.js";
import type { LiveBranding, LiveEstimate } from "#shared/liveSharing.js";
import type { LiveSourceLoader } from "./service.js";

export const loadLiveSource: LiveSourceLoader = async (kind, id) => {
  // Only document fields used by the public renderers are pinned. Never copy
  // company integration settings, access codes, guidelines or internal metadata.
  const settings = await storage.getCompanySettings();
  const branding: LiveBranding = {
    companyName: settings?.companyName ?? null,
    logoAvatarFull: settings?.logoAvatarFull ?? null,
    logoDark: settings?.logoDark ?? null,
    logoMain: settings?.logoMain ?? null,
    logoAvatarMark: settings?.logoAvatarMark ?? null,
    logoIcon: settings?.logoIcon ?? null,
  };
  if (kind === "presentation") {
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) return undefined;
    const presentation = await storage.getPresentation(id);
    if (!presentation) return undefined;
    return { snapshot: { kind, title: presentation.title, slides: presentation.slides, branding } };
  }
  if (!/^[1-9]\d{0,9}$/.test(id)) return undefined;
  const source = await storage.getEstimate(Number(id));
  if (!source) return undefined;
  const estimate: LiveEstimate = {
    id: source.id, slug: source.slug, clientName: source.clientName,
    companyName: source.companyName, contactName: source.contactName,
    note: source.note, services: source.services,
    createdAt: source.createdAt?.toISOString() ?? null, hasAccessCode: !!source.accessCode,
  };
  return {
    snapshot: { kind, title: source.companyName || source.contactName || source.clientName, estimate, branding },
    accessCode: source.accessCode,
  };
};
