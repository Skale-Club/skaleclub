import "dotenv/config";
import { db } from "../server/db";
import { companySettings, faqs, blogPosts, chatSettings } from "../shared/schema";
import { eq } from "drizzle-orm";

// Translation mappings from Portuguese to English
const translations = {
  // Hero Section
  "Aprenda a Gerar Seus Próprios Clientes nos EUA": "Learn How to Generate Your Own Clients in the USA",
  "Mentoria 1-a-1 em Marketing Digital para Empresários Brasileiros": "1-on-1 Mentorship in Digital Marketing for Brazilian Entrepreneurs",
  "Agendar Conversa Gratuita": "Schedule Free Consultation",
  
  // SEO
  "Mentoria de Marketing Digital para empresários brasileiros nos EUA. Aprenda a gerar clientes e escalar seu negócio de serviços (Cleaning, Landscaping, Construction) com previsibilidade.": "Digital Marketing Mentorship for Brazilian entrepreneurs in the USA. Learn to generate clients and scale your service business (Cleaning, Landscaping, Construction) with predictability.",
  
  // Trust Badges
  "Mentoria 100% Personalizada": "100% Personalized Mentorship",
  " Zero estratégias genéricas. Tudo focado no SEU negócio.": "No generic strategies. Everything focused on YOUR business.",
  "Zero estratégias genéricas. Tudo focado no SEU negócio.": "No generic strategies. Everything focused on YOUR business.",
  "Aprenda o Que Realmente Funciona": "Learn What Really Works",
  "Sem enrolação. Só técnicas comprovadas no mercado americano.": "No fluff. Only proven techniques in the American market.",
  "Suporte Até Você Dominar": "Support Until You Master It",
  "Não te abandonamos após as aulas. Acompanhamos seus resultados.": "We don't abandon you after classes. We follow your results.",
  
  // Blog Section
  "Conteúdos Recentes": "Recent Content",
  "Dicas e estratégias para crescer seu negócio nos EUA": "Tips and strategies to grow your business in the USA",
  "Ver Todos os Posts": "View All Posts",
  "Ler Mais": "Read More",
  
  // Areas Served
  "Abrangência": "Coverage",
  "Atendemos em todo os EUA": "We serve throughout the USA",
  "Nossa mentoria é 100% online. Ajudamos empresários brasileiros em qualquer estado americano a escalar seus negócios.": "Our mentorship is 100% online. We help Brazilian entrepreneurs in any American state to scale their businesses.",
  "Agendar Conversa": "Schedule Consultation",
  
  // Homepage Content
  "Estrutura que Converte": "Structure That Converts",
  "Aquisição de Leads (do jeito certo)": "Lead Acquisition (the right way)",
  "Conversão e Fechamento (sem ficar \"correndo atrás\")": "Conversion and Closing (without chasing)",
  "Otimização e Escala": "Optimization and Scale",
  "Como Funciona a Consultoria": "How the Consulting Works",
  "Um processo claro, em etapas, para você gerar clientes de forma previsível nos EUA.": "A clear, step-by-step process to generate clients predictably in the USA.",
  "Você sai da conversa com clareza do próximo passo — mesmo que não feche a consultoria.": "You leave the conversation with clarity on the next step — even if you don't close the consulting.",
  "Agendar Conversa Gratuita": "Schedule Free Consultation",
  "Na prática": "In practice",
  "Sessão inicial pra mapear seu cenário e definir o plano.": "Initial session to map your scenario and define the plan.",
  "Sessões semanais 1:1 com tarefas objetivas (o que fazer, como fazer, e por quê).": "Weekly 1:1 sessions with objective tasks (what to do, how to do it, and why).",
  "Acompanhamento pra ajustar rota e destravar o que estiver impedindo resultado.": "Follow-up to adjust the route and unlock what is preventing results.",
  "Montamos/ajustamos o que o cliente vê antes de te chamar (site, Google, provas sociais).": "We set up/adjust what the client sees before calling you (website, Google, social proof).",
  "Escolhemos os canais que fazem sentido pro seu momento (Google Ads, Local, etc.).": "We choose the channels that make sense for your moment (Google Ads, Local, etc.).",
  "Criamos seu fluxo de atendimento pra transformar lead em agendamento.": "We create your service flow to transform leads into appointments.",
  "Ajustamos números, reduzimos desperdício e criamos rotina de melhoria.": "We adjust numbers, reduce waste and create an improvement routine.",
  "Estrutura de página/landing + copy essencial + checklist do que precisa estar \"redondo\" pra converter.": "Page/landing structure + essential copy + checklist of what needs to be \"right\" to convert.",
  "Estratégia de captação + segmentação + orçamento recomendado e por quê (sem achismo).": "Acquisition strategy + segmentation + recommended budget and why (no guesswork).",
  "Roteiro de conversa (SMS/ligação) + follow-ups + modelo de proposta/fechamento.": "Conversation script (SMS/call) + follow-ups + proposal/closing template.",
  "Plano de otimização (o que medir e quando) + próximos passos pra escalar com consistência.": "Optimization plan (what to measure and when) + next steps to scale consistently.",
  "Semana 1": "Week 1",
  "Semana 2": "Week 2",
  "Semana 3": "Week 3",
  "Ciclo contínuo": "Continuous cycle",
  "Etapa": "Stage",
  "O que fazemos": "What we do",
  "Você sai com": "You leave with",
  "Como o trabalho acontece no dia a dia": "How the work happens day by day",
  "Próximo passo": "Next step",
  "Agenda aberta para novos projetos": "Open schedule for new projects",
  
  // Consulting Steps - Step Titles
  "Diagnóstico e Direção": "Diagnosis and Direction",
  "Oferta Irresistível (sem baixar preço)": "Irresistible Offer (without lowering price)",
  "Presença Digital que Converte": "Digital Presence That Converts",
  "Captação de Leads Qualificados": "Qualified Lead Acquisition",
  
  // Consulting Steps - Descriptions "O que fazemos"
  "Entendemos seu serviço, sua região, seus concorrentes e seu objetivo (ticket, volume, agenda).": "We understand your service, your region, your competitors and your goal (ticket, volume, schedule).",
  "Ajustamos sua oferta para o padrão do mercado americano (clareza, confiança, diferenciação).": "We adjust your offer to the American market standard (clarity, trust, differentiation).",
  
  // Consulting Steps - Deliverables "Você sai com"
  "Diagnóstico do que está travando + plano de ação simples (prioridades da semana 1).": "Diagnosis of what is blocked + simple action plan (week 1 priorities).",
  "Pacote/serviço bem definido + promessa realista + \"por que escolher você\" em 1 frase.": "Well-defined package/service + realistic promise + \"why choose you\" in 1 sentence.",
  "Estrutura de página/landing + copy essencial + checklist do que precisa estar \"redondo\" pra converter.": "Page/landing structure + essential copy + checklist of what needs to be \"right\" to convert.",
  "Conversão e Fechamento (sem ficar \"correndo atrás\")": "Conversion and Closing (without chasing)",
  
  // Form Questions
  "Qual é o seu nome completo?": "What is your full name?",
  "Digite seu nome completo": "Enter your full name",
  "Qual é o seu email?": "What is your email?",
  "Qual é o seu Celular/WhatsApp?": "What is your Cell Phone/WhatsApp?",
  "Onde você está hoje?": "Where are you today?",
  "Já moro nos EUA": "I already live in the USA",
  "Estou no Brasil, mas tenho negócio nos EUA": "I'm in Brazil, but I have a business in the USA",
  "Estou me mudando para os EUA em breve": "I'm moving to the USA soon",
  "Outro país": "Another country",
  "Em qual cidade/estado?": "In which city/state?",
  "Qual o nome da sua empresa?": "What is your company name?",
  "Digite o nome da sua empresa aqui": "Enter your company name here",
  "Qual o seu tipo de negócio?": "What is your type of business?",
  "Cleaning Services": "Cleaning Services",
  "Landscaping": "Landscaping",
  "Construction/Remodeling": "Construction/Remodeling",
  "Painting": "Painting",
  "Handyman": "Handyman",
  "Outro (especificar)": "Other (specify)",
  "Outro": "Other",
  "Descreva seu tipo de negócio": "Describe your type of business",
  "Há quanto tempo você tem esse negócio?": "How long have you had this business?",
  "Menos de 6 meses": "Less than 6 months",
  "6 meses a 1 ano": "6 months to 1 year",
  "1 a 3 anos": "1 to 3 years",
  "Mais de 3 anos": "More than 3 years",
  "Como está sua captação de clientes hoje?": "How is your customer acquisition today?",
  "Dependo só de indicações": "I only depend on referrals",
  "Já tentei anúncios por conta própria, sem muito resultado": "I've tried advertising on my own, without much result",
  "Já contratei alguém/agência e não funcionou": "I've hired someone/agency and it didn't work",
  "Tenho alguns resultados, mas quero escalar": "I have some results, but I want to scale",
  "Ainda não comecei nenhuma estratégia de marketing": "I haven't started any marketing strategy yet",
  "Para gerar clientes com consistência, é necessário investir em marketing (anúncios e/ou estrutura). Como isso se encaixa na sua realidade hoje?": "To generate clients consistently, it's necessary to invest in marketing (ads and/or structure). How does this fit into your reality today?",
  "Sim, consigo investir em marketing para acelerar o crescimento": "Yes, I can invest in marketing to accelerate growth",
  "Consigo começar com pouco e aumentar conforme os resultados": "I can start small and increase as results come",
  "No momento não consigo investir nisso": "I can't invest in this at the moment",
  "Qual é o seu principal desafio hoje?": "What is your main challenge today?",
  "Não tenho clientes suficientes": "I don't have enough clients",
  "Gasto em marketing mas não vejo retorno": "I spend on marketing but don't see returns",
  "Dependo de indicações e não tenho controle sobre meu fluxo de leads": "I depend on referrals and have no control over my lead flow",
  "Não sei por onde começar no marketing digital": "I don't know where to start with digital marketing",
  "Tenho clientes, mas não consigo cobrar o que meu serviço vale": "I have clients, but I can't charge what my service is worth",
  "Nossos clientes geralmente veem os primeiros leads em 2-4 semanas e resultados consistentes em 60-90 dias. Isso funciona para você?": "Our clients typically see first leads in 2-4 weeks and consistent results in 60-90 days. Does this work for you?",
  "Sim, entendo que resultado sólido leva tempo": "Yes, I understand that solid results take time",
  "Preciso de algo mais rápido": "I need something faster",
  "Não tenho certeza ainda": "I'm not sure yet",
  "Você já investiu em marketing digital antes?": "Have you invested in digital marketing before?",
  "Nunca investi": "Never invested",
  "Já tentei por conta própria sem sucesso": "I've tried on my own without success",
  "Já contratei agência e não funcionou": "I've hired an agency and it didn't work",
  "Estou investindo agora mas quero aprender": "I'm investing now but want to learn",
  "Tenho algum conhecimento mas quero me aprofundar": "I have some knowledge but want to go deeper",
  "Em quanto tempo você espera começar a ver resultados?": "How soon do you expect to start seeing results?",
  "Imediatamente (1-2 semanas)": "Immediately (1-2 weeks)",
  "1 mês": "1 month",
  "2-3 meses": "2-3 months",
  "3-6 meses": "3-6 months",
  "Estou focado no longo prazo": "I'm focused on the long term",
  
  // Chat Settings
  "Olá! Como posso ajudar você a escalar seu negócio hoje?": "Hello! How can I help you scale your business today?",
};

