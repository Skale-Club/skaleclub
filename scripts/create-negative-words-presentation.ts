import "dotenv/config";
import { storage } from "../server/storage.js";
import { pool } from "../server/db.js";
import type { InsertPresentation, SlideBlock } from "../shared/schema/presentations.js";

async function createNegativeWordsPresentation() {
  console.log("Creating 'Negative Words to Avoid' presentation...");

  const slides: SlideBlock[] = [
    {
      layout: "cover",
      heading: "Communicating for Success: Words to Avoid",
      headingPt: "Comunicação para o Sucesso: Palavras a Evitar",
      body: "Small adjustments in your vocabulary can lead to significant increases in professional impact.",
      bodyPt: "Pequenos ajustes no seu vocabulário podem levar a aumentos significativos no impacto profissional.",
    },
    {
      layout: "section-break",
      heading: "The Hidden Weight of Words",
      headingPt: "O Peso Oculto das Palavras",
      body: "Language triggers psychological responses. Using 'high-friction' words can create barriers before you even start.",
      bodyPt: "A linguagem desencadeia respostas psicológicas. Usar palavras de 'alto atrito' pode criar barreiras antes mesmo de você começar.",
    },
    {
      layout: "bullets",
      heading: "Top 5 Friction Builders",
      headingPt: "Top 5 Geradores de Atrito",
      bullets: [
        "**'Honestly'** – Subtly implies you might have been withholding truth before.",
        "**'I'll Try'** – Communicates a lack of commitment and expectation of failure.",
        "**'Problem'** – Magnifies obstacles instead of pointing toward a solution.",
        "**'But'** – Discards everything mentioned before it in the sentence.",
        "**'Just'** – A filler and minimizer that reduces your authority."
      ],
      bulletsPt: [
        "**'Sinceramente'** – Sugere sutilmente que você pode estar escondendo algo antes.",
        "**'Vou Tentar'** – Comunica falta de compromisso e expectativa de fracasso.",
        "**'Problema'** – Amplia obstáculos em vez de apontar para uma solução.",
        "**'Mas'** – Descarta tudo o que foi mencionado antes na frase.",
        "**'Apenas/Só'** – Um minimizador que reduz sua autoridade e impacto."
      ]
    },
    {
      layout: "two-column",
      heading: "The Power Swap",
      headingPt: "A Troca de Poder",
      body: "Replace negative triggers with positive momentum.",
      bodyPt: "Substitua gatilhos negativos por impulso positivo.",
      // Using bullets field for column content as per common patterns in this component
      bullets: [
        "Instead of: 'Problem'",
        "Use: 'Challenge' or 'Situation'",
        "---",
        "Instead of: 'I'll try'",
        "Use: 'I will' or 'I am committed to'"
      ],
      bulletsPt: [
        "Em vez de: 'Problema'",
        "Use: 'Desafio' ou 'Situação'",
        "---",
        "Em vez de: 'Vou tentar'",
        "Use: 'Eu irei' ou 'Estou comprometido a'"
      ]
    },
    {
      layout: "stats",
      heading: "The ROI of Clarity",
      headingPt: "O ROI da Clareza",
      stats: [
        { label: "Cooperation Increase", value: "37%", labelPt: "Aumento de Cooperação" },
        { label: "Conflict Reduction", value: "45%", labelPt: "Redução de Conflitos" },
        { label: "Trust Score", value: "x2", labelPt: "Nível de Confiança" }
      ]
    },
    {
      layout: "title-body",
      heading: "The Filler Word Trap",
      headingPt: "A Armadilha das Palavras de Preenchimento",
      body: "Words like 'Just' and 'Actually' are often used to soften a request, but they actually signal insecurity. Practice silence instead of fillers.",
      bodyPt: "Palavras como 'Apenas' e 'Na verdade' são usadas para suavizar, mas sinalizam insegurança. Pratique o silêncio em vez de preenchimentos.",
    },
    {
      layout: "image-focus",
      heading: "Focus on Results",
      headingPt: "Foco nos Resultados",
      body: "Your goal is to guide the conversation toward a positive outcome. Choose words that drive that motion.",
      bodyPt: "Seu objetivo é guiar a conversa para um resultado positivo. Escolha palavras que impulsionem esse movimento.",
    },
    {
      layout: "closing",
      heading: "Master Your Vocabulary",
      headingPt: "Domine seu Vocabulário",
      body: "Audit your emails this week. Identify your 'favorite' negative words and consciously replace them. Your influence will grow.",
      bodyPt: "Audite seus e-mails esta semana. Identifique suas palavras negativas 'favoritas' e substitua-as conscientemente. Sua influência crescerá.",
    }
  ];

  const presentationData: InsertPresentation = {
    title: "Negative Words to Avoid",
    slides: slides,
    accessCode: null,
  };

  try {
    const created = await storage.createPresentation(presentationData);
    console.log(`\nSuccessfully created presentation!`);
    console.log(`Title: ${created.title}`);
    console.log(`Slug: ${created.slug}`);
    console.log(`ID: ${created.id}`);
    console.log(`\nView URL: http://localhost:1000/presentation/${created.slug}`);
  } catch (error) {
    console.error("Failed to create presentation:", error);
    process.exit(1);
  }
}

createNegativeWordsPresentation()
  .catch(console.error)
  .finally(async () => {
    await pool.end();
  });
