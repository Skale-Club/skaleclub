import { db } from '../server/db';
import { faqs } from '../shared/schema';

const faqData = [
  {
    question: "Qual é a política de cancelamento?",
    answer: "Você pode cancelar ou reagendar seu serviço gratuitamente até 24 horas antes do horário agendado. Cancelamentos com menos de 24 horas de antecedência estão sujeitos a uma taxa. Para cancelar, entre em contato conosco por telefone, email ou chat.",
    order: 1,
  },
  {
    question: "Quais são as formas de pagamento?",
    answer: "Aceitamos diversas formas de pagamento para sua conveniência: cartão de crédito, débito, PIX e transferência bancária.",
    order: 2,
  },
  {
    question: "Vocês oferecem garantia de satisfação?",
    answer: "Sim! Garantimos 100% de satisfação em todos os nossos serviços. Se você não ficar completamente satisfeito, faremos o possível para corrigir a situação. Sua satisfação é nossa prioridade.",
    order: 3,
  },
  {
    question: "Como agendo um serviço?",
    answer: "Você pode agendar diretamente pelo nosso site, clicando em 'Agendar', ou entrando em contato através do nosso chat ou telefone.",
    order: 4,
  },
  {
    question: "Qual é o horário de atendimento?",
    answer: "Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Para horários especiais ou finais de semana, consulte nossa disponibilidade.",
    order: 5,
  },
  {
    question: "Vocês atendem em quais regiões?",
    answer: "Atendemos toda a região metropolitana. Para confirmar se atendemos seu endereço específico, por favor entre em contato ou verifique no momento do agendamento.",
    order: 6,
  }
];

async function seedFaqs() {
  try {
    console.log('🌱 Starting FAQ seeding...');

    // Check if FAQs already exist
    const existing = await db.select().from(faqs);

    if (existing.length > 0) {
      console.log(`⚠️  Found ${existing.length} existing FAQs. Skipping seed.`);
      console.log('💡 To re-seed, delete existing FAQs first.');
      return;
    }

    // Insert all FAQs
    for (const faq of faqData) {
      await db.insert(faqs).values(faq);
      console.log(`✅ Created: "${faq.question.substring(0, 50)}..."`);
    }

    console.log(`\n🎉 Successfully seeded ${faqData.length} FAQs!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding FAQs:', error);
    process.exit(1);
  }
}

seedFaqs();
