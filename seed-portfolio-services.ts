import { db } from './server/db';
import { portfolioServices } from './shared/schema';

async function seedPortfolioServices() {
    console.log('Checking for existing portfolio services...');

    const existing = await db.select().from(portfolioServices);
    console.log(`Found ${existing.length} existing services`);

    if (existing.length === 0) {
        console.log('Seeding default portfolio services...');

        const defaultServices = [
            {
                slug: 'social-cash',
                title: 'Social Cash',
                subtitle: 'Transform social media into revenue',
                description: 'Turn your social media presence into a predictable revenue stream with our proven social selling system.',
                price: '$997',
                priceLabel: '/month',
                badgeText: 'Best Seller',
                features: ['Social Media Strategy', 'Content Creation', 'Lead Generation', 'Sales Funnel Integration', 'Monthly Analytics Report'],
                iconName: 'trending-up',
                ctaText: 'Get Started',
                ctaButtonColor: '#406EF1',
                backgroundColor: 'bg-gradient-to-br from-[#1a1a2e] to-[#16213e]',
                accentColor: 'blue',
                layout: 'right',
                order: 1,
                isActive: true
            },
            {
                slug: 'voice-ai',
                title: 'Voice AI',
                subtitle: '24/7 AI-powered customer service',
                description: 'Deploy intelligent voice agents that handle calls, book appointments, and answer questions around the clock.',
                price: '$1,497',
                priceLabel: '/month',
                badgeText: 'New',
                features: ['AI Voice Agent', '24/7 Availability', 'Multi-language Support', 'CRM Integration', 'Call Transcription'],
                iconName: 'phone',
                ctaText: 'Learn More',
                ctaButtonColor: '#10B981',
                backgroundColor: 'bg-gradient-to-br from-[#0f2027] to-[#203a43]',
                accentColor: 'green',
                layout: 'left',
                order: 2,
                isActive: true
            },
            {
                slug: 'crm-system',
                title: 'CRM System',
                subtitle: 'Complete customer relationship management',
                description: 'A powerful CRM tailored to your business needs, helping you track leads, manage customers, and close more deals.',
                price: '$497',
                priceLabel: '/month',
                badgeText: 'Popular',
                features: ['Contact Management', 'Pipeline Tracking', 'Email Automation', 'Task Management', 'Reporting Dashboard'],
                iconName: 'users',
                ctaText: 'Get Started',
                ctaButtonColor: '#8B5CF6',
                backgroundColor: 'bg-gradient-to-br from-[#2d1b4e] to-[#1a1a2e]',
                accentColor: 'purple',
                layout: 'right',
                order: 3,
                isActive: true
            },
            {
                slug: 'scheduling-automation',
                title: 'Scheduling Automation',
                subtitle: 'Never miss a booking again',
                description: 'Automated scheduling system that syncs with your calendar, sends reminders, and reduces no-shows.',
                price: '$297',
                priceLabel: '/month',
                badgeText: 'Essential',
                features: ['Calendar Integration', 'Automated Reminders', 'Online Booking Page', 'Team Scheduling', 'Timezone Detection'],
                iconName: 'calendar',
                ctaText: 'Book Demo',
                ctaButtonColor: '#F59E0B',
                backgroundColor: 'bg-gradient-to-br from-[#1e3a5f] to-[#0d1b2a]',
                accentColor: 'orange',
                layout: 'left',
                order: 4,
                isActive: true
            },
            {
                slug: 'custom-websites',
                title: 'Custom Websites',
                subtitle: 'Professional web presence that converts',
                description: 'Beautiful, fast, and SEO-optimized websites designed to turn visitors into customers.',
                price: '$2,997',
                priceLabel: 'one-time',
                badgeText: 'Premium',
                features: ['Custom Design', 'Mobile Responsive', 'SEO Optimized', 'Contact Forms', 'Analytics Setup'],
                iconName: 'globe',
                ctaText: 'Start Project',
                ctaButtonColor: '#EF4444',
                backgroundColor: 'bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d]',
                accentColor: 'red',
                layout: 'right',
                order: 5,
                isActive: true
            }
        ];

        for (const service of defaultServices) {
            await db.insert(portfolioServices).values(service);
            console.log(`Inserted: ${service.title}`);
        }

        console.log('Seeding complete!');
    } else {
        console.log('Services already exist. Current services:');
        existing.forEach(s => console.log(`  - ${s.title} (active: ${s.isActive})`));
    }

    process.exit(0);
}

seedPortfolioServices().catch(err => {
    console.error('Error seeding portfolio services:', err);
    process.exit(1);
});
