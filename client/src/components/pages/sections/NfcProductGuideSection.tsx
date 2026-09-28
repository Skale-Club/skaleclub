import {
  ArrowRight,
  BadgeDollarSign,
  Box,
  Check,
  ChevronDown,
  CircleDollarSign,
  FileCheck2,
  Layers3,
  MessageCircle,
  Palette,
  PencilRuler,
  Radio,
  Shapes,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "@/hooks/useTranslation";
import {
  NFC_ART_FEE_CENTS,
  NFC_KEYCHAIN_TYPES,
  NFC_QUANTITY,
  NFC_VOLUME_TIERS,
  formatUsdCents,
} from "@shared/nfc-pricing";
import { nfcWhatsappHref } from "@shared/nfc-whatsapp";

export type NfcProductGuideProps = {
  orderHref?: string;
};

const navigation = [
  ["Models", "models"],
  ["Price", "price"],
  ["NFC", "nfc"],
  ["Artwork", "artwork"],
  ["Process", "process"],
  ["FAQ", "faq"],
] as const;

const modelDetails = {
  standard: {
    icon: Layers3,
    number: "01",
    image: "/nfc-guide/flat.webp",
    imageAlt: "Illustrative flat NFC keychain with artwork flush to the surface",
    displayLabel: "Flat model",
    eyebrow: "Predictable price",
    bestFor: "Simple logos, clear reading and the lowest predictable unit price.",
    visual: "A clean, flat face with your artwork printed on the surface.",
  },
  relief: {
    icon: Box,
    number: "02",
    image: "/nfc-guide/relief.webp",
    imageAlt: "Illustrative NFC keychain with clearly raised multi-level relief",
    displayLabel: "Raised-relief model",
    eyebrow: "Quoted individually",
    bestFor: "Brands that want texture, depth and a more tactile premium finish.",
    visual: "Selected parts of the logo rise above the base and can use multiple levels.",
  },
  "custom-shape": {
    icon: Shapes,
    number: "03",
    image: "/nfc-guide/custom-shape.webp",
    imageAlt: "Illustrative custom-shaped NFC keychain made as a dog mascot",
    displayLabel: "Custom-shaped model",
    eyebrow: "Quoted individually",
    bestFor: "Mascots, animals, characters, dolls, products, tools or a custom logo outline.",
    visual: "The outside contour becomes part of the design instead of using a standard base.",
  },
} as const;

const priceFactors = [
  {
    icon: Shapes,
    title: "Keychain type",
    text: "Flat is the simplest. Raised relief and custom contours require more design and production work.",
  },
  {
    icon: PencilRuler,
    title: "Design complexity",
    text: "Fine details, several layers, unusual proportions and difficult shapes affect the quote.",
  },
  {
    icon: Palette,
    title: "Colors and finish",
    text: "The number of colors and how they are separated can change the production setup.",
  },
  {
    icon: BadgeDollarSign,
    title: "Quantity",
    text: "Larger batches reduce the flat model's unit price. Special models are quoted for the requested run.",
  },
] as const;

const processSteps = [
  ["01", "Tell us what you want", "Choose a model, quantity and destination link, then send your artwork or reference."],
  ["02", "We review feasibility", "We check shape, details, colors and NFC placement. Special models receive a custom quote."],
  ["03", "You approve everything", "We confirm the final design, price and delivery window before anything enters production."],
  ["04", "We produce and test", "Every tag is programmed and tested before the finished keychains are shipped."],
] as const;

const faqGroups = [
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
] as const;

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1f55c9]">{t(eyebrow)}</p>
      <h2 className="mt-4 font-serif text-4xl font-semibold leading-[1.04] tracking-[-0.025em] text-[#101b31] sm:text-5xl">
        {t(title)}
      </h2>
      {description ? <p className="mt-5 max-w-2xl text-base leading-7 text-[#596276] sm:text-lg">{t(description)}</p> : null}
    </div>
  );
}

