import { db } from '../server/db';
import { faqs } from '../shared/schema';

const faqData = [
  {
    question: "Qual é a política de cancelamento?",
    answer: "Você pode cancelar ou reagendar seu serviço gratuitamente até 24 horas antes do horário agendado. Cancelamentos com menos de 24 horas de antecedência estão sujeitos a uma taxa de 50% do valor do serviço. Para cancelar, entre em contato conosco por telefone, email ou chat.",
    order: 1,
  },
  {
    question: "Que produtos vocês usam na limpeza?",
    answer: "Utilizamos exclusivamente produtos de limpeza eco-friendly, certificados e biodegradáveis. Todos os nossos produtos são seguros para crianças e pets, não contêm químicos agressivos e são hipoalergênicos. Se você tiver alguma alergia específica ou preferência por produtos, informe-nos com antecedência.",
    order: 2,
  },
  {
    question: "Vocês oferecem garantia de satisfação?",
    answer: "Sim! Garantimos 100% de satisfação em todos os nossos serviços. Se você não ficar completamente satisfeito com a limpeza, refazemos o serviço sem custo adicional dentro de 24 horas. Seu conforto e satisfação são nossa prioridade.",
    order: 3,
  },
  {
    question: "Quanto tempo leva para secar após a limpeza?",
    answer: "O tempo de secagem varia entre 2 a 4 horas, dependendo do tipo de serviço, ventilação do ambiente e umidade do dia. Para sofás e estofados, recomendamos aguardar 3-4 horas antes de usar. Para carpetes e tapetes, o ideal é de 4-6 horas. Utilizamos equipamentos de extração potentes para minimizar o tempo de secagem.",
    order: 4,
  },
  {
    question: "Quais formas de pagamento vocês aceitam?",
    answer: "Aceitamos diversas formas de pagamento para sua conveniência: cartão de crédito e débito (Visa, Mastercard, American Express), PIX, dinheiro e transferência bancária. O pagamento pode ser feito no local após o serviço (site) ou online no momento da reserva.",
    order: 5,
  },
  {
    question: "Preciso estar em casa durante o serviço?",
    answer: "Não é obrigatório estar presente durante todo o serviço, mas recomendamos que alguém esteja em casa no início para nos receber e no final para aprovar o trabalho. Se não puder estar presente, podemos combinar uma forma segura de acesso ao local. Todos os nossos profissionais são treinados, verificados e segurados.",
    order: 6,
  },
  {
    question: "Como funciona o processo de limpeza?",
    answer: "Nosso processo de limpeza profissional segue 5 etapas: 1) Inspeção inicial e identificação de manchas, 2) Aspiração profunda para remover sujeira superficial, 3) Pré-tratamento de manchas difíceis, 4) Limpeza profunda com vapor e extração, 5) Desodorização e inspeção final de qualidade. Todo o processo é feito com equipamentos profissionais de última geração.",
    order: 7,
  },
  {
    question: "Quanto tempo dura cada serviço?",
    answer: "A duração varia conforme o serviço: sofás de 2-3 lugares (1-1.5h), sofás maiores (2-2.5h), carpetes por cômodo (1-1.5h), colchões (45min-1h), estofados de carros (2-3h). O tempo pode variar dependendo do nível de sujeira e manchas específicas. Sempre informamos a duração estimada no momento da reserva.",
    order: 8,
  },
  {
    question: "Vocês removem manchas difíceis?",
    answer: "Sim! Somos especializados em remoção de manchas difíceis como vinho, café, gordura, pet stains, maquiagem e muito mais. Utilizamos produtos específicos para cada tipo de mancha. Embora não possamos garantir 100% de remoção em todos os casos (manchas muito antigas podem ser permanentes), nossa taxa de sucesso é superior a 90%. A avaliação é feita no local.",
    order: 9,
  },
  {
    question: "Atendem em quais regiões?",
    answer: "Atendemos toda a região metropolitana e cidades vizinhas. O agendamento está sujeito à disponibilidade de horários em sua região. Para confirmar se atendemos seu endereço, basta informar sua localização no momento da reserva e verificaremos a cobertura imediatamente.",
    order: 10,
  },
  {
    question: "Há taxa mínima de serviço?",
    answer: "Sim, temos um valor mínimo de serviço para viabilizar o deslocamento e setup dos equipamentos. O valor mínimo é informado no momento da cotação. Ao combinar múltiplos serviços (por exemplo, sofá + carpete), você pode economizar e atingir o mínimo com mais facilidade.",
    order: 11,
  },
  {
    question: "Vocês trabalham finais de semana e feriados?",
    answer: "Sim! Trabalhamos de segunda a sábado, incluindo alguns feriados. Nosso horário de atendimento é das 8h às 18h. Finais de semana costumam ter maior demanda, então recomendamos agendar com antecedência. Consulte nossa disponibilidade no chat ou ao fazer sua reserva.",
    order: 12,
  },
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
