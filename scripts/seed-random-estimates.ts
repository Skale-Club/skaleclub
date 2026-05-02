import "dotenv/config";
import { storage } from "../server/storage.js";
import { db } from "../server/db.js";
import { pool } from "../server/db.js";

async function main() {
  console.log("Seeding 10 random estimates...");

  const services = await storage.getPortfolioServices();
  if (services.length === 0) {
    console.log("No portfolio services found. Please run seed script first.");
    process.exit(1);
  }

  const companies = [
    "Acme Corp", "Globex Corporation", "Soylent Corp", "Initech", "Umbrella Corp",
    "Hooli", "Pied Piper", "Dunder Mifflin", "Stark Industries", "Wayne Enterprises",
    "Oscorp", "Cyberdyne Systems", "Tyrell Corporation", "Weyland-Yutani", "Vandelay Industries"
  ];

  const clients = [
    "John Doe", "Jane Smith", "Michael Scott", "Bruce Wayne", "Tony Stark",
    "Richard Hendricks", "Bertram Gilfoyle", "Dinesh Chugtai", "Jared Dunn", "Monica Hall",
    "Peter Parker", "Sarah Connor", "Rick Deckard", "Ellen Ripley", "George Costanza"
  ];

  const notes = [
    "Project focused on brand expansion.",
    "Initial proposal for digital transformation.",
    "Focus on increasing user engagement.",
    "Scaling infrastructure for upcoming launch.",
    "Implementing AI-driven automation.",
    "Modernizing legacy systems.",
    "Optimizing marketing funnels.",
    "Building a new customer portal.",
    "Expanding social media presence.",
    "Consolidating data pipelines."
  ];

  for (let i = 0; i < 10; i++) {
    const companyName = companies[Math.floor(Math.random() * companies.length)];
    const clientName = clients[Math.floor(Math.random() * clients.length)];
    const randomService = services[Math.floor(Math.random() * services.length)];
    const randomNote = notes[Math.floor(Math.random() * notes.length)];
    
    // Generate a unique slug
    const timestamp = Date.now();
    const randomPart = Math.floor(Math.random() * 1000);
    const slug = `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}-${randomPart}`;

    const estimate = {
      clientName,
      companyName,
      contactName: clientName,
      slug,
      note: `${randomNote} Using ${randomService.title}.`,
      services: [
        {
          type: "catalog" as const,
          sourceId: randomService.id,
          title: randomService.title,
          description: randomService.description,
          price: randomService.price,
          features: randomService.features || [],
          order: 0,
        }
      ],
      accessCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
    };

    try {
      await storage.createEstimate(estimate);
      console.log(`[${i+1}/10] Created estimate for ${clientName} (${companyName}) - Slug: ${slug}`);
    } catch (error) {
      console.error(`Failed to create estimate ${i+1}:`, error);
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
