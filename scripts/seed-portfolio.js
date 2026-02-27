// Script to seed portfolio_services with current hardcoded data
// Uses the API endpoint to create services

const services = [
    {
        slug: "social-cash",
        title: "Social Cash",
        subtitle: "Total automation for your social media",
        description: "We create, schedule, and post high-converting content on autopilot, so you can focus on closing deals.",
        price: "$1,999.00",
        priceLabel: "One-time",
        badgeText: "One-time Fee",
        features: [
            "Complete social media autopost system",
            "Tgoo exclusive integration",
            "Multi-platform syndication",
            "Analytics and reporting"
        ],
        imageUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        iconName: "Share2",
        ctaText: "Automate Social Media",
        ctaButtonColor: "#406EF1",
        backgroundColor: "bg-white",
        textColor: "text-slate-900",
        accentColor: "blue",
        layout: "left",
        order: 1,
        isActive: true
    },
    {
        slug: "voice-ai",
        title: "Voice AI Assistant",
        subtitle: "Never miss a call or an opportunity",
        description: "Our Voice AI Assistant answers calls, books appointments, and captures leads 24/7.",
        price: "$49.90",
        priceLabel: "per month",
        badgeText: "Subscription",
        features: [
            "24/7 intelligent call answering",
            "Automated appointment booking",
            "FAQ resolution in natural language",
            "Instant SMS follow-ups"
        ],
        imageUrl: "https://images.unsplash.com/photo-1531746790731-6c087fecd65a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        iconName: "Bot",
        ctaText: "Hire AI Assistant",
        ctaButtonColor: "#8B5CF6",
        backgroundColor: "bg-[#1C1936]",
        textColor: "text-white",
        accentColor: "purple",
        layout: "right",
        order: 2,
        isActive: true
    },
    {
        slug: "crm",
        title: "CRM System",
        subtitle: "Seamlessly unify your lead management",
        description: "We provide a powerful pipeline that ensures no prospect ever falls through the cracks.",
        price: "$49.90",
        priceLabel: "per month",
        badgeText: "Subscription",
        features: [
            "Custom sales pipelines",
            "Automated SMS/Email follow-ups",
            "Centralized inbox (IG, FB, SMS)",
            "Advanced analytics & tracking"
        ],
        imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        iconName: "BarChart",
        ctaText: "Get The CRM",
        ctaButtonColor: "#10B981",
        backgroundColor: "bg-[#F8FAFC]",
        textColor: "text-[#1D1D1D]",
        accentColor: "emerald",
        layout: "left",
        order: 3,
        isActive: true
    },
    {
        slug: "scheduling",
        title: "Scheduling System",
        subtitle: "Let clients book and pay online",
        description: "We build custom websites centered entirely around an effortless booking experience.",
        price: "$1,490.00",
        priceLabel: "One-time",
        badgeText: "Setup",
        features: [
            "Full Scheduling Website",
            "Calendar syncing (Google/Outlook)",
            "Automatic reminders to reduce no-shows",
            "Integrated payment processing"
        ],
        imageUrl: "https://images.unsplash.com/photo-1506784951206-3962def1bb1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        iconName: "CalendarDays",
        ctaText: "Setup Scheduling",
        ctaButtonColor: "#F97316",
        backgroundColor: "bg-white",
        textColor: "text-slate-900",
        accentColor: "orange",
        layout: "right",
        order: 4,
        isActive: true
    },
    {
        slug: "websites",
        title: "Service Business Websites",
        subtitle: "Stop relying on Facebook pages",
        description: "Get a high-converting, professional digital storefront that turns visitors into leads.",
        price: "$600",
        priceLabel: "One-time Setup",
        badgeText: "Starting at",
        features: [
            "Up to 5 custom-designed pages",
            "Lead capture form integration",
            "100% Mobile & tablet optimized",
            "Built-in Local SEO structure"
        ],
        imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        iconName: "Monitor",
        ctaText: "Claim Your Website",
        ctaButtonColor: "#406EF1",
        backgroundColor: "bg-white",
        textColor: "text-slate-900",
        accentColor: "blue",
        layout: "left",
        order: 5,
        isActive: true
    }
];

async function seedPortfolio() {
    const baseUrl = process.env.API_URL || 'http://localhost:5000';

    console.log('Seeding portfolio services...');
    console.log(`API URL: ${baseUrl}`);

    for (const service of services) {
        try {
            const response = await fetch(`${baseUrl}/api/portfolio-services`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(service)
            });

            if (response.ok) {
                console.log(`✅ Created: ${service.title}`);
            } else {
                const error = await response.json();
                console.error(`❌ Failed to create ${service.title}:`, error.message);
            }
        } catch (error) {
            console.error(`❌ Error creating ${service.title}:`, error.message);
        }
    }

    console.log('\nDone!');
}

seedPortfolio();
