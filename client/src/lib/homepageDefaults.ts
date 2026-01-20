import type { HomepageContent } from '@shared/schema';

export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
  heroBadgeImageUrl: 'https://storage.googleapis.com/msgsndr/q6UKnlWOQwyTk82yZPAs/media/696016120597df5bbeeba997.png',
  heroBadgeAlt: 'Especialistas em Marketing',
  trustBadges: [
    { title: 'Resultados Comprovados', description: 'Estratégias testadas que geram leads.', icon: 'trophy' },
    { title: 'Foco em Service-Based Business', description: 'Expertise exclusivo no seu mercado.', icon: 'target' },
    { title: 'Consultoria Personalizada', description: 'Acompanhamento 1:1 toda semana.', icon: 'heart' },
  ],
  categoriesSection: {
    title: 'Pronto para Crescer?',
    subtitle: 'Selecione uma categoria para conhecer nossas soluções.',
    ctaText: 'Agendar Conversa',
  },
  reviewsSection: {
    title: 'Avaliações de Clientes',
    subtitle: 'Veja o que nossos clientes dizem sobre nossos serviços.',
    embedUrl: 'https://reputationhub.site/reputation/widgets/review_widget/q6UKnlWOQwyTk82yZPAs',
  },
  blogSection: {
    title: 'Insights e Estratégias',
    subtitle: 'Dicas práticas para crescer seu negócio de serviços',
    viewAllText: 'Ver Todos',
    readMoreText: 'Ler Mais',
  },
  aboutSection: {
    label: 'Sobre Nós',
    heading: 'Quem Somos',
    description: 'Somos especialistas em marketing digital para prestadores de serviço nos EUA. Ajudamos empresas a gerarem clientes de forma previsível e escalável através de estratégias de aquisição, conversão e otimização.',
    defaultImageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
    highlights: [
      {
        title: 'Especialistas em Service-Based Business',
        description: 'Foco exclusivo em empresas de serviço no mercado americano.',
      },
      {
        title: 'Estratégias Comprovadas',
        description: 'Metodologias testadas para gerar leads qualificados e conversões.',
      },
      {
        title: 'Acompanhamento 1:1',
        description: 'Consultoria personalizada com sessões semanais e suporte contínuo.',
      },
    ],
  },
  areasServedSection: {
    label: 'Onde Atendemos',
    heading: 'Atuação Nacional',
    description: 'Atendemos prestadores de serviço em todos os Estados Unidos. Nossa consultoria é 100% online, permitindo acompanhamento próximo independente da sua localização.',
    ctaText: 'Agendar Conversa',
  },
  consultingStepsSection: {
    enabled: true,
    sectionId: 'como-funciona',
    title: 'Como Funciona a Consultoria',
    subtitle: 'Um processo claro, em etapas, para você gerar clientes de forma previsível nos EUA.',
    steps: [
      {
        order: 1,
      numberLabel: '01',
      icon: 'search',
      title: 'Diagnóstico e Direção',
      whatWeDo: 'Entendemos seu serviço, sua região, seus concorrentes e seu objetivo (ticket, volume, agenda).',
      outcome: 'Diagnóstico do que está travando + plano de ação simples (prioridades da semana 1).',
    },
    {
      order: 2,
      numberLabel: '02',
      icon: 'sparkles',
      title: 'Oferta Irresistível (sem baixar preço)',
      whatWeDo: 'Ajustamos sua oferta para o padrão do mercado americano (clareza, confiança, diferenciação).',
      outcome: 'Pacote/serviço bem definido + promessa realista + “por que escolher você” em 1 frase.',
    },
    {
      order: 3,
      numberLabel: '03',
      icon: 'layout',
      title: 'Presença Digital que Converte',
      whatWeDo: 'Montamos/ajustamos o que o cliente vê antes de te chamar (site, Google, provas sociais).',
      outcome: 'Estrutura de página/landing + copy essencial + checklist do que precisa estar “redondo” pra converter.',
    },
    {
      order: 4,
      numberLabel: '04',
      icon: 'target',
      title: 'Aquisição de Leads (do jeito certo)',
      whatWeDo: 'Escolhemos os canais que fazem sentido pro seu momento (Google Ads, Local, etc.).',
      outcome: 'Estratégia de captação + segmentação + orçamento recomendado e por quê (sem achismo).',
    },
    {
      order: 5,
      numberLabel: '05',
      icon: 'phone-call',
      title: 'Conversão e Fechamento (sem ficar “correndo atrás”)',
      whatWeDo: 'Criamos seu fluxo de atendimento pra transformar lead em agendamento.',
      outcome: 'Roteiro de conversa (SMS/ligação) + follow-ups + modelo de proposta/fechamento.',
    },
    {
      order: 6,
      numberLabel: '06',
      icon: 'line-chart',
      title: 'Otimização e Escala',
      whatWeDo: 'Ajustamos números, reduzimos desperdício e criamos rotina de melhoria.',
        outcome: 'Plano de otimização (o que medir e quando) + próximos passos pra escalar com consistência.',
    },
    ],
    practicalBlockTitle: 'Na prática',
    practicalBullets: [
      'Sessão inicial pra mapear seu cenário e definir o plano.',
      'Sessões semanais 1:1 com tarefas objetivas (o que fazer, como fazer, e por quê).',
      'Acompanhamento pra ajustar rota e destravar o que estiver impedindo resultado.',
    ],
    ctaButtonLabel: 'Agendar Conversa Gratuita',
    ctaButtonLink: '#lead-form',
    helperText: 'Você sai da conversa com clareza do próximo passo — mesmo que não feche a consultoria.',
  },
};
