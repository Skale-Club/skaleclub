// EN -> pt-BR copy for the stored props of the `-br` landing rows
// (nfc-keychains-br, barbershops-br, nfc-order-br). Every entry is either
// reused verbatim from the approved translation seeds
// (seed-nfc-keychains-translations.ts, seed-barbershop-translations.ts,
// seed-nfc-order-translations.ts) or, where those used an em-dash or had no
// entry, rewritten here. No em-dashes; prices stay "US$"; "comercial" is the
// sales function; brand names are kept.
//
// The key is the exact EN string the seeds write; scripts/patch-landing-pt-copy.ts
// only replaces a stored value when it still equals that EN string.

import { PLAQUE_PT_COPY } from "./plaque-pt-copy.js";

export const LANDING_PT_COPY: Record<string, string> = {
  ...PLAQUE_PT_COPY,
  "Custom NFC keychains":
    "Chaveiros NFC personalizados",
  "One tap. Your customers land exactly where you want them.":
    "Um toque. Seus clientes vão exatamente para onde você quer.",
  "Custom 3D-printed NFC keychains with your logo. A customer taps their phone and opens your Google review page, Instagram, digital business card, menu, or website. No app needed.":
    "Chaveiros NFC personalizados, impressos em 3D com a sua logo. O cliente encosta o celular e abre a sua página de avaliações do Google, Instagram, cartão de visita digital, cardápio ou site. Sem precisar de aplicativo.",
  "I want my keychains":
    "Quero meus chaveiros",
  "Read the keychain guide":
    "Leia o guia dos chaveiros",
  "Custom 3D-printed NFC keychains in different designs":
    "Chaveiros NFC personalizados e impressos em 3D em diferentes modelos",
  "Programmed and tested":
    "Programados e testados",
  "Every NFC tag is checked before shipping":
    "Cada tag NFC é verificada antes do envio",
  "Custom 3D design":
    "Design 3D personalizado",
  "Made with your logo and approved artwork":
    "Feito com a sua logo e a arte aprovada",
  "No app required":
    "Sem aplicativo",
  "Works with modern iPhone and Android phones":
    "Funciona com iPhones e celulares Android modernos",
  "What the tap opens":
    "O que o toque abre",
  "You choose where every tap goes":
    "Você escolhe para onde cada toque leva",
  "One link per keychain. Point it at a page you control and you can change it anytime.":
    "Um link por chaveiro. Aponte para uma página que você controla e troque quando quiser.",
  "Google reviews":
    "Avaliações no Google",
  "Customers leave a review right at the counter, while the visit is still fresh.":
    "O cliente avalia ali mesmo no balcão, com o atendimento ainda fresco na memória.",
  "Instagram":
    "Instagram",
  "New followers in one tap, no searching for your profile.":
    "Novos seguidores em um toque, sem precisar procurar o seu perfil.",
  "Digital business card":
    "Cartão de visita digital",
  "Your contact saved straight to their phone.":
    "Seu contato salvo direto no celular do cliente.",
  "Menu":
    "Cardápio",
  "Always up to date, with no reprinting.":
    "Sempre atualizado, sem precisar reimprimir.",
  "WhatsApp":
    "WhatsApp",
  "A chat with your business opens in one tap.":
    "Uma conversa com a sua empresa abre em um toque.",
  "Website or booking page":
    "Site ou página de agendamento",
  "Send people straight to where they book or buy.":
    "Leve o cliente direto para onde ele agenda ou compra.",
  "Where to use it":
    "Onde usar",
  "Wherever your customers are within reach":
    "Onde o seu cliente estiver ao alcance da mão",
  "Put one at every point of contact.":
    "Deixe um em cada ponto de contato.",
  "At the counter":
    "No balcão",
  "Next to the register, where every customer passes.":
    "Ao lado do caixa, por onde todo cliente passa.",
  "Custom Vorell Construction 3D-printed keychain on a checkout counter":
    "Chaveiro personalizado da Vorell Construction impresso em 3D sobre um balcão",
  "At reception":
    "Na recepção",
  "On the front desk or in the waiting area.":
    "No balcão de atendimento ou na sala de espera.",
  "Custom Nolia Cleaning 3D-printed keychain on a reception desk":
    "Chaveiro personalizado da Nolia Cleaning impresso em 3D sobre uma recepção",
  "In your vehicle":
    "No seu veículo",
  "In the car or truck, if you offer mobile services.":
    "No carro ou na caminhonete, se você atende na casa do cliente.",
  "Custom Stuscle 3D-printed keychain attached to vehicle keys":
    "Chaveiro personalizado da Stuscle impresso em 3D preso às chaves de um veículo",
  "On your keyring":
    "No seu chaveiro",
  "Always one on hand to give away.":
    "Sempre um à mão para entregar.",
  "Hand holding a custom moustache-shaped 3D-printed keychain outside a barbershop":
    "Mão segurando um chaveiro personalizado em forma de bigode impresso em 3D em frente a uma barbearia",
  "How it works":
    "Como funciona",
  "From first message to tapping in 4 steps":
    "Da primeira mensagem ao primeiro toque em 4 passos",
  "A simple process with no surprises. You approve every step before we move on.":
    "Um processo simples, sem surpresas. Você aprova cada etapa antes de a gente seguir.",
  "Talk to us":
    "Fale com a gente",
  "Tell us what the tap should open and how many keychains you need. We confirm the details with you on WhatsApp.":
    "Conte o que o toque deve abrir e quantos chaveiros você precisa. A gente confirma os detalhes com você pelo WhatsApp.",
  "We design your art":
    "Criamos a sua arte",
  "Send us your logo file, or we create the artwork for you. You approve the design before anything is produced.":
    "Envie o arquivo da sua logo, ou a gente cria a arte para você. Você aprova o design antes de qualquer coisa ser produzida.",
  "We print and program":
    "Imprimimos e programamos",
  "Each keychain is 3D-printed with your design, and the NFC tag inside is programmed with your link and tested.":
    "Cada chaveiro é impresso em 3D com o seu design, e a tag NFC interna é programada com o seu link e testada.",
  "You receive and start tapping":
    "Você recebe e começa a usar",
  "Your keychains arrive ready to use. Hand them out, put one on the counter, and watch the taps come in.":
    "Seus chaveiros chegam prontos para usar. Distribua, deixe um no balcão e veja os toques chegarem.",
  "FAQ":
    "Perguntas frequentes",
  "Questions people ask before ordering":
    "Perguntas que as pessoas fazem antes de pedir",
  "Everything you need to decide, without waiting for a reply.":
    "Tudo o que você precisa para decidir, sem esperar resposta.",
  "What exactly is an NFC keychain?":
    "O que é exatamente um chaveiro NFC?",
  "A 3D-printed keychain with your logo and a small NFC tag inside. When a customer taps their phone on it, the phone opens the link you chose: your Google review page, Instagram, digital business card, menu, or website.":
    "Um chaveiro impresso em 3D com a sua logo e uma pequena tag NFC por dentro. Quando o cliente encosta o celular nele, o celular abre o link que você escolheu: sua página de avaliações do Google, Instagram, cartão de visita digital, cardápio ou site.",
  "Do my customers need to install an app?":
    "Meus clientes precisam instalar algum aplicativo?",
  "No. Modern iPhones and Android phones read NFC tags natively, the same way they handle tap-to-pay. The customer just holds the phone close to the keychain and a notification opens the link.":
    "Não. iPhones e Androids modernos leem tags NFC nativamente, do mesmo jeito que fazem o pagamento por aproximação. O cliente só aproxima o celular do chaveiro e uma notificação abre o link.",
  "Can you make a keychain in the shape of an object?":
    "Dá para fazer o chaveiro no formato de um objeto?",
  "Yes. Besides the flat keychain with your logo, we make them with raised relief and in custom shapes, like your product, a tool from your trade or your logo cut out. You pick the style in the order form, and we confirm the details with you on WhatsApp.":
    "Sim. Além do chaveiro chapado com a sua logo, fazemos chaveiros com relevo e com shape customizado, no formato do seu produto, de uma ferramenta do seu ramo ou da sua logo recortada. Você escolhe o estilo no formulário e confirmamos os detalhes com você pelo WhatsApp.",
  "How much does it cost?":
    "Quanto custa?",
  "Can I change the link later?":
    "Posso mudar o link depois?",
  "Yes. We recommend pointing the tag to a link you control, like a short link or a page on your website, so you can redirect it whenever you want without touching the keychain. If you need the tag itself reprogrammed, message us and we will walk you through the options.":
    "Sim. Recomendamos apontar a tag para um link que você controla, como um link curto ou uma página do seu site, para você redirecionar quando quiser sem mexer no chaveiro. Se precisar reprogramar a tag em si, é só mandar mensagem que a gente explica as opções.",
  "Why is payment 100% upfront?":
    "Por que o pagamento é 100% antecipado?",
  "Every order is custom-made with your logo, so it cannot be resold or reused for another business. Paying in full before production covers the materials and the work, and it lets us start right away. You still approve the design before anything is printed.":
    "Todo pedido é feito sob medida com a sua logo, então não pode ser revendido nem reaproveitado para outra empresa. Pagar integralmente antes da produção cobre os materiais e o trabalho, e permite que a gente comece na hora. Você continua aprovando o design antes de qualquer coisa ser impressa.",
  "How long does it take?":
    "Quanto tempo leva?",
  "Production starts as soon as your payment clears and the artwork is approved. The exact production and delivery window is confirmed in writing when your order is approved, so you know what to expect before you commit.":
    "A produção começa assim que o seu pagamento é confirmado e a arte é aprovada. O prazo exato de produção e entrega é confirmado por escrito na aprovação do pedido, para você saber o que esperar antes de fechar.",
  "What if I do not have a logo?":
    "E se eu não tiver uma logo?",
  "Upload the best version you have. A clear photo or a screenshot usually works, and we prepare it for 3D printing. If you have no logo at all, we create the artwork for you.":
    "Envie a melhor versão que você tiver. Uma foto nítida ou um print geralmente funciona, e nós preparamos para a impressão 3D. Se você não tem logo nenhuma, criamos a arte para você.",
  "Ready to get your keychains?":
    "Pronto para ter os seus chaveiros?",
  "About a minute to fill in. You see the price as you choose the quantity, and we confirm everything with you on WhatsApp before producing anything. Sending the form costs nothing.":
    "Leva cerca de um minuto. Você vê o preço conforme escolhe a quantidade, e confirmamos tudo com você no WhatsApp antes de produzir qualquer coisa. Enviar o formulário não custa nada.",
  // ── /barbershops + /barbershops-br (seed-barbershop-landing.ts, rewritten 2026-10-07) ──
  // Hero
  "For barbershops":
    "Para barbearias",
  "Your phone gets answered while you cut.":
    "Seu telefone é atendido enquanto você corta.",
  "An AI picks up the call and books the cut. You keep working.":
    "Uma IA atende a ligação e agenda o corte. Você continua trabalhando.",
  "Barber chair in a barbershop with a Google review plaque on the counter":
    "Cadeira de barbeiro em uma barbearia, com uma placa de avaliação do Google no balcão",
  "Get more clients":
    "Quero mais clientes",
  "Hear it working: (224) 551-6131":
    "Ouça funcionando: (224) 551-6131",
  "That line is answered by an AI set up as a barbershop. Ask it a price, then book a cut.":
    "Esse número é atendido por uma IA configurada como barbearia. Pergunte um preço e depois agende um corte.",
  // The problem
  "The problem":
    "O problema",
  "Where a barbershop loses money":
    "Onde uma barbearia perde dinheiro",
  "The phone rings mid-cut":
    "O telefone toca no meio do corte",
  "You can't pick up with the clippers in your hand, so the client calls the next shop.":
    "Você não consegue atender com a máquina na mão, então o cliente liga para a próxima barbearia.",
  "No-shows":
    "Faltas",
  "Someone books Saturday at 10 and never shows up. That chair earned nothing.":
    "Alguém marca para sábado às 10h e não aparece. Aquela cadeira não rendeu nada.",
  "Slow weekdays":
    "Dias fracos na semana",
  "Friday is packed and Tuesday afternoon sits empty.":
    "A sexta fica lotada e a terça à tarde fica vazia.",
  "Clients who belong to the app":
    "Clientes que pertencem ao aplicativo",
  "Book through a marketplace and your client sees every other shop nearby too.":
    "Quando o cliente agenda por um aplicativo, ele também vê todas as outras barbearias da região.",
  // How it works (eyebrow "How it works" already exists for the keychain landing)
  "What happens when a client calls":
    "O que acontece quando um cliente liga",
  "Call (224) 551-6131 and try it.":
    "Ligue para (224) 551-6131 e teste.",
  "The client calls":
    "O cliente liga",
  "At 9pm or in the middle of a fade, the call gets picked up.":
    "Às 9 da noite ou no meio de um degradê, a ligação é atendida.",
  "The AI answers":
    "A IA atende",
  "It knows your prices and your hours.":
    "Ela conhece os seus preços e os seus horários.",
  "The cut gets booked":
    "O corte é agendado",
  "The appointment goes straight into your calendar.":
    "O horário vai direto para a sua agenda.",
  "A reminder goes out":
    "O lembrete é enviado",
  "The client gets a reminder before the visit, so fewer chairs sit empty.":
    "O cliente recebe um lembrete antes da visita, e menos cadeiras ficam vazias.",
  // What you get
  "What you get":
    "O que você recebe",
  "What we set up for your shop":
    "O que a gente configura para a sua barbearia",
  "A booking page for your shop":
    "Uma página de agendamento para a sua barbearia",
  "Clients pick a time and book on a page with your shop's name.":
    "O cliente escolhe um horário e agenda em uma página com o nome da sua barbearia.",
  "Booking page built with Xkedule":
    "Página de agendamento feita com o Xkedule",
  "Calls and texts answered":
    "Ligações e mensagens atendidas",
  "The AI replies any time of day and books the appointment.":
    "A IA responde a qualquer hora do dia e agenda o horário.",
  "Xkedule dashboard listing recent appointments":
    "Painel do Xkedule com a lista de agendamentos recentes",
  "Posts every week":
    "Posts toda semana",
  "Make posts with AI and schedule them, so your Instagram doesn't go quiet.":
    "Faça posts com IA e agende, para o seu Instagram não ficar parado.",
  "Xareable home page":
    "Página inicial do Xareable",
  "More Google reviews":
    "Mais avaliações no Google",
  "A plaque on your counter. Clients tap their phone and land on your review page.":
    "Uma placa no seu balcão. O cliente encosta o celular e cai na sua página de avaliação.",
  "NFC Google review plaque on a counter":
    "Placa NFC de avaliação do Google sobre um balcão",
  // Pricing (prices are the live catalog; PT keeps the US$ convention). Brand names are identity rows.
  "Pricing":
    "Preços",
  "What it costs":
    "Quanto custa",
  "Same prices we charge everyone. Start with one.":
    "Os mesmos preços que cobramos de todo mundo. Comece por um.",
  "Xkedule":
    "Xkedule",
  "Booking and AI receptionist":
    "Agendamento e recepcionista com IA",
  "$89":
    "US$ 89",
  "/month":
    "/mês",
  "Online booking with calendar sync":
    "Agendamento online com sincronização de agenda",
  "Appointment reminders":
    "Lembretes de agendamento",
  "Xsites":
    "Xsites",
  "Website":
    "Site",
  "$299":
    "US$ 299",
  "Starting price":
    "Preço inicial",
  "A professional site for your shop":
    "Um site profissional para a sua barbearia",
  "Add pages as you grow":
    "Adicione páginas conforme você cresce",
  "Xareable":
    "Xareable",
  "Social posts":
    "Posts para redes sociais",
  "$49":
    "US$ 49",
  "Posts made with AI":
    "Posts feitos com IA",
  "Post by hand or on a schedule":
    "Poste na hora ou deixe agendado",
  "Google and Instagram ads are priced around your budget, so we quote them after we talk.":
    "Os anúncios no Google e no Instagram são cobrados de acordo com o seu orçamento, então passamos o valor depois que conversarmos.",
  // NFC link
  "We also make NFC keychains with your shop's logo.":
    "A gente também faz chaveiros NFC com a logo da sua barbearia.",
  "See the keychains":
    "Ver os chaveiros",
  // Reviews
  "What clients say":
    "O que os clientes dizem",
  "Reviews from businesses we've worked with.":
    "Avaliações de negócios com quem já trabalhamos.",
  // FAQ
  "Questions":
    "Dúvidas",
  "Before you call":
    "Antes de ligar",
  "Short answers before you call or fill out the form.":
    "Respostas curtas antes de ligar ou preencher o formulário.",
  "Do I have to buy everything?":
    "Preciso comprar tudo?",
  "No. Each product has its own price and you can start with one.":
    "Não. Cada produto tem o seu preço e você pode começar por um só.",
  "Do the clients stay mine?":
    "Os clientes continuam sendo meus?",
  "Yes. They book on your own page, not on a marketplace.":
    "Sim. Eles agendam na sua própria página, e não em uma plataforma.",
  "Can you come to my shop?":
    "Vocês podem ir até a minha barbearia?",
  "You can ask for an in-person visit in the form, or pick a video call.":
    "Você pode pedir uma visita presencial no formulário ou escolher uma chamada de vídeo.",
  "How much do the ads cost?":
    "Quanto custam os anúncios?",
  "It depends on how much you want to spend each month. We quote it after we talk about your shop.":
    "Depende de quanto você quer investir por mês. Passamos o valor depois de conversar sobre a sua barbearia.",
  // Closing lead form
  "Let's fill your chairs":
    "Vamos encher suas cadeiras",
  "Tell us about your shop. It takes a minute.":
    "Conte sobre a sua barbearia. Leva um minuto.",
  "Order your NFC keychains":
    "Peça os seus chaveiros NFC",
  "Choose how many you need, send us your logo, and we confirm every detail with you before anything is produced.":
    "Escolha quantos você precisa, envie a sua logo e confirmamos cada detalhe com você antes de produzir qualquer coisa.",
  "Start my order":
    "Fazer meu pedido",
  "See how they work":
    "Veja como funcionam",
  "What happens next":
    "O que acontece depois",
  "From your order to keychains in hand":
    "Do seu pedido aos chaveiros na mão",
  "Sending the form does not charge you anything. You approve every step before we move on.":
    "Enviar o formulário não cobra nada de você. Você aprova cada etapa antes de seguirmos.",
  "You send the order":
    "Você envia o pedido",
  "Quantity, what the tap should open, your logo and where to ship. It takes about a minute, and you can stop and come back — your answers are saved.":
    "Quantidade, o que o toque deve abrir, a sua logo e para onde enviar. Leva cerca de um minuto, e você pode parar e voltar depois. As respostas ficam salvas.",
  "We call you":
    "Nós ligamos para você",
  "We review whether we can produce what you asked for and call you on WhatsApp to confirm the quantity, the artwork and the final total.":
    "Avaliamos se conseguimos produzir o que você pediu e ligamos no WhatsApp para confirmar a quantidade, a arte e o total final.",
  "You approve the art":
    "Você aprova a arte",
  "We prepare your logo for 3D printing and send you the design. Nothing goes into production until you say yes.":
    "Preparamos a sua logo para impressão 3D e enviamos o desenho. Nada vai para produção até você dizer sim.",
  "We produce and ship":
    "Produzimos e enviamos",
  "Each keychain is printed with your design, the NFC tag inside is programmed with your link and tested, then shipped to your address.":
    "Cada chaveiro é impresso com o seu desenho, a tag NFC de dentro é programada com o seu link e testada, e então enviamos para o seu endereço.",
  "Before you start":
    "Antes de começar",
  "What we need from you":
    "O que precisamos de você",
  "Two things, and the form asks for both.":
    "Duas coisas, e o formulário pede as duas.",
  "Your logo":
    "A sua logo",
  "Upload it as a PNG, JPG, WEBP or PDF. The sharper the file, the better the print comes out.":
    "Envie em PNG, JPG, WEBP ou PDF. Quanto melhor a qualidade do arquivo, melhor sai a impressão.",
  "No logo file? Upload the best version you have — a clear photo or a screenshot usually works, and the first-order art fee covers preparing it for 3D printing. If you have no logo at all, we create the artwork for you.":
    "Não tem o arquivo da logo? Envie a melhor versão que tiver: uma foto nítida ou um print normalmente resolve, e a taxa de arte do primeiro pedido cobre a preparação para impressão 3D. Se você não tem logo nenhuma, criamos a arte para você.",
  "The link the tap should open":
    "O link que o toque deve abrir",
  "Your Google review page, Instagram, digital business card, menu or website. You pick it in the form, and we set it up with you on the call.":
    "A sua página de avaliações do Google, Instagram, cartão de visita digital, cardápio ou site. Você escolhe no formulário e configuramos junto com você na ligação.",
  "Point the tag at a link you control, like a page on your own site":
    "Aponte a tag para um link que você controla, como uma página do seu próprio site",
  "That way you can redirect it later without touching the keychains":
    "Assim você pode redirecionar depois sem precisar mexer nos chaveiros",
  "What people ask before sending an order":
    "O que as pessoas perguntam antes de enviar um pedido",
  "Short answers, so you can decide without waiting for a reply.":
    "Respostas curtas, para você decidir sem esperar retorno.",
  "Does sending this form place an order?":
    "Enviar este formulário já fecha o pedido?",
  "No. It sends us an order request. We check that we can produce what you asked for and call you to confirm everything. Nothing is charged on this page.":
    "Não. Ele envia uma solicitação de pedido. Verificamos se conseguimos produzir o que você pediu e ligamos para confirmar tudo. Nada é cobrado nesta página.",
  "Is the price I see here final?":
    "O preço que aparece aqui é o final?",
  "It is an estimate built from the quantity and the type of keychain you picked. We confirm the final total with you before anything is produced, so there are no surprises.":
    "É uma estimativa calculada a partir da quantidade e do tipo de chaveiro que você escolheu. Confirmamos o total final com você antes de produzir qualquer coisa, então não tem surpresa.",
  "When do I pay?":
    "Quando eu pago?",
  "After we confirm your order on the call. Payment is 100% upfront, and production starts once it clears and you have approved the artwork.":
    "Depois que confirmarmos o seu pedido na ligação. O pagamento é 100% antecipado, e a produção começa quando ele é compensado e você aprova a arte.",
  "Can I change the quantity after sending the form?":
    "Posso mudar a quantidade depois de enviar o formulário?",
  "Yes, right up until you approve the artwork. Tell us on the call and we re-quote at the price for the new quantity.":
    "Pode, até o momento em que você aprova a arte. É só falar na ligação que refazemos o orçamento com o preço da nova quantidade.",
  "Why is the minimum 20 pieces?":
    "Por que o mínimo é 20 peças?",
  "Every order is set up, designed, printed and programmed as a batch, so a very small run does not make sense for either side. Twenty is enough to put one at every point of contact and still hand some out.":
    "Cada pedido é configurado, desenhado, impresso e programado em lote, então uma tiragem muito pequena não faz sentido para nenhum dos lados. Vinte já dá para deixar um em cada ponto de contato e ainda distribuir alguns.",
  "Ready to order?":
    "Pronto para pedir?",
  "About a minute to fill in. We confirm everything with you on WhatsApp before producing anything.":
    "Cerca de um minuto para preencher. Confirmamos tudo com você no WhatsApp antes de produzir qualquer coisa.",

  // ── /products, /products/nfc-review-plaque, /products/nfc-keychains ─────
  "Products":
    "Produtos",
  "Things we make for your counter.":
    "Coisas que a gente faz para o seu balcão.",
  "Ask about a product":
    "Perguntar sobre um produto",
  "Made in-house":
    "Feito por nós",
  "What we make":
    "O que a gente faz",
  "Two things, each with its own page.":
    "Duas coisas, cada uma com a sua própria página.",
  "NFC review plaque":
    "Placa de avaliação NFC",
  "A plaque for your counter that opens your Google review page in one tap.":
    "Uma placa para o seu balcão que abre a sua página de avaliação no Google com um toque.",
  "NFC keychains":
    "Chaveiros NFC",
  "Custom keychains with your branding, plus a display to sell them at your counter.":
    "Chaveiros personalizados com a sua marca, mais um display para você vender no balcão.",
  "Not sure which one you need?":
    "Não sabe qual você precisa?",
  "Tell us about your business in a minute and we'll point you to the right one.":
    "Conte sobre o seu negócio em um minuto e a gente te indica o certo.",
  // "A plaque for your counter. Tap a phone on it and it opens your Google
  // review page." already has an entry above (the /barbershops NFC block).
  "Ask for a quote":
    "Pedir um orçamento",
  "What happens when someone taps it":
    "O que acontece quando alguém encosta o celular",
  "No app, nothing to type":
    "Sem aplicativo, sem digitar nada",
  "A customer holds their phone near the plaque. It opens your Google review page right away, while the visit is still fresh in their mind.":
    "O cliente encosta o celular na placa. Ela abre a sua página de avaliação no Google na hora, enquanto o atendimento ainda está fresco na memória dele.",
  "Made for":
    "Feito para",
  "Works anywhere customers pause":
    "Funciona em qualquer lugar onde o cliente para",
  "Barbershops":
    "Barbearias",
  "At the chair or the front desk.":
    "Na cadeira ou na recepção.",
  "Salons":
    "Salões",
  "At reception or at the styling station.":
    "Na recepção ou na estação de trabalho.",
  "Restaurants":
    "Restaurantes",
  "On the table or by the register.":
    "Na mesa ou perto do caixa.",
  "Any counter":
    "Qualquer balcão",
  "A classic barber chair inside a barbershop":
    "Uma cadeira clássica dentro de uma barbearia",
  "Mirrors and styling chairs inside a hair salon":
    "Espelhos e cadeiras de atendimento dentro de um salão de beleza",
  "Dining tables set inside a restaurant":
    "Mesas postas dentro de um restaurante",
  "Google review NFC plaque displayed on a customer service counter":
    "Placa NFC de avaliação do Google exibida em um balcão de atendimento",
  "Front desk, register, waiting area.":
    "Recepção, caixa, sala de espera.",
  "Customization":
    "Personalização",
  "Made to order":
    "Feito sob encomenda",
  "What we print":
    "O que a gente imprime",
  "We print it with your logo and colors. You choose the words on it.":
    "A gente imprime com a sua logo e as suas cores. Você escolhe as palavras.",
  "Tell us about your business in a minute. There's no set price. We quote based on what you need.":
    "Conte sobre o seu negócio em um minuto. Não tem preço fixo. A gente cobra de acordo com o que você precisa.",
  "Custom keychains with your branding. The tap opens the link you choose.":
    "Chaveiros personalizados com a sua marca. O toque abre o link que você escolher.",
  "Custom 3D-printed NFC keychains with a business logo":
    "Chaveiros NFC personalizados e impressos em 3D com a logo de um negócio",
  "A customer holds their phone near the keychain. It opens the link you picked. Most shops use their booking page or their Google reviews.":
    "O cliente encosta o celular no chaveiro. Ele abre o link que você escolheu. A maioria dos negócios usa a página de agendamento ou as avaliações no Google.",
  "We print the keychain with your branding and program the tag with the link you pick.":
    "A gente imprime o chaveiro com a sua marca e programa a tag com o link que você escolher.",
  "Extra revenue":
    "Renda extra",
  "A display for your counter":
    "Um display para o seu balcão",
  "Sell them yourself":
    "Venda você mesmo",
  "We also make a display for your counter so you can sell the keychains yourself.":
    "A gente também faz um display para o seu balcão, para você mesmo vender os chaveiros.",
  "It brings in a bit of extra money for the shop.":
    "Isso traz um dinheiro extra para o negócio.",
  "Nothing to install. It works with the phone your customer already has.":
    "Nada para instalar. Funciona com o celular que o seu cliente já tem.",
  "Printed with your branding, one piece at a time.":
    "Impresso com a sua marca, uma peça de cada vez.",
  "Keychains your customers can buy on the spot.":
    "Chaveiros que os seus clientes podem comprar na hora.",
};
