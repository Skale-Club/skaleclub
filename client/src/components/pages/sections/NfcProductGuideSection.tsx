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
import { Band, EditorialCard, Eyebrow, Figure, PillLink } from "@/components/editorial";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { useTranslation } from "@/hooks/useTranslation";
import {
  NFC_ART_FEE_CENTS,
  NFC_KEYCHAIN_TYPES,
  NFC_QUANTITY,
  NFC_VOLUME_TIERS,
  formatUsdCents,
  formatUsdCentsFor,
} from "@shared/nfc-pricing";
import { nfcWhatsappHref } from "@shared/nfc-whatsapp";
import { NFC_GUIDE_FAQ_EN } from "@shared/nfcGuideFaq";

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

const faqGroups = NFC_GUIDE_FAQ_EN;

export function NfcProductGuideSection({ props }: { props: NfcProductGuideProps }) {
  const { t, language } = useTranslation();
  const orderHref = props.orderHref ?? "/nfc-order";
  const orderLink = `${orderHref}${typeof window === "undefined" ? "" : window.location.search}`;
  const visibleTiers = NFC_VOLUME_TIERS.filter(
    (tier) => tier.minQuantity >= NFC_QUANTITY.min && tier.minQuantity <= NFC_QUANTITY.max,
  );

  return (
    <article className="bg-navy-950 text-fog-200 [color-scheme:dark]" data-testid="section-nfc-product-guide">
      <Band tone="hero" pattern containerClassName="page-top pb-16 sm:pb-24">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cta-soft/25 bg-navy-800/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-cta-softer shadow-[0_10px_35px_rgba(0,0,0,.18)] backdrop-blur">
              <Radio className="h-4 w-4" />
              {t("NFC keychain guide")}
            </div>
            <h1 className="mt-8 max-w-4xl font-display text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-fog-50 sm:text-6xl lg:text-7xl">
              {t("Understand the options before you place an order.")}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-fog-400 sm:text-xl">
              {t("Models, prices, NFC technology, artwork and production, explained clearly and without turning this page into a sales pitch.")}
            </p>
          </div>

          <EditorialCard tone="dark" accent className="bg-navy-800/90 shadow-[0_22px_60px_rgba(0,0,0,.28)] backdrop-blur sm:p-6">
            <Sparkles className="h-6 w-6 text-cta-soft" />
            <p className="mt-5 font-display text-2xl font-semibold leading-tight text-fog-50">
              {t("Almost anything is possible. Every choice affects the price.")}
            </p>
            <p className="mt-4 text-sm leading-6 text-fog-400">
              {t("A simple flat logo has predictable pricing. Relief, custom shapes, characters and detailed pieces are reviewed and quoted individually.")}
            </p>
          </EditorialCard>
        </div>

        <Figure
          tone="dark"
          eager
          src="/nfc-guide/hero.webp" width={1400} height={933}
          alt="AI-generated visual examples of flat, raised-relief and custom-shaped NFC keychains"
          caption="Illustrative concepts. Your final design is reviewed and approved before production."
          icon={Sparkles}
          imgClassName="sm:aspect-[2/1]"
          className="mt-12 border-transparent sm:mt-16"
          captionClassName="py-4 sm:px-6"
        />
      </Band>

      <div className="sticky top-[var(--nav-offset)] z-20 border-b border-white/10 bg-navy-950/95 shadow-[0_12px_35px_rgba(0,0,0,.22)] backdrop-blur-md">
        <nav className="container-editorial flex gap-2 overflow-x-auto py-3" aria-label={t("Guide sections")}>
          {navigation.map(([label, id]) => (
            <PillLink
              key={id}
              href={`#${id}`}
              variant="ghost"
              size="sm"
              className="shrink-0 border-white/10 bg-navy-800/85 text-fog-300 hover:border-cta-soft/60 hover:bg-navy-600 hover:text-white"
            >
              {t(label)}
            </PillLink>
          ))}
        </nav>
      </div>

      <Band tone="cream" id="models" subnav>
        <SectionHeading
          variant="editorial"
          tone="light"
          eyebrow="Choose the construction"
          title="Three starting points. Infinite ways to customize them."
          subtitle="The model defines the base level of design and production work. We then adapt size, colors, contour and NFC placement to your idea."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {NFC_KEYCHAIN_TYPES.filter((type) => type.active).map((type) => {
            const detail = modelDetails[type.id as keyof typeof modelDetails];
            const Icon = detail.icon;
            return (
              <article key={type.id} className="group flex min-h-[560px] flex-col overflow-hidden border border-ink-700/10 bg-white transition hover:-translate-y-1 hover:border-cta-ink/25 hover:shadow-[0_28px_70px_rgba(26,38,62,.12)]">
                {/* One-off decorative studio backdrop for the product shot. */}
                <div className="relative flex h-64 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#ffffff_0%,#e8e3da_72%)] p-5">
                  <img
                    src={detail.image}
                    alt={t(detail.imageAlt)}
                    className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.04]"
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="absolute left-5 top-5 rounded-full border border-ink-700/10 bg-white/85 px-3 py-1 text-xs tabular-nums text-ink-500 shadow-sm backdrop-blur">
                    {detail.number}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6 sm:p-8">
                  <div className="flex items-start justify-between">
                    <Eyebrow tone="light" className="tracking-[0.2em]">{t(detail.eyebrow)}</Eyebrow>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cta-ink/10 text-cta-ink ring-1 ring-inset ring-cta-ink/10">
                      <Icon className="h-6 w-6" />
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-3xl font-semibold text-ink">{t(detail.displayLabel)}</h3>
                  <p className="mt-4 text-sm leading-6 text-ink-500">{t(detail.visual)}</p>
                  <div className="mt-auto border-t border-ink-700/10 pt-6">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-400">{t("Best for")}</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-ink-700">{t(detail.bestFor)}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Band>

      <Band tone="dark" id="price" subnav>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-20">
          <div>
            <SectionHeading
              variant="editorial"
              eyebrow="How the quote works"
              title="The price follows the work required."
              subtitle="We do not pretend that a simple flat logo and a detailed character cost the same to design and produce."
            />
            <Figure
              tone="dark"
              src="/nfc-guide/price-factors.webp" width={1400} height={933}
              alt="Three illustrative keychains showing increasing design and production complexity"
              caption="A flat surface, raised layers and a detailed custom contour require different amounts of work."
              className="mt-9"
            />
            <div className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
              {priceFactors.map(({ icon: Icon, title, text }) => (
                <div key={title} className="border-t border-white/15 pt-5">
                  <Icon className="h-5 w-5 text-cta-soft" />
                  <h3 className="mt-4 font-semibold text-fog-50">{t(title)}</h3>
                  <p className="mt-2 text-sm leading-6 text-fog-400">{t(text)}</p>
                </div>
              ))}
            </div>
          </div>

          <aside>
            <EditorialCard tone="dark" className="h-full border-transparent bg-navy-700 p-7 text-white shadow-[0_26px_70px_rgba(0,0,0,.28)] sm:p-9">
              <Eyebrow className="tracking-[0.22em] text-cta-softer">{t("Flat model reference")}</Eyebrow>
              <h3 className="mt-4 font-display text-3xl font-semibold">{t("Published unit pricing")}</h3>
              <p className="mt-3 text-sm leading-6 text-fog-300">
                {t("A flat face with your logo printed on the surface.")}
              </p>
              <div className="mt-7 divide-y divide-white/10 border-y border-white/10">
                {visibleTiers.map((tier) => (
                  <div key={tier.minQuantity} className="flex items-center justify-between py-4">
                    <span className="text-sm text-fog-300">{tier.minQuantity}+ {t("pieces")}</span>
                    <strong className="text-lg tabular-nums">{formatUsdCentsFor(language)(tier.unitPriceCents)} <span className="text-xs font-normal text-fog-400">/ {t("each")}</span></strong>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-3 text-sm leading-6 text-fog-300">
                <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-cta-softer" />
                <p>{t(`First orders add a one-time ${formatUsdCents(NFC_ART_FEE_CENTS)} art and setup fee. Repeat orders using the approved artwork normally do not.`)}</p>
              </div>
              <div className="mt-5 flex gap-3 text-sm leading-6 text-fog-300">
                <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-cta-softer" />
                <p>{t("Raised relief and custom shapes receive a written quote after we review the actual design.")}</p>
              </div>
            </EditorialCard>
          </aside>
        </div>
      </Band>

      <Band tone="white" id="nfc" subnav>
        <SectionHeading
          variant="editorial"
          tone="light"
          eyebrow="The technology inside"
          title="One tap opens the link you choose."
          subtitle="The NFC tag is built into the keychain, programmed with your destination and tested before shipping."
        />
        <Figure
          tone="light"
          src="/nfc-guide/tap.webp" width={1400} height={933}
          alt="Smartphone reading an NFC keychain at a business counter"
          caption="Bring the back of the phone close to the keychain and open the notification. No app required."
          imgClassName="sm:aspect-[2/1]"
          className="mt-12"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            [Smartphone, "No app required", "Modern iPhone and Android phones can read the tag without installing anything."],
            [Radio, "Your destination", "Open Google reviews, Instagram, WhatsApp, a menu, booking page, digital card or website."],
            [ShieldCheck, "Programmed and tested", "We check every tag against the approved link before the order leaves production."],
          ].map(([Icon, title, text]) => {
            const CardIcon = Icon as typeof Smartphone;
            return (
              <div key={title as string} className="border-l border-ink-700/15 py-2 pl-6 sm:pl-8">
                <CardIcon className="h-7 w-7 text-cta-ink" />
                <h3 className="mt-5 font-display text-2xl font-semibold text-ink">{t(title as string)}</h3>
                <p className="mt-3 text-sm leading-6 text-ink-500">{t(text as string)}</p>
              </div>
            );
          })}
        </div>
      </Band>

      <Band tone="dark" id="artwork" subnav>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading
              variant="editorial"
              eyebrow="From idea to manufacturable design"
              title="Send what you have. We turn it into something that can be made."
              subtitle="A vector logo is ideal, but it is not mandatory. A clear image, product photo, sketch or character reference gives us a place to start."
            />
            <EditorialCard tone="dark" className="mt-9 p-7 sm:p-9">
              {[
                "We check whether fine details need to be simplified.",
                "We choose a safe position for the NFC tag and keyring hole.",
                "We confirm colors, layers, contour and overall proportions.",
                "You approve the adapted design before production.",
              ].map((item) => (
                <p key={item} className="flex gap-3 border-b border-white/10 py-4 text-sm leading-6 text-fog-300 last:border-0">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-cta-soft" />
                  {t(item)}
                </p>
              ))}
            </EditorialCard>
          </div>
          <Figure
            tone="dark"
            aspect="4/3"
            src="/nfc-guide/artwork.webp" width={1400} height={933}
            alt="Illustrative design desk showing sketch, digital layers, color samples and finished keychain"
            caption="We adapt the reference, confirm the colors and layers, and send the design for approval."
          />
        </div>
      </Band>

      <Band tone="ice" id="process" subnav>
        <SectionHeading
          variant="editorial"
          tone="light"
          eyebrow="What happens after the form"
          title="No surprise charge. No production before approval."
          subtitle="Submitting your details starts the review; it does not charge you or put an unapproved design into production."
        />
        <Figure
          tone="light"
          src="/nfc-guide/production.webp" width={1400} height={933}
          alt="Illustrative batch of NFC keychains being tested and prepared for shipping"
          caption="After approval, the batch is produced, every NFC tag is tested and the order is prepared for delivery."
          imgClassName="sm:aspect-[2/1]"
          className="mt-12"
        />
        <div className="mt-12 grid gap-px overflow-hidden border border-ink-700/10 bg-ink-700/10 md:grid-cols-2 lg:grid-cols-4">
          {processSteps.map(([number, title, text]) => (
            <div key={number} className="bg-white p-6 transition hover:bg-paper-ice/60 sm:p-7">
              <span className="text-sm tabular-nums text-cta-ink">{number}</span>
              <h3 className="mt-8 font-display text-2xl font-semibold leading-tight text-ink">{t(title)}</h3>
              <p className="mt-4 text-sm leading-6 text-ink-500">{t(text)}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band tone="dark" id="faq" subnav>
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16">
          <SectionHeading
            variant="editorial"
            eyebrow="Detailed answers"
            title="The questions people ask before ordering."
            subtitle="If your idea is not covered here, send the reference. We can usually tell you quickly what is feasible and what changes the quote."
          />
          <img
            src="/nfc-guide/custom-shape.webp"
            width={800}
            height={841}
            alt={t("Illustrative dog-mascot keychain showing the possibilities of a custom shape")}
            className="mx-auto hidden h-64 w-64 object-contain lg:block"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="mt-12 grid gap-x-12 gap-y-12 lg:grid-cols-2">
          {faqGroups.map((group) => (
            <div key={group.title}>
              <h3 className="border-b-2 border-cta-softer/70 pb-4 text-sm font-bold uppercase tracking-[0.16em] text-fog-50">
                {t(group.title)}
              </h3>
              <div className="divide-y divide-white/10">
                {group.items.map(([question, answer]) => (
                  <details key={question} className="group py-1">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-5 py-5 font-semibold leading-6 text-fog-200 transition hover:text-white marker:hidden">
                      {t(question)}
                      <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-cta-soft transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="pb-6 pr-8 text-sm leading-7 text-fog-400">{t(answer)}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Band>

      <Band tone="cta">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <Eyebrow className="tracking-[0.22em] text-cta-softer">{t("Ready when you are")}</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
              {t("Send the details. We will turn the idea into a clear quote.")}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-fog-300">
              {t("The form takes a few minutes and does not collect payment. We review everything before production.")}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <PillLink href={orderLink} variant="primary">
              {t("Complete order details")}
              <ArrowRight className="h-4 w-4" />
            </PillLink>
            <PillLink href={nfcWhatsappHref(language)} target="_blank" rel="noreferrer" variant="ghost">
              <MessageCircle className="h-4 w-4" />
              {t("Ask on WhatsApp")}
            </PillLink>
          </div>
        </div>
      </Band>
    </article>
  );
}
