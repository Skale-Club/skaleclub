import "dotenv/config";
import { db } from "../server/db";
import { companySettings } from "../shared/schema";
import type { HomepageContent } from "../shared/schema";

async function seedTechContent() {
  try {
    console.log("🚀 Seeding tech company content...\n");

    const homepageContent: HomepageContent = {
      heroBadgeImageUrl: '',
      heroBadgeAlt: '',
      
      // Trust Badges
      trustBadges: [
        {
          icon: 'zap',
          title: 'Fast Implementation',
          description: 'Solutions deployed in weeks, not months'
        },
        {
          icon: 'shield',
          title: 'Enterprise Security',
          description: 'Bank-level security standards'
        },
        {
          icon: 'trophy',
          title: 'Proven Results',
          description: '50+ successful implementations'
        }
      ],

      // Services Section - Using new unified horizontal scroll
      horizontalScrollSection: {
        enabled: true,
        mode: 'services',
        sectionId: 'our-solutions',
        tagLabel: 'What We Do',
        title: 'Tech Solutions That Scale Your Business',
        subtitle: 'From AI automation to custom systems - we build what you need to grow',
        cards: [
          {
            order: 1,
            numberLabel: '01',
            icon: 'bot',
            title: 'AI Solutions',
            description: 'Intelligent chatbots, AI agents, and automation that work 24/7 for your business.',
            features: [
              'AI Chatbots & Virtual Assistants',
              'Intelligent Process Automation',
              'Custom AI-Powered Tools',
            ],
          },
          {
            order: 2,
            numberLabel: '02',
            icon: 'globe',
            title: 'Smart Websites',
            description: 'High-converting, SEO-optimized websites that turn visitors into customers.',
            features: [
              'Landing Pages That Convert',
              'Corporate & Portfolio Sites',
              'SEO & Performance Optimization',
            ],
          },
          {
            order: 3,
            numberLabel: '03',
            icon: 'chartbar',
            title: 'Custom Internal Systems',
            description: 'Tailored systems that streamline your operations and boost productivity.',
            features: [
              'Custom CRM Solutions',
              'Real-Time Analytics Dashboards',
              'Workflow Management Systems',
            ],
          },
          {
            order: 4,
            numberLabel: '04',
            icon: 'zap',
            title: 'Business Automation',
            description: 'Automate repetitive tasks and focus on what really matters for your growth.',
            features: [
              'Marketing & Sales Automation',
              'No-Code Solutions (Make, Zapier, N8N)',
              'Custom Workflow Automation',
            ],
          },
          {
            order: 5,
            numberLabel: '05',
            icon: 'messagesquare',
            title: 'Implementation Consulting',
            description: 'Expert guidance to successfully implement and adopt new technologies.',
            features: [
              'Digital Transformation Strategy',
              'Team Training & Onboarding',
              'Ongoing Technical Support',
            ],
          },
        ],
        practicalBlockTitle: 'Why Choose Us',
        practicalBlockSubtitle: 'What makes us different',
        practicalBullets: [
          'Solutions deployed in weeks, not months',
          'Dedicated technical team for each project',
          '24/7 monitoring and support',
        ],
        ctaButtonLabel: 'Start Your Project',
        ctaButtonLink: '#lead-form',
        helperText: 'Ready to transform your business with technology',
        nextStepLabel: 'Ready to start?',
        nextStepText: 'Schedule your free consultation today',
      },

      // Reviews Section
      reviewsSection: {
        title: 'What Our Clients Say',
        subtitle: 'Real results from businesses we\'ve helped transform with technology.',
        embedUrl: '',
      },

      // Blog Section
      blogSection: {
        title: 'Tech Insights & Updates',
        subtitle: 'Latest articles on AI, automation, and digital transformation',
        viewAllText: 'View All Articles',
        readMoreText: 'Read More',
      },

      // About Section
      aboutSection: {
        label: 'About Us',
        heading: 'Tech Solutions That Drive Results',
        description: 'We are a technology solutions company specializing in AI, automation, and custom software development. We help businesses leverage cutting-edge technology to scale, optimize operations, and stay ahead of the competition.',
        defaultImageUrl: '',
        highlights: [
          {
            title: 'Innovation',
            description: 'Leveraging the latest in AI and automation technology.',
          },
          {
            title: 'Expertise',
            description: 'Years of experience building scalable solutions.',
          },
          {
            title: 'Custom Solutions',
            description: 'Every solution tailored to your unique needs.',
          },
        ],
      },

      // Areas Served Section
      areasServedSection: {
        label: 'Where We Serve',
        heading: 'Serving Businesses Worldwide',
        description: 'We work with companies across the globe, delivering remote and on-site solutions.',
        ctaText: 'Contact Us',
      },

      // How We Work Section
      consultingStepsSection: {
        enabled: true,
        sectionId: 'how-it-works',
        title: 'How We Work',
        subtitle: 'Our proven process for delivering successful tech solutions.',
        steps: [
          {
            order: 1,
            numberLabel: '01',
            icon: 'search',
            title: 'Discovery & Analysis',
            whatWeDo: 'We dive deep into your business processes, challenges, and goals to understand exactly what you need.',
            outcome: 'A clear roadmap of opportunities and technical solutions.',
          },
          {
            order: 2,
            numberLabel: '02',
            icon: 'sparkles',
            title: 'Solution Design',
            whatWeDo: 'We architect the perfect tech stack and create a detailed implementation plan with timeline and ROI projections.',
            outcome: 'A comprehensive proposal with transparent pricing and expected results.',
          },
          {
            order: 3,
            numberLabel: '03',
            icon: 'layout',
            title: 'Development & Testing',
            whatWeDo: 'We build, test, and refine your solution using agile methodology with regular updates and previews.',
            outcome: 'A fully functional, tested solution ready for deployment.',
          },
          {
            order: 4,
            numberLabel: '04',
            icon: 'target',
            title: 'Deployment & Support',
            whatWeDo: 'We launch your solution, train your team, and provide ongoing monitoring and optimization.',
            outcome: 'A live system with confident users and continuous improvement.',
          },
        ],
        practicalBlockTitle: 'In Practice',
        practicalBullets: [
          'Agile sprints with weekly updates.',
          'Dedicated technical team.',
          '24/7 monitoring and support.',
        ],
        ctaButtonLabel: 'Start Your Project',
        ctaButtonLink: '#lead-form',
        helperText: 'Ready to transform your business with technology.',
        tagLabel: 'Our Process',
        stepLabel: 'Step',
        whatWeDoLabel: 'What we do',
        outcomeLabel: 'You get',
        practicalBlockSubtitle: 'How the work happens day-to-day',
        nextStepLabel: 'Next step',
        nextStepText: 'Schedule open for new projects',
      },
    };

    // Update company settings with new tech content
    const existing = await db.select().from(companySettings).limit(1);

    if (existing.length === 0) {
      // Insert new settings
      await db.insert(companySettings).values({
        companyName: 'Skale Club',
        companyEmail: 'contact@skaleclub.com',
        companyPhone: '',
        heroTitle: 'Stop Doing Repetitive Work. Automate It.',
        heroSubtitle: 'From AI chatbots to custom dashboards - we build the tech your business actually needs',
        ctaText: 'See How We Can Help',
        seoTitle: 'Skale Club - AI Automation & Custom Software Development',
        seoDescription: 'We automate repetitive work with AI chatbots, smart websites, custom systems, and business automation. Built for companies ready to scale.',
        homepageContent,
      });
      console.log("✅ Created new company settings with tech content");
    } else {
      // Update existing settings
      await db
        .update(companySettings)
        .set({
          heroTitle: 'Stop Doing Repetitive Work. Automate It.',
          heroSubtitle: 'From AI chatbots to custom dashboards - we build the tech your business actually needs',
          ctaText: 'See How We Can Help',
          seoTitle: 'Skale Club - AI Automation & Custom Software Development',
          seoDescription: 'We automate repetitive work with AI chatbots, smart websites, custom systems, and business automation. Built for companies ready to scale.',
          homepageContent,
        });
      console.log("✅ Updated company settings with tech content");
    }

    console.log("\n📊 Content Summary:");
    console.log("   - Trust Badges: 3");
    console.log("   - Services: 5");
    console.log("   - Process Steps: 4");
    console.log("   - About Highlights: 3");
    
    console.log("\n🎉 Tech content seeded successfully!");
    console.log("\n💡 Next steps:");
    console.log("   1. Update company name, email, and phone in admin");
    console.log("   2. Upload hero image and about image");
    console.log("   3. Configure reviews embed URL");
    console.log("   4. Add blog posts about tech topics");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding tech content:", error);
    process.exit(1);
  }
}

seedTechContent();
