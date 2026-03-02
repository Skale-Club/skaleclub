import 'dotenv/config';
import { db } from './server/db';
import { portfolioServices } from './shared/schema';

async function resetPortfolioServices() {
    console.log('Clearing existing portfolio services...');

    // Delete all existing services
    await db.delete(portfolioServices);
    console.log('All existing services deleted.');

    console.log('Seeding new portfolio services...');

    const newServices = [
        {
            slug: 'astropilot',
            title: 'Astropilot',
            subtitle: 'Social Media AI Creator',
            description: 'Automate your social media presence with AI-powered content creation. Generate engaging posts, captions, and visuals that resonate with your audience.',
            price: '$497',
            priceLabel: '/month',
            badgeText: 'AI Powered',
            features: ['AI Content Generation', 'Multi-Platform Posting', 'Hashtag Optimization', 'Engagement Analytics', 'Content Calendar'],
            iconName: 'sparkles',
            ctaText: 'Get Started',
            ctaButtonColor: '#8B5CF6',
            backgroundColor: 'bg-gradient-to-br from-[#1a1a2e] to-[#2d1b4e]',
            accentColor: '#8B5CF6',
            order: 1,
            isActive: true
        },
        {
            slug: 'websites',
            title: 'Websites',
            subtitle: 'Basic & Custom Solutions',
            description: 'Professional websites tailored to your business needs. From simple landing pages to complex web applications, we build solutions that convert visitors into customers.',
            price: '$1,997',
            priceLabel: 'starting',
            badgeText: 'Popular',
            features: ['Responsive Design', 'SEO Optimized', 'Fast Loading', 'Contact Forms', 'Analytics Integration'],
            iconName: 'globe',
            ctaText: 'Start Project',
            ctaButtonColor: '#406EF1',
            backgroundColor: 'bg-gradient-to-br from-[#0f2027] to-[#203a43]',
            accentColor: '#406EF1',
            order: 2,
            isActive: true
        },
        {
            slug: 'chatbot',
            title: 'Chatbot',
            subtitle: 'SMS / WhatsApp / Telegram / Web',
            description: 'Intelligent chatbots that engage customers across all major messaging platforms. Automate support, qualify leads, and book appointments 24/7.',
            price: '$797',
            priceLabel: '/month',
            badgeText: 'Multi-Channel',
            features: ['SMS Integration', 'WhatsApp Business', 'Telegram Bot', 'Website Widget', 'Lead Qualification'],
            iconName: 'message-circle',
            ctaText: 'Learn More',
            ctaButtonColor: '#10B981',
            backgroundColor: 'bg-gradient-to-br from-[#0d3b2e] to-[#0f2027]',
            accentColor: '#10B981',
            order: 3,
            isActive: true
        },
        {
            slug: 'payment-system',
            title: 'Payment System',
            subtitle: 'Stripe Integration',
            description: 'Seamless payment processing with Stripe integration. Accept payments online, set up subscriptions, and manage invoices with ease.',
            price: '$397',
            priceLabel: 'one-time',
            badgeText: 'Essential',
            features: ['Stripe Setup', 'Payment Forms', 'Subscription Management', 'Invoice Generation', 'Secure Transactions'],
            iconName: 'credit-card',
            ctaText: 'Get Started',
            ctaButtonColor: '#6366F1',
            backgroundColor: 'bg-gradient-to-br from-[#1e1b4b] to-[#312e81]',
            accentColor: '#6366F1',
            order: 4,
            isActive: true
        },
        {
            slug: 'voice-assistant',
            title: 'Voice Assistant',
            subtitle: 'AI Helping With Your Needs',
            description: 'Deploy intelligent voice assistants that handle calls, answer questions, and provide customer support around the clock with natural conversation.',
            price: '$1,297',
            priceLabel: '/month',
            badgeText: 'AI Powered',
            features: ['24/7 Availability', 'Natural Voice', 'Call Routing', 'Appointment Booking', 'Multi-Language'],
            iconName: 'phone',
            ctaText: 'Book Demo',
            ctaButtonColor: '#F59E0B',
            backgroundColor: 'bg-gradient-to-br from-[#1a1a2e] to-[#16213e]',
            accentColor: '#F59E0B',
            order: 5,
            isActive: true
        },
        {
            slug: 'scheduling-system',
            title: 'Scheduling System',
            subtitle: 'Never Miss a Booking',
            description: 'Automated scheduling that syncs with your calendar, sends reminders, and reduces no-shows. Perfect for service-based businesses.',
            price: '$297',
            priceLabel: '/month',
            badgeText: 'Essential',
            features: ['Calendar Sync', 'Automated Reminders', 'Online Booking', 'Timezone Support', 'Team Scheduling'],
            iconName: 'calendar',
            ctaText: 'Get Started',
            ctaButtonColor: '#EC4899',
            backgroundColor: 'bg-gradient-to-br from-[#831843] to-[#1a1a2e]',
            accentColor: '#EC4899',
            order: 6,
            isActive: true
        },
        {
            slug: 'crm-setup',
            title: 'CRM Setup',
            subtitle: 'Go High Level Integration',
            description: 'Complete CRM setup with Go High Level. Manage leads, automate follow-ups, and track your sales pipeline in one powerful platform.',
            price: '$597',
            priceLabel: 'one-time',
            badgeText: 'Recommended',
            features: ['GHL Setup', 'Pipeline Configuration', 'Email Automation', 'SMS Campaigns', 'Reporting Dashboard'],
            iconName: 'users',
            ctaText: 'Get Started',
            ctaButtonColor: '#14B8A6',
            backgroundColor: 'bg-gradient-to-br from-[#134e4a] to-[#0f2027]',
            accentColor: '#14B8A6',
            order: 7,
            isActive: true
        },
        {
            slug: 'openclaw-deployment',
            title: 'OpenClaw Deployment',
            subtitle: 'Custom AI Deployment',
            description: 'Deploy custom AI solutions tailored to your business needs. Automate complex workflows and integrate AI into your existing systems.',
            price: '$2,497',
            priceLabel: 'starting',
            badgeText: 'Premium',
            features: ['Custom AI Models', 'Workflow Automation', 'API Integration', 'Training & Support', 'Scalable Infrastructure'],
            iconName: 'cpu',
            ctaText: 'Contact Us',
            ctaButtonColor: '#EF4444',
            backgroundColor: 'bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d]',
            accentColor: '#EF4444',
            order: 8,
            isActive: true
        }
    ];

    for (const service of newServices) {
        await db.insert(portfolioServices).values(service);
        console.log(`✓ Inserted: ${service.title}`);
    }

    console.log('\n✅ Portfolio services reset complete!');
    console.log(`Total services: ${newServices.length}`);

    process.exit(0);
}

resetPortfolioServices().catch(err => {
    console.error('Error resetting portfolio services:', err);
    process.exit(1);
});
