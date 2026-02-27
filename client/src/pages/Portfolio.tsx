import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "@/hooks/useTranslation";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings, PortfolioSettings } from "@shared/schema";
import { ArrowRight, ChevronDown, Rocket, Users, Target, BarChart, ExternalLink, Monitor, CheckCircle2, Bot, CalendarDays, Share2 } from "lucide-react";
import { trackCTAClick } from "@/lib/analytics";
import { LeadFormModal } from "@/components/LeadFormModal";
import { motion } from "framer-motion";
import * as THREE from "three";
// @ts-ignore
import WAVES from "vanta/dist/vanta.waves.min";

const HeroWaveBackground = () => {
    const vantaRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let vantaEffect: any;
        if (vantaRef.current) {
            vantaEffect = WAVES({
                el: vantaRef.current,
                THREE: THREE,
                mouseControls: false,
                touchControls: false,
                gyroControls: false,
                minHeight: 200.00,
                minWidth: 200.00,
                scale: 1.00,
                scaleMobile: 1.00,
                color: 0x555555,
                backgroundColor: 0x0a192f,
                waveHeight: 10.00,
                waveSpeed: 0.50,
                zoom: 0.85
            });
        }
        return () => {
            if (vantaEffect) vantaEffect.destroy();
        };
    }, []);
    return (
        <div
            ref={vantaRef}
            className="absolute inset-0 z-0 opacity-20 pointer-events-none"
            style={{
                maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)'
            }}
        />
    );
};

