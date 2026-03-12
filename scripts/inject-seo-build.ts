#!/usr/bin/env tsx
/**
 * Build-time script to inject dynamic SEO data into index.html
 * This eliminates FODC (Flash of Default Content) by pre-rendering SEO meta tags
 *
 * Usage: npm run build (automatically runs after Vite build)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

async function injectSEOData() {
  try {
    if (process.env.VERCEL || process.env.VERCEL_ENV) {
      // Allow self-signed certs for build-time DB access on Vercel.
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
      console.warn(
        "DATABASE_URL or POSTGRES_URL not set. Skipping SEO injection and using default tags.",
      );
      return;
    }

    console.log("Fetching SEO data from database...");

    const [{ db }, { companySettings }] = await Promise.all([
      import("../server/db"),
      import("../shared/schema"),
    ]);

    // Fetch only SEO-relevant columns so deployments with older schemas
    // (missing newer columns like links_page_config) still work.
    const settings = await db.select({
      companyName: companySettings.companyName,
      seoTitle: companySettings.seoTitle,
      seoDescription: companySettings.seoDescription,
      ogImage: companySettings.ogImage,
      logoIcon: companySettings.logoIcon,
      seoKeywords: companySettings.seoKeywords,
      seoAuthor: companySettings.seoAuthor,
      seoCanonicalUrl: companySettings.seoCanonicalUrl,
      seoRobotsTag: companySettings.seoRobotsTag,
      ogType: companySettings.ogType,
      ogSiteName: companySettings.ogSiteName,
      twitterCard: companySettings.twitterCard,
    }).from(companySettings).limit(1);
    const seoData = settings[0];

    if (!seoData) {
      console.warn("No company settings found in database. Using defaults.");
      return;
    }

    console.log("SEO data fetched successfully");

    // Path to built index.html
    const indexPath = join(process.cwd(), "dist", "public", "index.html");

    if (!existsSync(indexPath)) {
      console.error("index.html not found at:", indexPath);
      console.log("Make sure to run 'npm run build' first");
      return;
    }

    console.log("Reading index.html...");
    let html = readFileSync(indexPath, "utf-8");

    // Remove existing SEO tags to avoid duplicates (e.g., og:temporal:* in Facebook debugger).
    html = removeMetaByName(html, "description");
    html = removeMetaByName(html, "keywords");
    html = removeMetaByName(html, "author");
    html = removeMetaByName(html, "robots");
    html = removeMetaByName(html, "twitter:card");
    html = removeMetaByName(html, "twitter:title");
    html = removeMetaByName(html, "twitter:description");
    html = removeMetaByName(html, "twitter:image");
    html = removeMetaByProperty(html, "og:url");
    html = removeMetaByProperty(html, "og:title");
    html = removeMetaByProperty(html, "og:description");
    html = removeMetaByProperty(html, "og:type");
    html = removeMetaByProperty(html, "og:site_name");
    html = removeMetaByProperty(html, "og:image");
    html = removeMetaByProperty(html, "og:image:width");
    html = removeMetaByProperty(html, "og:image:height");
    html = removeMetaByProperty(html, "og:image:alt");
    html = removeCanonical(html);

    // Extract and prepare values with fallbacks
    const title = seoData.seoTitle || seoData.companyName || "Company Name";
    const description = seoData.seoDescription || "";
    const ogImage = seoData.ogImage || "";
    const favicon = seoData.logoIcon || "/favicon.png";
    const keywords = seoData.seoKeywords || "";
    const author = seoData.seoAuthor || "";
    const canonicalUrl = seoData.seoCanonicalUrl || "";
    const robotsTag = seoData.seoRobotsTag || "index, follow";
    const ogType = seoData.ogType || "website";
    const ogSiteName = seoData.ogSiteName || seoData.companyName || "Company Name";
    const twitterCard = seoData.twitterCard || "summary_large_image";

    console.log("Injecting SEO data:");
    console.log(`   - Title: ${title}`);
    console.log(`   - Description: ${description.substring(0, 50)}...`);

    // Replace title
    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${escapeHtml(title)}</title>`
    );

    // Inject SEO tags
    const metaTags: string[] = [];
    metaTags.push(`<meta name="description" content="${escapeHtml(description)}" />`);

    if (keywords) {
      metaTags.push(`<meta name="keywords" content="${escapeHtml(keywords)}" />`);
    }
    if (author) {
      metaTags.push(`<meta name="author" content="${escapeHtml(author)}" />`);
    }
    if (robotsTag) {
      metaTags.push(`<meta name="robots" content="${escapeHtml(robotsTag)}" />`);
    }

    // Open Graph tags
    metaTags.push(`<meta property="og:title" content="${escapeHtml(title)}" />`);
    metaTags.push(`<meta property="og:description" content="${escapeHtml(description)}" />`);
    metaTags.push(`<meta property="og:type" content="${escapeHtml(ogType)}" />`);
    metaTags.push(`<meta property="og:site_name" content="${escapeHtml(ogSiteName)}" />`);

    if (ogImage) {
      const baseUrl = canonicalUrl ? new URL(canonicalUrl).origin : 'https://skale.club';
      const fullImageUrl = ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`;
      metaTags.push(`<meta property="og:image" content="${escapeHtml(fullImageUrl)}" />`);
      metaTags.push(`<meta property="og:image:width" content="1200" />`);
      metaTags.push(`<meta property="og:image:height" content="630" />`);
      metaTags.push(`<meta property="og:image:alt" content="${escapeHtml(title)}" />`);
    }

    if (canonicalUrl) {
      metaTags.push(`<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);
      metaTags.push(`<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);
    }

    // Twitter Card tags
    metaTags.push(`<meta name="twitter:card" content="${escapeHtml(twitterCard)}" />`);
    metaTags.push(`<meta name="twitter:title" content="${escapeHtml(title)}" />`);
    metaTags.push(`<meta name="twitter:description" content="${escapeHtml(description)}" />`);

    if (ogImage) {
      const baseUrl = canonicalUrl ? new URL(canonicalUrl).origin : 'https://skale.club';
      const fullImageUrl = ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`;
      metaTags.push(`<meta name="twitter:image" content="${escapeHtml(fullImageUrl)}" />`);
    }

    // Inject all meta tags before </head>
    html = html.replace(
      /<\/head>/,
      `  ${metaTags.join('\n    ')}\n  </head>`
    );

    // Update favicon if custom one exists
    if (favicon && favicon !== "/favicon.png") {
      html = html.replace(
        /<link rel="icon".*?\/>/,
        `<link rel="icon" type="image/png" href="${escapeHtml(favicon)}" />`
      );
    }

    // Write updated HTML back
    writeFileSync(indexPath, html, "utf-8");

    console.log("SEO data injected successfully!");
    console.log(`Updated file: ${indexPath}`);

    process.exit(0);
  } catch (error) {
    if ((error as any)?.code === "SELF_SIGNED_CERT_IN_CHAIN") {
      console.warn(
        "Skipping SEO injection due to self-signed certificate in chain.",
      );
      process.exit(0);
    }
    console.error("Error injecting SEO data:", error);
    // Don't fail the build, just warn
    console.warn("Build will continue with default SEO tags");
    process.exit(0);
  }
}

function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function removeMetaByName(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<meta\\s+[^>]*name=["']${escaped}["'][^>]*>`, "gi");
  return html.replace(regex, "");
}

function removeMetaByProperty(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<meta\\s+[^>]*property=["']${escaped}["'][^>]*>`, "gi");
  return html.replace(regex, "");
}

function removeCanonical(html: string): string {
  return html.replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi, "");
}

// Run the script
injectSEOData();
