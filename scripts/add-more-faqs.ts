import { db } from '../server/db';
import { faqs } from '../shared/schema';

const additionalFaqs = [
  {
    question: "Qual é a política de cancelamento?",
    answer: "You can cancel or reschedule your service for free up to 24 hours before the scheduled time. Cancellations with less than 24 hours notice are subject to a 50% service fee. To cancel, contact us by phone, email, or chat.",
    order: 11,
  },
  {
    question: "Do you use eco-friendly products?",
    answer: "Yes! We exclusively use eco-friendly, certified, and biodegradable cleaning products. All our products are safe for children and pets, contain no harsh chemicals, and are hypoallergenic. If you have specific allergies or product preferences, please let us know in advance.",
    order: 12,
  },
  {
    question: "Do you offer a satisfaction guarantee?",
    answer: "Yes! We guarantee 100% satisfaction on all our services. If you're not completely satisfied with the cleaning, we'll redo the service at no additional cost within 24 hours. Your comfort and satisfaction are our priority.",
    order: 13,
  },
  {
    question: "Do I need to be home during the service?",
    answer: "It's not mandatory to be present during the entire service, but we recommend someone be home at the start to let us in and at the end to approve the work. If you can't be present, we can arrange a secure way to access the location. All our professionals are trained, vetted, and insured.",
    order: 14,
  },
  {
    question: "What is your cleaning process?",
    answer: "Our professional cleaning process follows 5 steps: 1) Initial inspection and stain identification, 2) Deep vacuuming to remove surface dirt, 3) Pre-treatment of tough stains, 4) Deep cleaning with steam and extraction, 5) Deodorization and final quality inspection. The entire process uses state-of-the-art professional equipment.",
    order: 15,
  },
  {
    question: "Can you remove difficult stains?",
    answer: "Yes! We specialize in removing tough stains like wine, coffee, grease, pet stains, makeup, and more. We use specific products for each type of stain. While we can't guarantee 100% removal in all cases (very old stains may be permanent), our success rate exceeds 90%. Assessment is done on-site.",
    order: 16,
  },
  {
    question: "What if I'm not satisfied with the service?",
    answer: "Customer satisfaction is our top priority. If you're not completely happy with our service, please contact us within 24 hours and we'll return to re-clean the area at no additional charge. We stand behind our work 100%.",
    order: 17,
  },
  {
    question: "Are your cleaning products safe for pets and children?",
    answer: "Absolutely! All our cleaning products are pet-safe, child-safe, non-toxic, and eco-friendly. We use only certified green cleaning solutions that are effective yet gentle. Your family's safety is as important to us as the cleanliness of your home.",
    order: 18,
  },
  {
    question: "How far in advance should I book?",
    answer: "We recommend booking at least 2-3 days in advance to ensure your preferred time slot is available. However, we often accommodate same-day or next-day appointments depending on availability. Weekend slots fill up quickly, so book early for Saturday appointments.",
    order: 19,
  },
  {
    question: "Can I reschedule my appointment?",
    answer: "Yes, you can reschedule your appointment at no charge if you notify us at least 24 hours before your scheduled service time. Simply contact us via phone, email, or chat and we'll help you find a new time that works for you.",
    order: 20,
  },
];

async function addMoreFaqs() {
  try {
    console.log('🌱 Adding additional FAQs...\n');

    // Insert all FAQs
    for (const faq of additionalFaqs) {
      await db.insert(faqs).values(faq);
      console.log(`✅ Added: "${faq.question}"`);
    }

    console.log(`\n🎉 Successfully added ${additionalFaqs.length} new FAQs!`);
    console.log(`\n📊 Total FAQs in database now: ${11 + additionalFaqs.length}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding FAQs:', error);
    process.exit(1);
  }
}

addMoreFaqs();
