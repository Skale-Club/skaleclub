import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "@/hooks/useTranslation";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings, PortfolioService } from "@shared/schema";
import { ArrowRight, X, CheckCircle2, Loader2 } from "lucide-react";
import { trackCTAClick } from "@/lib/analytics";
import { LeadFormModal } from "@/components/LeadFormModal";
import { PortfolioCard, badgeColorMap } from "@/components/PortfolioCard";

// Check color map for modal features
const checkColorMap: Record<string, string> = {
    blue: "text-blue-400",
    purple: "text-purple-400",
    green: "text-green-400",
    orange: "text-orange-400",
    red: "text-red-400",
};

export default function Portfolio() {
    const { t } = useTranslation();
    const { data: companySettings } = useQuery<CompanySettings>({
        queryKey: ['/api/company-settings'],
    });

    // Fetch portfolio services from database
    const { data: portfolioServices, isLoading: isLoadingServices } = useQuery<PortfolioService[]>({
        queryKey: ['/api/portfolio-services'],
        staleTime: 0,
        refetchOnMount: true,
    });

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedService, setSelectedService] = useState<PortfolioService | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleCta = (source: string) => {
        setIsFormOpen(true);
        setIsModalOpen(false);
        trackCTAClick('portfolio-' + source, companySettings?.ctaText || 'Book Call');
    };

    const openServiceModal = (service: PortfolioService) => {
        setSelectedService(service);
        setIsModalOpen(true);
    };

    // Loading state
    if (isLoadingServices) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-[#0A192F]">
                <Loader2 className="w-10 h-10 animate-spin text-white" />
            </div>
        );
    }

    return (
        <>
            {/* Hero Section */}
            <section className="relative py-20 flex flex-col items-center justify-center text-center px-6 bg-gradient-to-br from-[#0A192F] via-[#112240] to-[#0A192F]">
                <div className="relative z-10 max-w-5xl mx-auto">
                    <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full mb-8 inline-flex items-center gap-2 border border-white/20">
                        <span className="text-white font-medium uppercase tracking-wider text-xs md:text-sm">{t("Our Services")}</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
                        {t(companySettings?.heroTitle || "Scale Your Business")}
                    </h1>
                    <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto mb-8 leading-relaxed">
                        {t(companySettings?.heroSubtitle || "We help companies achieve unprecedented growth through modern marketing systems.")}
                    </p>
                </div>
            </section>

            {/* Services Grid - Dark Mode */}
            <section className="py-16 px-6 bg-gradient-to-b from-[#0A192F] to-[#112240]">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

            {/* CTA Section */}
            <section className="py-20 px-6 bg-[#0A192F]">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                        {t("Ready to Redefine Your Potential?")}
                    </h2>
                    <p className="text-xl text-blue-100 mb-8">
                        {t("Join the forward-thinking companies already scaling with Skale Club.")}
                    </p>
                    <button
                        onClick={() => handleCta('footer')}
                        className="px-8 py-4 bg-white text-[#0A192F] font-bold rounded-full text-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 mx-auto shadow-[0_20px_40px_rgba(255,255,255,0.2)]"
                    >
                        {t("Book a Strategy Session")}
                        <ArrowRight className="w-5 h-5" />
                    </button>

                    <div className="mt-12 text-white/50 text-sm flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
                        <Link href="/" className="hover:text-white transition-colors">{t("Back to Home")}</Link>
                        <span>&copy; {new Date().getFullYear()} {companySettings?.companyName || "Skale Club"}. All rights reserved.</span>
                    </div>
                </div>
            </section>

            {/* Service Detail Modal */}
            {selectedService && (
                <ServiceDetailModal
                    service={selectedService}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onCta={handleCta}
                />
            )}

            <LeadFormModal open={isFormOpen} onClose={() => setIsFormOpen(false)} />
        </>
    );
}

// Service Detail Modal Component
function ServiceDetailModal({
    service,
    isOpen,
    onClose,
    onCta
}: {
    service: PortfolioService;
    isOpen: boolean;
    onClose: () => void;
    onCta: (source: string) => void;
}) {
    const { t } = useTranslation();
    const badgeColors = badgeColorMap[service.accentColor || 'blue'] || badgeColorMap.blue;
    const checkColor = checkColorMap[service.accentColor || 'blue'] || checkColorMap.blue;

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-gradient-to-br from-[#1a1a2e] to-[#16213e]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Content */}
                <div className="p-8 md:p-12">
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Left Column - Text Content */}
                        <div className="flex-1">
                            {/* Badge */}
                            <span className={`inline-block ${badgeColors.bg} ${badgeColors.text} text-xs font-bold px-3 py-1 rounded-full mb-4`}>
                                {t(service.badgeText)}
                            </span>

                            {/* Title */}
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                {t(service.title)}
                            </h2>

                            {/* Subtitle */}
                            <p className="text-lg text-purple-100 mb-6">
                                {t(service.subtitle)}
                            </p>

                            {/* Description */}
                            <p className="text-white/90 mb-8 leading-relaxed">
                                {t(service.description)}
                            </p>

                            {/* Price Card */}
                            <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl p-6 mb-8">
                                <div className="flex items-baseline gap-2 mb-4 text-white">
                                    <span className="text-4xl font-extrabold">{service.price}</span>
                                    <span className="text-purple-200 font-medium">{t(service.priceLabel)}</span>
                                </div>
                                <ul className="space-y-3">
                                    {(service.features || []).map((item, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <CheckCircle2 className={`w-5 h-5 ${checkColor} shrink-0 mt-0.5`} />
                                            <span className="text-white/90 font-medium">{t(item)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* CTA Button */}
                            <button
                                onClick={() => onCta(service.slug)}
                                style={{ backgroundColor: service.ctaButtonColor || '#406EF1' }}
                                className="w-full px-8 py-4 text-white font-bold rounded-full text-lg hover:shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                            >
                                {t(service.ctaText)}
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Right Column - Image */}
                        {service.imageUrl && (
                            <div className="flex-1 hidden md:block">
                                <div className="aspect-square relative flex items-center justify-center bg-white/5 border border-white/10 rounded-3xl shadow-xl overflow-hidden">
                                    <img
                                        src={service.imageUrl}
                                        alt={service.title}
                                        className="w-[80%] h-[80%] object-cover rounded-2xl shadow-2xl"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
