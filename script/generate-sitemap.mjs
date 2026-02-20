
import fs from 'fs';

const routes = [
  '',
  'about-us',
  'blog',
  'contact',
  'faq',
  'portfolio',
  'privacy-policy',
  'terms-of-service',
  'users',
  'thank-you',
];

const BASE_URL = 'http://localhost:5000';

const sitemap = `
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${routes.map(route => `
    <url>
      <loc>${BASE_URL}/${route}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.8</priority>
    </url>
  `).join('')}
</urlset>
`;

fs.writeFileSync('client/public/sitemap.xml', sitemap.trim());

console.log('Sitemap generated successfully!');
