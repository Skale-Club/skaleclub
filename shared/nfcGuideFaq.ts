import { NFC_ART_FEE_CENTS, NFC_QUANTITY, formatUsdCents } from "./nfc-pricing.js";

// Single source for the /nfc-guide FAQ: rendered by NfcProductGuideSection
// (English strings go through t()) and emitted server-side as FAQPage JSON-LD
// (server/seo/structuredData.ts) in both languages. The PT strings mirror the
// entries in client/src/lib/translations.ts.

export type NfcFaqGroup = { title: string; items: ReadonlyArray<readonly [string, string]> };

export const NFC_GUIDE_FAQ_EN: readonly NfcFaqGroup[] = [
  {
    title: "Models and customization",
    items: [
      [
        "Can you make any shape?",
        "We can create almost any feasible shape: mascots, animals, characters, dolls, products, tools and custom logo outlines. We first check whether the design can be produced reliably and whether there is enough room for the NFC tag. The more complex the contour and detail, the higher the quote may be.",
      ],
      [
        "What is the difference between flat and raised relief?",
        "The flat model has a smooth face with the artwork on the surface. Raised relief adds physical height to selected parts of the design, making it more tactile and dimensional. Because relief needs extra modeling and production work, it is quoted individually.",
      ],
      [
        "Can the keychain use more than one color?",
        "Yes, when the artwork and production method allow it. More colors, small color separations and layered finishes can add complexity, so we confirm feasibility and price after reviewing the design.",
      ],
      [
        "Can you copy a product, mascot or character?",
        "Yes, as long as the reference can be adapted into a durable keychain and you have permission to use the artwork. We simplify fragile or extremely fine details when needed and show you the design before production.",
      ],
    ],
  },
  {
    title: "Price and quantity",
    items: [
      [
        "Why do special models not have a fixed price?",
        "A raised or custom-shaped keychain can vary greatly in size, contour, number of layers, colors and modeling time. A single fixed number would be misleading, so we review the actual idea and confirm a precise quote before you commit.",
      ],
      [
        "What is the minimum order?",
        `The minimum order is ${NFC_QUANTITY.min} pieces. Each order requires artwork preparation, machine setup, programming and testing, so production is organized as a batch.`,
      ],
      [
        "What is the art fee?",
        `The ${formatUsdCents(NFC_ART_FEE_CENTS)} art and setup fee applies to the first order. It covers preparing the design for production. On a repeat order using the approved artwork, this fee is normally waived.`,
      ],
      [
        "Do I pay when I submit the form?",
        "No. The form collects the information needed to review your order. We confirm the design, final price and next steps with you before production begins.",
      ],
    ],
  },
  {
    title: "NFC technology",
    items: [
      [
        "Does the customer need an app?",
        "No. Modern iPhones and Android phones read NFC tags natively. The customer holds the phone close to the keychain and taps the notification that appears.",
      ],
      [
        "What can the NFC tap open?",
        "It can open a Google review page, Instagram, WhatsApp, a digital business card, menu, booking page, website or another web link you choose.",
      ],
      [
        "Can I change the destination later?",
        "Yes. The easiest approach is to use a link you control and redirect it whenever needed. If the tag itself must be reprogrammed, talk to us and we will explain the available option for your order.",
      ],
      [
        "Is every keychain tested?",
        "Yes. We program and test the NFC tag before shipping so the approved destination opens correctly.",
      ],
    ],
  },
  {
    title: "Artwork, production and delivery",
    items: [
      [
        "Which artwork file should I send?",
        "A vector file is ideal, but a clear PNG, JPG, WEBP or PDF can also work. If you only have a photo or screenshot, send the best version available and we will tell you what can be done.",
      ],
      [
        "Will I see the design before production?",
        "Yes. You approve the adapted design before production begins. This is also when we resolve any necessary simplification or NFC placement detail.",
      ],
      [
        "How long does production take?",
        "The timeline depends on the model, complexity, quantity and delivery destination. We confirm the production and delivery window in writing with the final quote, before you commit.",
      ],
      [
        "What if I am not sure which model to choose?",
        "Send your idea or reference through the form or WhatsApp. We will recommend the simplest model that preserves the look you want and explain the price difference before moving forward.",
      ],
    ],
  },
];

