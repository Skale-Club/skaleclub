import "dotenv/config";
import { storage } from "../server/storage.js";
import { pool } from "../server/db.js";
import { type SlideBlock } from "../shared/schema/presentations.js";

async function main() {
  console.log("Seeding 10 random presentations...");

  const guidelines = await storage.getBrandGuidelines();
  const guidelinesContent = guidelines?.content || "# Standard Brand Guidelines\nDefault style and tone for presentations.";

  const titles = [
    "Digital Transformation Roadmap",
    "AI-Powered Marketing Strategy",
    "Social Media Expansion Plan",
    "Customer Engagement Initiative",
    "E-commerce Growth Framework",
    "Enterprise Automation Overview",
    "Brand Identity Revitalization",
    "Lead Generation Masterclass",
    "Sales Pipeline Optimization",
    "Operational Excellence Report"
  ];

  const companies = [
    "Acme Corp", "Globex", "Soylent", "Initech", "Umbrella",
    "Hooli", "Pied Piper", "Dunder Mifflin", "Stark Industries", "Wayne Enterprises"
  ];

  const layouts: SlideBlock["layout"][] = [
    "cover", "section-break", "title-body", "bullets", "stats", "two-column", "image-focus", "closing"
  ];

  for (let i = 0; i < 10; i++) {
    const company = companies[Math.floor(Math.random() * companies.length)];
    const baseTitle = titles[i % titles.length];
    const fullTitle = `${baseTitle} - ${company}`;
    
    // Generate unique slug
    const timestamp = Date.now();
    const slug = `${fullTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}-${i}`;

    // Generate random slides
    const numSlides = Math.floor(Math.random() * 5) + 4; // 4 to 8 slides
    const slides: SlideBlock[] = [];

    // Always start with cover
    slides.push({
      layout: "cover",
      heading: fullTitle,
      headingPt: `${baseTitle} (PT) - ${company}`,
      body: "Comprehensive strategy presentation for the current fiscal year.",
      bodyPt: "Apresentação de estratégia abrangente para o ano fiscal atual."
    });

    for (let j = 0; j < numSlides - 2; j++) {
      const layout = layouts[Math.floor(Math.random() * (layouts.length - 2)) + 1]; // Skip cover and closing
      
      switch (layout) {
        case "bullets":
          slides.push({
            layout: "bullets",
            heading: `Key Pillars of ${baseTitle}`,
            bullets: ["Strategic Alignment", "Operational Efficiency", "Market Penetration", "Customer Satisfaction"],
            bulletsPt: ["Alinhamento Estratégico", "Eficiência Operacional", "Penetração de Mercado", "Satisfação do Cliente"]
          });
          break;
        case "stats":
          slides.push({
            layout: "stats",
            heading: "Projected Growth",
            stats: [
              { label: "ROI", value: "3.5x", labelPt: "ROI" },
              { label: "Cost Saving", value: "25%", labelPt: "Economia" },
              { label: "Market Share", value: "+12%", labelPt: "Quota de Mercado" }
            ]
          });
          break;
        case "title-body":
          slides.push({
            layout: "title-body",
            heading: "Implementation Strategy",
            body: "Our approach focuses on agile methodologies and continuous integration to ensure rapid deployment and high quality.",
            bodyPt: "Nossa abordagem foca em metodologias ágeis e integração contínua para garantir implantação rápida e alta qualidade."
          });
          break;
        default:
          slides.push({
            layout: "section-break",
            heading: "Detailed Analysis",
            body: "Deep dive into the data and market trends."
          });
      }
    }

    // Always end with closing
    slides.push({
      layout: "closing",
      heading: "Next Steps",
      body: `Thank you for your time. We look forward to partnering with ${company}.`,
      bodyPt: `Obrigado pelo seu tempo. Esperamos trabalhar com a ${company}.`
    });

    const presentation = {
      title: fullTitle,
      slug,
      slides,
      guidelinesSnapshot: guidelinesContent,
      accessCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      version: 1,
    };

    try {
      await storage.createPresentation(presentation);
      console.log(`[${i+1}/10] Created presentation: ${fullTitle} - Slug: ${slug}`);
    } catch (error) {
      console.error(`Failed to create presentation ${i+1}:`, error);
    }
  }

  console.log("\nSeeding finished successfully!");
}

main()
  .catch(err => {
    console.error("Fatal error during seeding:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
