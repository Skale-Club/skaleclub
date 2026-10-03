// EN -> pt-BR copy for /products/nfc-review-plaque (NFC_REVIEW_PLAQUE_SECTIONS
// in scripts/seed-products-landing.ts). Spread into LANDING_PT_COPY, which
// seedPage() applies to the "-br" row. Same rules: no em-dashes, brand names
// kept. Strings the page shares with other landings live in landing-pt-copy.ts.
//
// Price strings are BUILT from NFC_PLAQUE_PRICES exactly like the seed builds
// the English ones, so a price change keeps both languages in step.
import { NFC_PLAQUE_PRICES } from "../../shared/nfc-plaque-pricing.js";

const P = NFC_PLAQUE_PRICES;
const en = (cents: number) => `$${cents / 100}`;
const pt = (cents: number) => `US$ ${cents / 100}`;

export const PLAQUE_PT_COPY: Record<string, string> = {
  // ── Hero + badges ───────────────────────────────────────────────────────
  "Google Review and Instagram NFC plaques side by side":
    "Placas NFC do Google e do Instagram lado a lado",
  "Google Review NFC plaque with a QR code, on its black stand":
    "Placa NFC de avaliação do Google com QR code, na base preta",
  "Instagram NFC plaque with the logo in silk filament":
    "Placa NFC do Instagram com o logo em filamento silk",
  "More Google reviews, right from your counter.":
    "Mais avaliações no Google, direto do seu balcão.",
  "A 3D-printed plaque for your counter. A customer taps their phone or scans the QR code and your Google review page opens. No app, no searching, no typing.":
    "Uma placa impressa em 3D para o seu balcão. O cliente encosta o celular ou escaneia o QR code e a sua página de avaliação no Google abre. Sem aplicativo, sem procurar, sem digitar.",
  "Order your plaque":
    "Pedir a minha placa",
  "See how it works":
    "Veja como funciona",
  "Tap or scan":
    "Encoste ou escaneie",
  "NFC chip and QR code on every plaque":
    "Chip NFC e QR code em todas as placas",

  // ── Why it matters ──────────────────────────────────────────────────────
  "Why it matters":
    "Por que isso importa",
  "Reviews are how new customers choose you":
    "É pelas avaliações que novos clientes escolhem você",
  "Before visiting a business for the first time, people check its rating on Google.":
    "Antes de ir a um negócio pela primeira vez, as pessoas olham a nota dele no Google.",
  "Reviews help you show up on Google Maps":
    "Avaliações ajudam você a aparecer no Google Maps",
  "Google says the number of reviews and the rating are part of how it ranks local businesses. More recent, real reviews make you easier to find and easier to pick over the shop down the street.":
    "O Google diz que a quantidade de avaliações e a nota fazem parte de como ele classifica os negócios locais. Mais avaliações reais e recentes deixam você mais fácil de encontrar e de escolher no lugar do concorrente da esquina.",
  "Happy customers forget to review":
    "Cliente satisfeito esquece de avaliar",
  "Plenty of customers who liked the service would leave a review if it were easy. The problem is the path: open Google, search your name, find the button, start typing. By the time they get home, they have moved on.":
    "Muitos clientes que gostaram do atendimento deixariam uma avaliação se fosse fácil. O problema é o caminho: abrir o Google, buscar o seu nome, achar o botão, começar a digitar. Quando chegam em casa, já esqueceram.",
  "The plaque removes the steps":
    "A placa elimina esses passos",
  "With the plaque on the counter, the review page is one tap away while the visit is still fresh. Your team can point to it at checkout instead of asking customers to look you up later.":
    "Com a placa no balcão, a página de avaliação fica a um toque, com o atendimento ainda fresco na memória. A sua equipe pode indicar a placa na hora de pagar, em vez de pedir para o cliente procurar você depois.",
  "Opens your Google review page directly":
    "Abre direto a sua página de avaliação no Google",
  "Works while the customer is still in your shop":
    "Funciona enquanto o cliente ainda está no seu negócio",
  "Gives your team an easy way to ask for a review":
    "Dá à sua equipe um jeito fácil de pedir uma avaliação",

  // ── How it works ────────────────────────────────────────────────────────
  "From first message to your first review in 4 steps":
    "Da primeira mensagem à primeira avaliação em 4 passos",
  "You approve every step before we move on.":
    "Você aprova cada etapa antes de seguirmos.",
  "Choose your plaque":
    "Escolha a sua placa",
  "Pick the Google Review, Instagram or custom plaque and how many you need. You see the price right in the form.":
    "Escolha a placa do Google, do Instagram ou personalizada e quantas você precisa. Você vê o preço ali mesmo no formulário.",
  "Send your link":
    "Envie o seu link",
  "Tell us your review page or profile. For a custom plaque, send your logo and approve the design before anything is printed.":
    "Diga qual é a sua página de avaliação ou o seu perfil. Na placa personalizada, envie a sua logo e aprove o design antes de qualquer impressão.",
  "The plaque is 3D-printed, and the NFC chip and the QR code are linked to your page and tested.":
    "A placa é impressa em 3D, e o chip NFC e o QR code são ligados à sua página e testados.",
  "Put it on the counter":
    "Coloque no balcão",
  "Your plaque arrives ready to use. Place it where customers pay or wait and the reviews start coming in.":
    "A sua placa chega pronta para usar. Coloque onde os clientes pagam ou esperam e as avaliações começam a chegar.",

  // ── Standard or custom ──────────────────────────────────────────────────
  "Two ways to order":
    "Duas formas de pedir",
  "Standard or custom":
    "Padrão ou personalizada",
  "Both are 3D-printed, programmed and tested before they ship.":
    "As duas são impressas em 3D, programadas e testadas antes do envio.",
  "Standard plaque":
    "Placa padrão",
  "Our ready-made Google Review or Instagram design. The tap and the QR go through a Skale Club link that sends customers to your page.":
    "O nosso design pronto do Google ou do Instagram. O toque e o QR passam por um link da Skale Club que leva o cliente à sua página.",
  "If your page changes, we update the link and the plaque keeps working":
    "Se a sua página mudar, a gente atualiza o link e a placa continua funcionando",
  "We can see how many times it was tapped or scanned":
    "A gente consegue ver quantas vezes ela foi tocada ou escaneada",
  "Custom plaque":
    "Placa personalizada",
  "Your logo, name or @ printed on the plaque. The tap and the QR open your own link directly, so the destination is set when we print it.":
    "A sua logo, nome ou @ impressos na placa. O toque e o QR abrem direto o seu próprio link, então o destino fica definido na impressão.",
  "Your brand on the counter":
    "A sua marca no balcão",
  "You approve the design before printing":
    "Você aprova o design antes da impressão",

  // ── Pricing (amounts built from NFC_PLAQUE_PRICES) ──────────────────────
  // Same wording as the keychain pricing rows (seed-nfc-keychains-translations.ts).
  "Simple, upfront pricing":
    "Preço simples e transparente",
  "No hidden fees. You know the total before we start.":
    "Sem taxas escondidas. Você sabe o total antes de a gente começar.",
  [en(P.standardUnitCents)]: pt(P.standardUnitCents),
  [en(P.standardPairCents)]: pt(P.standardPairCents),
  [en(P.customFirstCents)]: pt(P.customFirstCents),
  "2 standard plaques":
    "2 placas padrão",
  "Each additional custom plaque":
    "Cada placa personalizada adicional",
  "Google Review or Instagram design":
    "Design do Google ou do Instagram",
  "Every pair of standard plaques":
    "A cada par de placas padrão",
  "The first one, custom artwork included":
    "A primeira, com a arte personalizada",
  "Same design, same order":
    "Mesmo design, mesmo pedido",
  "No payment in the order form. We confirm the total with you on WhatsApp before production.":
    "Nenhum pagamento no formulário. Confirmamos o total com você no WhatsApp antes da produção.",

  // ── FAQ ─────────────────────────────────────────────────────────────────
  "Do my customers need to install an app?":
    "Meus clientes precisam instalar algum aplicativo?",
  "No. Modern iPhones and Android phones read NFC natively, the same way they handle tap-to-pay. The customer holds the phone near the plaque and the review page opens.":
    "Não. iPhones e celulares Android modernos leem NFC nativamente, do mesmo jeito que fazem pagamento por aproximação. O cliente encosta o celular na placa e a página de avaliação abre.",
  "Does it work with every phone?":
    "Funciona com qualquer celular?",
  "The tap works with modern iPhones and with Android phones that have NFC turned on. Any phone with a camera can scan the QR code on the plaque instead.":
    "O toque funciona com iPhones modernos e com celulares Android que estão com o NFC ligado. Qualquer celular com câmera pode escanear o QR code da placa.",
  "Does the plaque need batteries or Wi-Fi?":
    "A placa precisa de bateria ou Wi-Fi?",
  "No. The NFC tag has no battery: the phone powers it during the tap. The page opens using the customer's own mobile data or Wi-Fi.":
    "Não. A tag NFC não tem bateria: o próprio celular alimenta a tag durante o toque. A página abre usando os dados móveis ou o Wi-Fi do cliente.",
  "Can I change where the plaque points later?":
    "Posso trocar depois para onde a placa leva?",
  "On the standard plaque, yes: the tap and the QR go through a Skale Club link, and we change where it sends people without touching the plaque. On the custom plaque they open your own link directly, so it is set when we print it.":
    "Na placa padrão, sim: o toque e o QR passam por um link da Skale Club, e a gente muda para onde ele leva sem mexer na placa. Na placa personalizada eles abrem direto o seu próprio link, então ele fica definido na impressão.",
  "Can I offer a discount in exchange for a review?":
    "Posso dar um desconto em troca de avaliação?",
  "No. Google's rules do not allow rewards for reviews, or asking only the customers you think are happy. The plaque helps you ask everyone in a simple way, which is exactly what Google allows.":
    "Não. As regras do Google não permitem recompensa por avaliação, nem pedir só para os clientes que você acha que estão satisfeitos. A placa ajuda você a pedir para todo mundo de um jeito simples, que é exatamente o que o Google permite.",
  "How much does it cost?":
    "Quanto custa?",
  [`Standard plaques (Google Review or Instagram) are ${en(P.standardUnitCents)} each, or 2 for ${en(P.standardPairCents)}. ` +
  `Custom plaques with your brand are ${en(P.customFirstCents)} for the first and ${en(P.customAdditionalCents)} for each additional one. ` +
  "You see the total in the order form, and we confirm it with you before production."]:
    `As placas padrão (Google ou Instagram) custam ${pt(P.standardUnitCents)} cada, ou 2 por ${pt(P.standardPairCents)}. ` +
    `As personalizadas com a sua marca custam ${pt(P.customFirstCents)} a primeira e ${pt(P.customAdditionalCents)} cada adicional. ` +
    "Você vê o total no formulário de pedido, e a gente confirma com você antes da produção.",
  "The production and delivery window is confirmed with you when your order is approved, so you know what to expect before you commit.":
    "O prazo de produção e entrega é confirmado com você quando o pedido é aprovado, para você saber o que esperar antes de fechar.",
  "Can I order more than one?":
    "Posso pedir mais de uma?",
  "Yes, up to 10 in the order form: one at the register, others at reception or on the tables. For more than 10, tell us in the last question of the form.":
    "Sim, até 10 no formulário de pedido: uma no caixa, outras na recepção ou nas mesas. Para mais de 10, conte pra gente na última pergunta do formulário.",

  // ── Closing CTA ─────────────────────────────────────────────────────────
  "Ready to get more reviews?":
    "Pronto para ter mais avaliações?",
  "About a minute to fill in. You see the price as you choose the plaque and quantity, and we confirm everything with you on WhatsApp before producing anything. Sending the form costs nothing.":
    "Cerca de um minuto para preencher. Você vê o preço enquanto escolhe a placa e a quantidade, e a gente confirma tudo com você no WhatsApp antes de produzir qualquer coisa. Enviar o formulário não custa nada.",
};