// Deep translation function for nested objects
function translateObject(obj: any): any {
  if (typeof obj === 'string') {
    return translations[obj as keyof typeof translations] || obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => translateObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const translated: any = {};
    for (const [key, value] of Object.entries(obj)) {
      translated[key] = translateObject(value);
    }
    return translated;
  }
  
  return obj;
}

async function translateDatabase() {
  console.log('🌐 Starting database translation from Portuguese to English...\n');

  try {
    // 1. Translate Company Settings (homepageContent and formConfig)
    console.log('📝 Translating Company Settings...');
    const settings = await db.select().from(companySettings).limit(1);
    
    if (settings.length > 0) {
      const setting = settings[0];
      const translatedHomepageContent = setting.homepageContent 
        ? translateObject(setting.homepageContent) 
        : setting.homepageContent;
      
      const translatedFormConfig = setting.formConfig 
        ? translateObject(setting.formConfig) 
        : setting.formConfig;

      // Translate top-level fields
      const translatedHeroTitle = translations[setting.heroTitle as keyof typeof translations] || setting.heroTitle;
      const translatedHeroSubtitle = translations[setting.heroSubtitle as keyof typeof translations] || setting.heroSubtitle;
      const translatedCtaText = translations[setting.ctaText as keyof typeof translations] || setting.ctaText;
      const translatedSeoDescription = translations[setting.seoDescription as keyof typeof translations] || setting.seoDescription;

      await db.update(companySettings)
        .set({
          heroTitle: translatedHeroTitle,
          heroSubtitle: translatedHeroSubtitle,
          ctaText: translatedCtaText,
          seoDescription: translatedSeoDescription,
          homepageContent: translatedHomepageContent,
          formConfig: translatedFormConfig,
        })
        .where(eq(companySettings.id, setting.id));
      
      console.log('✅ Company Settings translated successfully');
    }

    // 2. Translate Chat Settings
    console.log('\n💬 Translating Chat Settings...');
    const chatSettingsData = await db.select().from(chatSettings).limit(1);
    
    if (chatSettingsData.length > 0) {
      const chatSetting = chatSettingsData[0];
      const translatedWelcome = translations[chatSetting.welcomeMessage as keyof typeof translations] 
        || chatSetting.welcomeMessage;

      await db.update(chatSettings)
        .set({
          welcomeMessage: translatedWelcome,
        })
        .where(eq(chatSettings.id, chatSetting.id));
      
      console.log('✅ Chat Settings translated successfully');
    }

    // 3. Check for FAQs (if needed)
    console.log('\n❓ Checking FAQs...');
    const faqsData = await db.select().from(faqs).limit(10);
    
    if (faqsData.length > 0) {
      console.log(`Found ${faqsData.length} FAQs (translation may be needed manually for specific content)`);
    } else {
      console.log('No FAQs found');
    }

    // 4. Check for Blog Posts
    console.log('\n📰 Checking Blog Posts...');
    const blogPostsData = await db.select().from(blogPosts).limit(10);
    
    if (blogPostsData.length > 0) {
      console.log(`Found ${blogPostsData.length} blog posts (translation may be needed manually for specific content)`);
    } else {
      console.log('No blog posts found');
    }

    console.log('\n✨ Translation complete!');
    console.log('\nNote: Blog posts and FAQs may need manual review for context-specific translations.');
    
  } catch (error) {
    console.error('❌ Error translating database:', error);
    throw error;
  }
}

// Run the translation
translateDatabase()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
