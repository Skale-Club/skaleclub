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

    // Fetch company settings from database
    const settings = await db.select().from(companySettings).limit(1);
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

    // Extract and prepare values with fallbacks
    const title = seoData.seoTitle || seoData.companyName || "Skale Club";
    const description = seoData.seoDescription || "";
    const ogImage = seoData.ogImage || "";
    const favicon = seoData.logoIcon || "/favicon.png";
    const keywords = seoData.seoKeywords || "";
    const author = seoData.seoAuthor || "";
    const canonicalUrl = seoData.seoCanonicalUrl || "";
    const robotsTag = seoData.seoRobotsTag || "index, follow";
    const ogType = seoData.ogType || "website";
    const ogSiteName = seoData.ogSiteName || seoData.companyName || "Skale Club";
    const twitterCard = seoData.twitterCard || "summary_large_image";

    console.log("Injecting SEO data:");
    console.log(`   - Title: ${title}`);
    console.log(`   - Description: ${description.substring(0, 50)}...`);

    // Replace title
    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${escapeHtml(title)}</title>`
    );

    // Replace or inject meta description
    if (html.includes('name="description"')) {
      html = html.replace(
        /<meta name="description" content=".*?".*?\/>/,
        `<meta name="description" content="${escapeHtml(description)}" />`
      );
    } else {
      html = html.replace(
        /<\/head>/,
        `  <meta name="description" content="${escapeHtml(description)}" />\n  </head>`
      );
    }

    // Inject additional meta tags (after description meta tag)
    const metaTags: string[] = [];

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
      const fullImageUrl = ogImage.startsWith('http') ? ogImage : `https://yourdomain.com${ogImage}`;
      metaTags.push(`<meta property="og:image" content="${escapeHtml(fullImageUrl)}" />`);
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
      const fullImageUrl = ogImage.startsWith('http') ? ogImage : `https://yourdomain.com${ogImage}`;
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

// Run the script
injectSEOData();
