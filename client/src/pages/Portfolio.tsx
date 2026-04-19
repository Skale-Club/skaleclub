import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings, PortfolioService } from "@shared/schema";
import { ArrowRight, Loader2 } from "lucide-react";
import { trackCTAClick } from "@/lib/analytics";
import { LeadFormModal } from "@/components/LeadFormModal";
import { PortfolioCard } from "@/components/PortfolioCard";
import { ServiceDetailModal } from "@/components/portfolio/ServiceDetailModal";

export default function Portfolio() {
    const { t } = useTranslation();
    const { data: companySettings } = useQuery<CompanySettings>({
        queryKey: ['/api/company-settings'],
    });

    const { data: portfolioServices, isLoading: isLoadingServices } = useQuery<PortfolioService[]>({
        queryKey: ['/api/portfolio-services'],
        staleTime: 0,
        refetchOnMount: true,
    });

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const isModalOpen = selectedIndex !== null;
    const selectedService =
        selectedIndex !== null && portfolioServices ? portfolioServices[selectedIndex] : null;

    const handleCta = (source: string) => {
        setIsFormOpen(true);
        setSelectedIndex(null);
        trackCTAClick('portfolio-' + source, companySettings?.ctaText || 'Book Call');
    };

    const openServiceModal = (service: PortfolioService) => {
        const idx = portfolioServices?.findIndex((s) => s.id === service.id) ?? -1;
        if (idx >= 0) setSelectedIndex(idx);
    };

    const goToPrev = () => {
        if (selectedIndex === null || !portfolioServices) return;
        setSelectedIndex((selectedIndex - 1 + portfolioServices.length) % portfolioServices.length);
    };
    const goToNext = () => {
        if (selectedIndex === null || !portfolioServices) return;
        setSelectedIndex((selectedIndex + 1) % portfolioServices.length);
    };

    if (isLoadingServices) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-[#0A192F]">
                <Loader2 className="w-10 h-10 animate-spin text-white" />
            </div>
        );
    }

    return (
        <>
            <section className="relative pt-28 pb-12 flex flex-col items-center justify-center text-center px-6 bg-gradient-to-br from-[#050810] via-[#080c14] to-[#050810]">
                <div className="relative z-10 max-w-5xl mx-auto">
                    <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full mb-8 inline-flex items-center gap-2 border border-white/20">
                        <span className="text-white font-medium uppercase tracking-wider text-xs md:text-sm">{t("Our Services")}</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                        {t(companySettings?.heroTitle || "Scale Your Business")}
                    </h1>
                </div>
            </section>

            <section className="py-16 px-6 bg-gradient-to-b from-[#0a0f18] to-[#0d1320]">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-wrap justify-center gap-6 [&>*]:flex-[0_1_calc(33.333%-1rem)] [&>*]:min-w-[280px] [&>*]:max-w-[440px]">
                        {portfolioServices?.map((service) => (
                            <PortfolioCard
                                key={service.id}
                                service={service}
                                onClick={() => openServiceModal(service)}
                            />
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-20 px-6 bg-[#111114]">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                        {t("Ready to Redefine Your Potential?")}
                    </h2>
                    <p className="text-xl text-blue-100 mb-8">
                        {t("Join the forward-thinking companies already scaling with Skale Club.")}
                    </p>
                    <button
                        onClick={() => handleCta('footer')}
                        className="px-8 py-4 bg-white text-[#0A192F] font-bold rounded-full text-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 mx-auto shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
                    >
                        {t("Book a Strategy Session")}
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </section>

            {selectedService && (
                <ServiceDetailModal
                    service={selectedService}
                    isOpen={isModalOpen}
                    onClose={() => setSelectedIndex(null)}
                    onCta={handleCta}
                    onPrev={portfolioServices && portfolioServices.length > 1 ? goToPrev : undefined}
                    onNext={portfolioServices && portfolioServices.length > 1 ? goToNext : undefined}
                />
            )}

            <LeadFormModal open={isFormOpen} onClose={() => setIsFormOpen(false)} formSlug="default" />
        </>
    );
}