export const NFC_GUIDE_FAQ_PT: readonly NfcFaqGroup[] = [
  {
    "title": "Modelos e personalização",
    "items": [
      [
        "Vocês fazem qualquer formato?",
        "Podemos criar praticamente qualquer formato viável: mascotes, bichinhos, personagens, bonequinhos, produtos, ferramentas e contornos personalizados de logo. Primeiro verificamos se o design pode ser produzido com segurança e se há espaço suficiente para a tag NFC. Quanto mais complexo o contorno e os detalhes, maior pode ser o orçamento."
      ],
      [
        "Qual é a diferença entre flat e alto-relevo?",
        "O modelo flat tem uma face lisa com a arte na superfície. O alto-relevo acrescenta altura física a partes do design, deixando a peça mais tátil e tridimensional. Como exige modelagem e produção extras, ele é orçado individualmente."
      ],
      [
        "O chaveiro pode ter mais de uma cor?",
        "Sim, quando a arte e o método de produção permitem. Mais cores, separações pequenas e acabamentos em camadas podem aumentar a complexidade, por isso confirmamos a viabilidade e o preço depois de analisar o design."
      ],
      [
        "Vocês conseguem reproduzir um produto, mascote ou personagem?",
        "Sim, desde que a referência possa ser adaptada para um chaveiro resistente e você tenha autorização para usar a arte. Quando necessário, simplificamos detalhes frágeis ou muito finos e mostramos o design antes da produção."
      ]
    ]
  },
  {
    "title": "Preço e quantidade",
    "items": [
      [
        "Por que os modelos especiais não têm preço fixo?",
        "Um chaveiro em alto-relevo ou formato personalizado pode variar muito em tamanho, contorno, quantidade de camadas, cores e tempo de modelagem. Um preço único seria enganoso, por isso analisamos a ideia real e confirmamos um orçamento exato antes de você assumir qualquer compromisso."
      ],
      [
        "Qual é o pedido mínimo?",
        `O pedido mínimo é de ${NFC_QUANTITY.min} peças. Cada pedido exige preparação da arte, configuração das máquinas, programação e testes, por isso a produção é organizada em lote.`
      ],
      [
        "O que é a taxa de arte?",
        `A taxa de US$ ${formatUsdCents(NFC_ART_FEE_CENTS).replace("$", "").replace(".", ",")} de arte e preparação se aplica ao primeiro pedido. Ela cobre a adaptação do design para produção. Em um novo pedido usando a arte já aprovada, essa taxa normalmente não é cobrada.`
      ],
      [
        "Eu pago ao enviar o formulário?",
        "Não. O formulário coleta as informações necessárias para analisar o seu pedido. Confirmamos com você o design, o preço final e os próximos passos antes do início da produção."
      ]
    ]
  },
  {
    "title": "Tecnologia NFC",
    "items": [
      [
        "O cliente precisa de um aplicativo?",
        "Não. iPhones e celulares Android modernos leem tags NFC nativamente. O cliente aproxima o celular do chaveiro e toca na notificação que aparece."
      ],
      [
        "O que o toque NFC pode abrir?",
        "Ele pode abrir uma página de avaliações do Google, Instagram, WhatsApp, cartão digital, cardápio, página de agendamento, site ou outro link que você escolher."
      ],
      [
        "Posso mudar o destino depois?",
        "Sim. A forma mais simples é usar um link que você controla e redirecioná-lo quando precisar. Se a própria tag precisar ser reprogramada, fale conosco e explicaremos a opção disponível para o seu pedido."
      ],
      [
        "Todos os chaveiros são testados?",
        "Sim. Programamos e testamos a tag NFC antes do envio para garantir que o destino aprovado abra corretamente."
      ]
    ]
  },
  {
    "title": "Arte, produção e entrega",
    "items": [
      [
        "Qual arquivo de arte devo enviar?",
        "Um arquivo vetorial é ideal, mas um PNG, JPG, WEBP ou PDF nítido também pode servir. Se você só tiver uma foto ou captura de tela, envie a melhor versão disponível e diremos o que pode ser feito."
      ],
      [
        "Vou ver o design antes da produção?",
        "Sim. Você aprova o design adaptado antes do início da produção. É também nessa etapa que resolvemos qualquer simplificação necessária ou detalhe da posição do NFC."
      ],
      [
        "Quanto tempo leva a produção?",
        "O prazo depende do modelo, da complexidade, da quantidade e do destino da entrega. Confirmamos por escrito o prazo de produção e entrega junto com o orçamento final, antes de você assumir o compromisso."
      ],
      [
        "E se eu não souber qual modelo escolher?",
        "Envie a sua ideia ou referência pelo formulário ou WhatsApp. Recomendaremos o modelo mais simples que preserve o visual desejado e explicaremos a diferença de preço antes de continuar."
      ]
    ]
  }
];
