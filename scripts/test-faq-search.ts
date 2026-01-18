import { db } from '../server/db';
import { faqs } from '../shared/schema';

async function testFaqSearch() {
  try {
    console.log('🔍 Testing FAQ Search Functionality\n');
    console.log('=' .repeat(80));

    // Test 1: Search for "cancellation"
    console.log('\n📌 Test 1: Search for "cancellation"');
    const query1 = 'cancellation';
    const allFaqs = await db.select().from(faqs);
    const results1 = allFaqs.filter(faq =>
      faq.question.toLowerCase().includes(query1.toLowerCase()) ||
      faq.answer.toLowerCase().includes(query1.toLowerCase())
    );
    console.log(`   Found ${results1.length} result(s):`);
    results1.forEach(faq => console.log(`   - ${faq.question}`));

    // Test 2: Search for "eco-friendly"
    console.log('\n📌 Test 2: Search for "eco-friendly"');
    const query2 = 'eco-friendly';
    const results2 = allFaqs.filter(faq =>
      faq.question.toLowerCase().includes(query2.toLowerCase()) ||
      faq.answer.toLowerCase().includes(query2.toLowerCase())
    );
    console.log(`   Found ${results2.length} result(s):`);
    results2.forEach(faq => console.log(`   - ${faq.question}`));

    // Test 3: Search for "guarantee"
    console.log('\n📌 Test 3: Search for "guarantee"');
    const query3 = 'guarantee';
    const results3 = allFaqs.filter(faq =>
      faq.question.toLowerCase().includes(query3.toLowerCase()) ||
      faq.answer.toLowerCase().includes(query3.toLowerCase())
    );
    console.log(`   Found ${results3.length} result(s):`);
    results3.forEach(faq => console.log(`   - ${faq.question}`));

    // Test 4: Search for "pets"
    console.log('\n📌 Test 4: Search for "pets"');
    const query4 = 'pets';
    const results4 = allFaqs.filter(faq =>
      faq.question.toLowerCase().includes(query4.toLowerCase()) ||
      faq.answer.toLowerCase().includes(query4.toLowerCase())
    );
    console.log(`   Found ${results4.length} result(s):`);
    results4.forEach(faq => console.log(`   - ${faq.question}`));

    // Test 5: Search for "stain"
    console.log('\n📌 Test 5: Search for "stain"');
    const query5 = 'stain';
    const results5 = allFaqs.filter(faq =>
      faq.question.toLowerCase().includes(query5.toLowerCase()) ||
      faq.answer.toLowerCase().includes(query5.toLowerCase())
    );
    console.log(`   Found ${results5.length} result(s):`);
    results5.forEach(faq => console.log(`   - ${faq.question}`));

    // Test 6: Get all FAQs (no query)
    console.log('\n📌 Test 6: Get all FAQs (no query)');
    console.log(`   Total FAQs: ${allFaqs.length}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests completed successfully!\n');

    console.log('💡 The chat AI can now search these FAQs using the search_faqs tool');
    console.log('💡 Test it by asking questions like:');
    console.log('   - "What is your cancellation policy?"');
    console.log('   - "Do you use eco-friendly products?"');
    console.log('   - "Are your products safe for pets?"');
    console.log('   - "Can you remove wine stains?"');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing FAQ search:', error);
    process.exit(1);
  }
}

testFaqSearch();
