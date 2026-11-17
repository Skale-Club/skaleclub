import type { InsertPortfolioService } from "./schema/cms.js";

export const XPEED_PLATFORM: InsertPortfolioService = {
  slug: "xpeed", title: "Xpeed", subtitle: "Understand your vehicle",
  description: "Keep vehicle profiles, record OBD trips and review diagnostics and maintenance in one place.",
  price: "", priceLabel: "", badgeText: "", category: "systems",
  features: ["Vehicle profiles", "OBD trip recording", "Diagnostics and history"],
  toolUrl: "https://xpeed.skale.club", ctaText: "Open Xpeed", order: 100, isActive: true,
};
