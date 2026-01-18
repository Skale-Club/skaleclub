import { db } from '../server/db';
import { faqs } from '../shared/schema';

async function viewFaqs() {
  try {
    const allFaqs = await db.select().from(faqs);

    console.log(`\n📋 Total FAQs in database: ${allFaqs.length}\n`);
    console.log('=' .repeat(80));

    allFaqs.forEach((faq, index) => {
      console.log(`\n${index + 1}. ${faq.question}`);
      console.log(`   ${faq.answer.substring(0, 100)}...`);
      console.log(`   Order: ${faq.order}`);
    });

    console.log('\n' + '='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('❌ Error viewing FAQs:', error);
    process.exit(1);
  }
}

viewFaqs();