export function NfcProductGuideSection({ props }: { props: NfcProductGuideProps }) {
  const { t, language } = useTranslation();
  const orderHref = props.orderHref ?? "/nfc-order";
  const orderLink = `${orderHref}${typeof window === "undefined" ? "" : window.location.search}`;
  const visibleTiers = NFC_VOLUME_TIERS.filter(
    (tier) => tier.minQuantity >= NFC_QUANTITY.min && tier.minQuantity <= NFC_QUANTITY.max,
  );

  return (
    <article className="bg-[#f5f1e9] text-[#172238]" data-testid="section-nfc-product-guide">
      <div
        className="border-b border-[#172238]/10 bg-[#ede7dc]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(23,34,56,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(23,34,56,.045) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <div className="mx-auto max-w-[1240px] px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:px-12">
          <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#172238]/15 bg-white/55 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#1f55c9]">
                <Radio className="h-4 w-4" />
                {t("NFC keychain guide")}
              </div>
              <h1 className="mt-8 max-w-4xl font-serif text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-[#101b31] sm:text-6xl lg:text-7xl">
                {t("Understand the options before you place an order.")}
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#4f596c] sm:text-xl">
                {t("Models, prices, NFC technology, artwork and production — explained clearly, without turning this page into a sales pitch.")}
              </p>
            </div>

            <div className="border-l-2 border-[#1f55c9] bg-white/65 p-6 shadow-[0_18px_50px_rgba(30,42,66,.08)]">
              <Sparkles className="h-6 w-6 text-[#1f55c9]" />
              <p className="mt-5 font-serif text-2xl font-semibold leading-tight text-[#101b31]">
                {t("Almost anything is possible. Every choice affects the price.")}
              </p>
              <p className="mt-4 text-sm leading-6 text-[#596276]">
                {t("A simple flat logo has predictable pricing. Relief, custom shapes, characters and detailed pieces are reviewed and quoted individually.")}
              </p>
            </div>
          </div>

          <figure className="mt-12 overflow-hidden border border-[#172238]/12 bg-[#f8f5ee] shadow-[0_24px_70px_rgba(30,42,66,.1)] sm:mt-16">
            <img
              src="/nfc-guide/hero.webp"
              alt={t("AI-generated visual examples of flat, raised-relief and custom-shaped NFC keychains")}
              className="aspect-[16/9] w-full object-cover sm:aspect-[2/1]"
              loading="eager"
              decoding="async"
            />
            <figcaption className="flex items-start gap-3 border-t border-[#172238]/10 bg-white/75 px-5 py-4 text-xs leading-5 text-[#626b7b] sm:px-6">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#1f55c9]" />
              {t("Illustrative concepts. Your final design is reviewed and approved before production.")}
            </figcaption>
          </figure>
        </div>
      </div>

      <div className="sticky top-0 z-20 border-b border-[#172238]/10 bg-[#f5f1e9]/95 backdrop-blur-md">
        <nav className="mx-auto flex max-w-[1240px] gap-2 overflow-x-auto px-5 py-3 sm:px-8 lg:px-12" aria-label={t("Guide sections")}>
          {navigation.map(([label, id]) => (
            <a
              key={id}
              href={`#${id}`}
              className="shrink-0 rounded-full border border-[#172238]/12 bg-white/70 px-4 py-2 text-sm font-semibold text-[#27334a] transition hover:border-[#1f55c9]/40 hover:text-[#1f55c9]"
            >
              {t(label)}
            </a>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-12">
        <section id="models" className="scroll-mt-20 border-b border-[#172238]/10 py-20 sm:py-28">
          <SectionHeading
            eyebrow="Choose the construction"
            title="Three starting points. Infinite ways to customize them."
            description="The model defines the base level of design and production work. We then adapt size, colors, contour and NFC placement to your idea."
          />

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {NFC_KEYCHAIN_TYPES.filter((type) => type.active).map((type) => {
              const detail = modelDetails[type.id as keyof typeof modelDetails];
              const Icon = detail.icon;
              return (
                <article key={type.id} className="group flex min-h-[560px] flex-col overflow-hidden border border-[#172238]/12 bg-[#fbfaf6] transition hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(26,38,62,.1)]">
                  <div className="relative flex h-64 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#ffffff_0%,#e8e3da_72%)] p-5">
                    <img
                      src={detail.image}
                      alt={t(detail.imageAlt)}
                      className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="absolute left-5 top-5 rounded-full bg-white/85 px-3 py-1 font-mono text-xs text-[#596276] shadow-sm backdrop-blur">
                      {detail.number}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-6 sm:p-8">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#1f55c9]">{t(detail.eyebrow)}</span>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e5ebfa] text-[#1f55c9]">
                      <Icon className="h-6 w-6" />
                    </span>
                  </div>
                  <h3 className="mt-5 font-serif text-3xl font-semibold text-[#101b31]">{t(detail.displayLabel)}</h3>
                  <p className="mt-4 text-sm leading-6 text-[#596276]">{t(detail.visual)}</p>
                  <div className="mt-auto border-t border-[#172238]/10 pt-6">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#727b8d]">{t("Best for")}</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-[#27334a]">{t(detail.bestFor)}</p>
                  </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="price" className="scroll-mt-20 border-b border-[#172238]/10 py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-20">
            <div>
              <SectionHeading
                eyebrow="How the quote works"
                title="The price follows the work required."
                description="We do not pretend that a simple flat logo and a detailed character cost the same to design and produce."
              />
              <figure className="mt-9 overflow-hidden border border-[#172238]/12 bg-white/50">
                <img
                  src="/nfc-guide/price-factors.webp"
                  alt={t("Three illustrative keychains showing increasing design and production complexity")}
                  className="aspect-[16/9] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <figcaption className="border-t border-[#172238]/10 px-5 py-3 text-xs leading-5 text-[#626b7b]">
                  {t("A flat surface, raised layers and a detailed custom contour require different amounts of work.")}
                </figcaption>
              </figure>
              <div className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
                {priceFactors.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="border-t border-[#172238]/15 pt-5">
                    <Icon className="h-5 w-5 text-[#1f55c9]" />
                    <h3 className="mt-4 font-semibold text-[#172238]">{t(title)}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#626b7b]">{t(text)}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="bg-[#101d35] p-7 text-white sm:p-9">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8db2ff]">{t("Flat model reference")}</p>
              <h3 className="mt-4 font-serif text-3xl font-semibold">{t("Published unit pricing")}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {t("A flat face with your logo printed on the surface.")}
              </p>
              <div className="mt-7 divide-y divide-white/10 border-y border-white/10">
                {visibleTiers.map((tier) => (
                  <div key={tier.minQuantity} className="flex items-center justify-between py-4">
                    <span className="text-sm text-slate-300">{tier.minQuantity}+ {t("pieces")}</span>
                    <strong className="font-mono text-lg">{formatUsdCents(tier.unitPriceCents)} <span className="text-xs font-normal text-slate-400">/ {t("each")}</span></strong>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-3 text-sm leading-6 text-slate-300">
                <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-[#8db2ff]" />
                <p>{t(`First orders add a one-time ${formatUsdCents(NFC_ART_FEE_CENTS)} art and setup fee. Repeat orders using the approved artwork normally do not.`)}</p>
              </div>
              <div className="mt-5 flex gap-3 text-sm leading-6 text-slate-300">
                <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#8db2ff]" />
                <p>{t("Raised relief and custom shapes receive a written quote after we review the actual design.")}</p>
              </div>
            </aside>
          </div>
        </section>

        <section id="nfc" className="scroll-mt-20 border-b border-[#172238]/10 py-20 sm:py-28">
          <SectionHeading
            eyebrow="The technology inside"
            title="One tap opens the link you choose."
            description="The NFC tag is built into the keychain, programmed with your destination and tested before shipping."
          />
          <figure className="mt-12 overflow-hidden border border-[#172238]/12 bg-white/50">
            <img
              src="/nfc-guide/tap.webp"
              alt={t("Smartphone reading an NFC keychain at a business counter")}
              className="aspect-[16/9] w-full object-cover sm:aspect-[2/1]"
              loading="lazy"
              decoding="async"
            />
            <figcaption className="border-t border-[#172238]/10 px-5 py-3 text-xs leading-5 text-[#626b7b]">
              {t("Bring the back of the phone close to the keychain and open the notification — no app required.")}
            </figcaption>
          </figure>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              [Smartphone, "No app required", "Modern iPhone and Android phones can read the tag without installing anything."],
              [Radio, "Your destination", "Open Google reviews, Instagram, WhatsApp, a menu, booking page, digital card or website."],
              [ShieldCheck, "Programmed and tested", "We check every tag against the approved link before the order leaves production."],
            ].map(([Icon, title, text]) => {
              const CardIcon = Icon as typeof Smartphone;
              return (
                <div key={title as string} className="border-l border-[#172238]/15 py-2 pl-6 sm:pl-8">
                  <CardIcon className="h-7 w-7 text-[#1f55c9]" />
                  <h3 className="mt-5 font-serif text-2xl font-semibold text-[#101b31]">{t(title as string)}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#626b7b]">{t(text as string)}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="artwork" className="scroll-mt-20 border-b border-[#172238]/10 py-20 sm:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading
              eyebrow="From idea to manufacturable design"
              title="Send what you have. We turn it into something that can be made."
              description="A vector logo is ideal, but it is not mandatory. A clear image, product photo, sketch or character reference gives us a place to start."
              />
              <div className="mt-9 border border-[#172238]/12 bg-white/60 p-7 sm:p-9">
              {[
                "We check whether fine details need to be simplified.",
                "We choose a safe position for the NFC tag and keyring hole.",
                "We confirm colors, layers, contour and overall proportions.",
                "You approve the adapted design before production.",
              ].map((item) => (
                <p key={item} className="flex gap-3 border-b border-[#172238]/10 py-4 text-sm leading-6 text-[#344056] last:border-0">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#1f55c9]" />
                  {t(item)}
                </p>
              ))}
              </div>
            </div>
            <figure className="overflow-hidden border border-[#172238]/12 bg-white/50 shadow-[0_24px_60px_rgba(26,38,62,.08)]">
              <img
                src="/nfc-guide/artwork.webp"
                alt={t("Illustrative design desk showing sketch, digital layers, color samples and finished keychain")}
                className="aspect-[4/3] w-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <figcaption className="border-t border-[#172238]/10 px-5 py-3 text-xs leading-5 text-[#626b7b]">
                {t("We adapt the reference, confirm the colors and layers, and send the design for approval.")}
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="process" className="scroll-mt-20 border-b border-[#172238]/10 py-20 sm:py-28">
          <SectionHeading
            eyebrow="What happens after the form"
            title="No surprise charge. No production before approval."
            description="Submitting your details starts the review; it does not charge you or put an unapproved design into production."
          />
          <figure className="mt-12 overflow-hidden border border-[#172238]/12 bg-white/50">
            <img
              src="/nfc-guide/production.webp"
              alt={t("Illustrative batch of NFC keychains being tested and prepared for shipping")}
              className="aspect-[16/9] w-full object-cover sm:aspect-[2/1]"
              loading="lazy"
              decoding="async"
            />
            <figcaption className="border-t border-[#172238]/10 px-5 py-3 text-xs leading-5 text-[#626b7b]">
              {t("After approval, the batch is produced, every NFC tag is tested and the order is prepared for delivery.")}
            </figcaption>
          </figure>
          <div className="mt-12 grid gap-px overflow-hidden border border-[#172238]/12 bg-[#172238]/12 md:grid-cols-2 lg:grid-cols-4">
            {processSteps.map(([number, title, text]) => (
              <div key={number} className="bg-[#fbfaf6] p-6 sm:p-7">
                <span className="font-mono text-sm text-[#1f55c9]">{number}</span>
                <h3 className="mt-8 font-serif text-2xl font-semibold leading-tight text-[#101b31]">{t(title)}</h3>
                <p className="mt-4 text-sm leading-6 text-[#626b7b]">{t(text)}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16">
            <SectionHeading
              eyebrow="Detailed answers"
              title="The questions people ask before ordering."
              description="If your idea is not covered here, send the reference. We can usually tell you quickly what is feasible and what changes the quote."
            />
            <img
              src="/nfc-guide/custom-shape.webp"
              alt={t("Illustrative dog-mascot keychain showing the possibilities of a custom shape")}
              className="mx-auto hidden h-64 w-64 object-contain lg:block"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="mt-12 grid gap-x-12 gap-y-12 lg:grid-cols-2">
            {faqGroups.map((group) => (
              <div key={group.title}>
                <h3 className="border-b-2 border-[#172238] pb-4 text-sm font-bold uppercase tracking-[0.16em] text-[#172238]">
                  {t(group.title)}
                </h3>
                <div className="divide-y divide-[#172238]/12">
                  {group.items.map(([question, answer]) => (
                    <details key={question} className="group py-1">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-5 py-5 font-semibold leading-6 text-[#27334a] marker:hidden">
                        {t(question)}
                        <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-[#1f55c9] transition-transform group-open:rotate-180" />
                      </summary>
                      <p className="pb-6 pr-8 text-sm leading-7 text-[#626b7b]">{t(answer)}</p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-[#0f1d35] text-white">
        <div className="mx-auto grid max-w-[1240px] items-center gap-8 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[1fr_auto] lg:px-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8db2ff]">{t("Ready when you are")}</p>
            <h2 className="mt-4 max-w-2xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">
              {t("Send the details. We will turn the idea into a clear quote.")}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              {t("The form takes a few minutes and does not collect payment. We review everything before production.")}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link href={orderLink} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 font-bold text-[#101d35] transition hover:bg-[#dce7ff]">
              {t("Complete order details")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={nfcWhatsappHref(language)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3.5 font-semibold text-white transition hover:bg-white/5"
            >
              <MessageCircle className="h-4 w-4" />
              {t("Ask on WhatsApp")}
            </a>
          </div>
        </div>
      </section>
    </article>
  );
}
