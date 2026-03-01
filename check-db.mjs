import { db } from './server/db.js';
import { portfolioServices } from './shared/schema.js';

const services = await db.select().from(portfolioServices);
console.log('Portfolio services in DB:', JSON.stringify(services, null, 2));
process.exit(0);