export default function Portfolio() {
    const { t } = useTranslation();
    const { data: companySettings } = useQuery<CompanySettings>({
        queryKey: ['/api/company-settings'],
    });
    const { data: portfolioSettings } = useQuery<PortfolioSettings>({
        queryKey: ['/api/portfolio-settings'],
    });

    const [isFormOpen, setIsFormOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleCta = (source: string) => {
        setIsFormOpen(true);
        trackCTAClick('portfolio-' + source, companySettings?.ctaText || 'Book Call');
    };

    const scrollToNext = (index: number) => {
        if (!containerRef.current) return;
        const sections = containerRef.current.querySelectorAll('section');
        if (sections[index + 1]) {
            sections[index + 1].scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        // Add overflow hidden to body to prevent double scrollbars
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto'; // restore on unmount
        };
    }, []);

    const slides = [
        {
            id: "intro",
            content: (
                <>
                    <HeroWaveBackground />
                    <div className="flex flex-col items-center justify-center h-full text-center px-6 relative z-10 w-full max-w-5xl mx-auto">
                        {companySettings?.logoMain ? (
                            <img src={companySettings.logoMain} alt="Logo" className="h-10 md:h-12 absolute top-8 left-8 z-20" />
                        ) : null}
                        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full mb-8 inline-flex items-center gap-2 border border-white/20 z-20">
                            <span className="text-white font-medium uppercase tracking-wider text-xs md:text-sm">{t(portfolioSettings?.heroBadgeText || "Portfolio")}</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight z-20">
                            {t(portfolioSettings?.heroTitle || companySettings?.heroTitle || "Scale Your Business")}
                        </h1>
                        <p className="text-lg md:text-2xl text-blue-100 max-w-2xl mx-auto mb-12 leading-relaxed font-light z-20">
                            {t(portfolioSettings?.heroSubtitle || companySettings?.heroSubtitle || "We help companies achieve unprecedented growth through modern marketing systems.")}
                        </p>
                        <button
                            onClick={() => handleCta('hero')}
                            className="px-8 py-4 bg-white text-blue-900 font-bold rounded-full text-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.2)] z-20"
                        >
                            {t(companySettings?.ctaText || "Get Started")}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </>
            ),
            bg: "bg-gradient-to-br from-[#0A192F] via-[#112240] to-[#0A192F]"
        },
        {
            id: "social-cash",
            content: (
                <div className="flex flex-col md:flex-row items-center justify-center h-full px-6 max-w-6xl mx-auto gap-12 w-full">
                    <div className="w-full md:w-1/2 text-left">
                        <h2 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6 font-display">
                            {t("Social Cash")}
                        </h2>
                        <p className="text-lg md:text-xl text-slate-600 mb-8 leading-relaxed">
                            {t("Total automation for your social media. We create, schedule, and post high-converting content on autopilot, so you can focus on closing deals.")}
                        </p>
                        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 mb-8 relative">
                            <div className="absolute top-0 right-0 bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-bl-xl rounded-tr-3xl text-xs uppercase">
                                {t("One-time Fee")}
                            </div>
                            <div className="flex items-baseline gap-2 mb-4">
                                <span className="text-4xl font-extrabold text-slate-900">$1,999.00</span>
                                <span className="text-slate-500 font-medium text-sm">{t("One-time")}</span>
                            </div>
                            <ul className="space-y-3">
                                {[
                                    "Complete social media autopost system",
                                    "Tgoo exclusive integration",
                                    "Multi-platform syndication",
                                    "Analytics and reporting"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                        <span className="text-slate-700 font-medium text-sm md:text-base">{t(item)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="mb-8">
                            <img src="https://pro10.pt/public/img/tgoo.svg" alt="Tgoo platform" className="h-10 opacity-70" />
                        </div>
                        <button
                            onClick={() => handleCta('social-cash')}
                            className="px-8 py-4 bg-[#406EF1] text-white font-bold rounded-full text-lg hover:shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                        >
                            {t("Automate Social Media")}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="w-full md:w-1/2 hidden md:block">
                        <div className="aspect-square relative flex items-center justify-center bg-gray-50 rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                            <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Social Media" className="w-[80%] h-[80%] object-cover rounded-2xl shadow-2xl z-10 transition-transform hover:scale-105 duration-700" />
                        </div>
                    </div>
                </div>
            ),
            bg: "bg-white"
        },
        {
            id: "voice-ai",
            content: (
                <div className="flex flex-col md:flex-row-reverse items-center justify-center h-full px-6 max-w-6xl mx-auto gap-12 w-full">
                    <div className="w-full md:w-1/2 text-left">
                        <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 font-display">
                            {t("Voice AI Assistant")}
                        </h2>
                        <p className="text-lg md:text-xl text-purple-100 mb-8 leading-relaxed">
                            {t("Never miss a call or an opportunity. Our Voice AI Assistant answers calls, books appointments, and captures leads 24/7.")}
                        </p>
                        <div className="bg-white/10 border border-white/20 rounded-3xl p-6 mb-8 relative backdrop-blur-sm">
                            <div className="absolute top-0 right-0 bg-purple-500 text-white font-bold px-3 py-1 rounded-bl-xl rounded-tr-3xl text-xs uppercase">
                                {t("Subscription")}
                            </div>
                            <div className="flex items-baseline gap-2 mb-4 text-white">
                                <span className="text-4xl font-extrabold">$49.90</span>
                                <span className="text-purple-200 font-medium text-sm">{t("per month")}</span>
                            </div>
                            <ul className="space-y-3">
                                {[
                                    "24/7 intelligent call answering",
                                    "Automated appointment booking",
                                    "FAQ resolution in natural language",
                                    "Instant SMS follow-ups"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0" />
                                        <span className="text-white/90 font-medium text-sm md:text-base">{t(item)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button
                            onClick={() => handleCta('voice-ai')}
                            className="px-8 py-4 bg-purple-500 text-white font-bold rounded-full text-lg hover:shadow-lg hover:bg-purple-600 hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                        >
                            {t("Hire AI Assistant")}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="w-full md:w-1/2 hidden md:block">
                        <div className="aspect-square relative flex items-center justify-center bg-white/5 rounded-3xl border border-white/10 shadow-xl overflow-hidden backdrop-blur-sm">
                            <img src="https://images.unsplash.com/photo-1531746790731-6c087fecd65a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Artificial Intelligence" className="w-[80%] h-[80%] object-cover rounded-2xl shadow-2xl z-10 transition-transform hover:scale-105 duration-700" />
                        </div>
                    </div>
                </div>
            ),
            bg: "bg-[#1C1936]"
        },
        {
            id: "crm",
            content: (
                <div className="flex flex-col md:flex-row items-center justify-center h-full px-6 max-w-6xl mx-auto gap-12 w-full">
                    <div className="w-full md:w-1/2 text-left">
                        <h2 className="text-4xl md:text-6xl font-bold text-[#1D1D1D] mb-6 font-display">
                            {t("CRM System")}
                        </h2>
                        <p className="text-lg md:text-xl text-slate-600 mb-8 leading-relaxed">
                            {t("Seamlessly unify your lead management. We provide a powerful pipeline that ensures no prospect ever falls through the cracks.")}
                        </p>
                        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 mb-8 relative">
                            <div className="absolute top-0 right-0 bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-bl-xl rounded-tr-3xl text-xs uppercase">
                                {t("Subscription")}
                            </div>
                            <div className="flex items-baseline gap-2 mb-4">
                                <span className="text-4xl font-extrabold text-slate-900">$49.90</span>
                                <span className="text-slate-500 font-medium text-sm">{t("per month")}</span>
                            </div>
                            <ul className="space-y-3">
                                {[
                                    "Custom sales pipelines",
                                    "Automated SMS/Email follow-ups",
                                    "Centralized inbox (IG, FB, SMS)",
                                    "Advanced analytics & tracking"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                        <span className="text-slate-700 font-medium text-sm md:text-base">{t(item)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button
                            onClick={() => handleCta('crm')}
                            className="px-8 py-4 bg-emerald-500 text-white font-bold rounded-full text-lg hover:shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                        >
                            {t("Get The CRM")}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="w-full md:w-1/2 hidden md:block">
                        <div className="aspect-square relative flex items-center justify-center bg-slate-50 rounded-3xl border border-slate-100 shadow-xl p-8">
                            <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="CRM Team" className="w-[80%] h-[80%] object-cover rounded-2xl shadow-2xl z-10 transition-transform hover:scale-105 duration-700" />
                        </div>
                    </div>
                </div>
            ),
            bg: "bg-[#F8FAFC]"
        },
        {
            id: "scheduling",
            content: (
                <div className="flex flex-col md:flex-row-reverse items-center justify-center h-full px-6 max-w-6xl mx-auto gap-12 w-full">
                    <div className="w-full md:w-1/2 text-left">
                        <h2 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6 font-display">
                            {t("Scheduling System")}
                        </h2>
                        <p className="text-lg md:text-xl text-slate-600 mb-8 leading-relaxed">
                            {t("Let clients book and pay for your services directly online. We build custom websites centered entirely around an effortless booking experience.")}
                        </p>
                        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 mb-8 relative">
                            <div className="absolute top-0 right-0 bg-orange-100 text-orange-700 font-bold px-3 py-1 rounded-bl-xl rounded-tr-3xl text-xs uppercase">
                                {t("Setup")}
                            </div>
                            <div className="flex items-baseline gap-2 mb-4">
                                <span className="text-4xl font-extrabold text-slate-900">$1,490.00</span>
                                <span className="text-slate-500 font-medium text-sm">{t("One-time")}</span>
                            </div>
                            <ul className="space-y-3">
                                {[
                                    "Full Scheduling Website",
                                    "Calendar syncing (Google/Outlook)",
                                    "Automatic reminders to reduce no-shows",
                                    "Integrated payment processing"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                        <span className="text-slate-700 font-medium text-sm md:text-base">{t(item)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button
                            onClick={() => handleCta('scheduling')}
                            className="px-8 py-4 bg-orange-500 text-white font-bold rounded-full text-lg hover:shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                        >
                            {t("Setup Scheduling")}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="w-full md:w-1/2 hidden md:block">
                        <div className="aspect-square relative flex items-center justify-center bg-gray-50 rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                            <img src="https://images.unsplash.com/photo-1506784951206-3962def1bb1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Calendar Scheduling" className="w-[80%] h-[80%] object-cover rounded-2xl shadow-2xl z-10 transition-transform hover:scale-105 duration-700" />
                        </div>
                    </div>
                </div>
            ),
            bg: "bg-white"
        },
        {
            id: "websites",
            content: (
                <div className="flex flex-col md:flex-row items-center justify-center h-full px-6 max-w-6xl mx-auto gap-12 w-full">
                    <div className="w-full md:w-1/2 text-left">
                        <h2 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6 font-display">
                            {t("Service Business Websites")}
                        </h2>
                        <p className="text-lg md:text-xl text-slate-600 mb-8 leading-relaxed">
                            {t("Stop relying on Facebook pages. Get a high-converting, professional digital storefront that turns visitors into leads.")}
                        </p>
                        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 mb-8 relative">
                            <div className="absolute top-0 right-0 bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-bl-xl rounded-tr-3xl text-xs uppercase">
                                {t("Starting at")}
                            </div>
                            <div className="flex items-baseline gap-2 mb-4">
                                <span className="text-4xl font-extrabold text-slate-900">$600</span>
                                <span className="text-slate-500 font-medium text-sm">{t("One-time Setup")}</span>
                            </div>
                            <ul className="space-y-3">
                                {[
                                    "Up to 5 custom-designed pages",
                                    "Lead capture form integration",
                                    "100% Mobile & tablet optimized",
                                    "Built-in Local SEO structure"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                        <span className="text-slate-700 font-medium text-sm md:text-base">{t(item)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button
                            onClick={() => handleCta('websites')}
                            className="px-8 py-4 bg-[#406EF1] text-white font-bold rounded-full text-lg hover:shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                        >
                            {t("Claim Your Website")}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="w-full md:w-1/2 hidden md:block">
                        <div className="aspect-square relative flex items-center justify-center bg-gray-50 rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                            <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Website Creation" className="w-full h-full object-cover rounded-3xl shadow-xl z-10 transition-transform hover:scale-105 duration-700" />
                        </div>
                    </div>
                </div>
            ),
            bg: "bg-white"
        },
        {
            id: "cta",
            content: (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 relative z-10 w-full max-w-4xl mx-auto">
                    <h2 className="text-5xl md:text-7xl font-bold text-white mb-6 font-display leading-tight">
                        {t(portfolioSettings?.ctaTitle || "Ready to Redefine Your Potential?")}
                    </h2>
                    <p className="text-xl md:text-2xl text-blue-100 mb-12 font-light">
                        {t(portfolioSettings?.ctaSubtitle || "Join the forward-thinking companies already scaling with us.")}
                    </p>
                    <button
                        onClick={() => handleCta('footer')}
                        className="px-8 md:px-10 py-4 md:py-5 bg-white text-[#0A192F] font-bold rounded-full text-xl md:text-2xl hover:scale-105 transition-transform flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(255,255,255,0.2)]"
                    >
                        {t(portfolioSettings?.ctaButtonText || "Book a Strategy Session")}
                        <Rocket className="w-6 h-6 text-[#406EF1]" />
                    </button>

                    <div className="absolute bottom-8 left-0 right-0 text-center text-white/50 text-sm flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 px-6">
                        <Link href="/" className="hover:text-white transition-colors">{t("Back to Home")}</Link>
                        <span>&copy; {new Date().getFullYear()} {companySettings?.companyName || "Skale Club"}. All rights reserved.</span>
                    </div>
                </div>
            ),
            bg: "bg-[#0A192F]"
        }
    ];

    return (
        <>
            <div
                ref={containerRef}
                className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-background m-0 p-0 hide-scrollbar"
                style={{ scrollBehavior: 'smooth' }}
            >
                {slides.map((slide, index) => (
                    <section
                        key={slide.id}
                        className={`h-[100dvh] w-full snap-start relative flex flex-col items-center justify-center shrink-0 ${slide.bg}`}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 100, scale: 0.9 }}
                            whileInView={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                            viewport={{ once: false, amount: 0.3 }}
                            className="w-full h-full absolute inset-0"
                        >
                            {slide.content}
                        </motion.div>

                        {index < slides.length - 1 && (
                            <button
                                onClick={() => scrollToNext(index)}
                                className="absolute bottom-6 md:bottom-10 left-[calc(50%-1.5rem)] text-white/50 hover:text-white transition-colors animate-bounce z-20"
                                aria-label="Scroll to next section"
                            >
                                <div className="p-2 md:p-3 rounded-full bg-black/10 backdrop-blur-sm border border-white/10 cursor-pointer hover:bg-black/20 transition-all">
                                    <ChevronDown className={`w-6 h-6 md:w-8 md:h-8 ${["social-cash", "crm", "scheduling", "websites"].includes(slide.id) ? "text-slate-400" : "text-white"}`} />
                                </div>
                            </button>
                        )}
                    </section>
                ))}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />

            <LeadFormModal open={isFormOpen} onClose={() => setIsFormOpen(false)} />
        </>
    );
}
