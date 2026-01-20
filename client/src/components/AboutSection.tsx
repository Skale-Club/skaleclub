import { User, Award, Heart, CheckCircle } from "lucide-react";
import type { HomepageContent } from "@shared/schema";
import { DEFAULT_HOMEPAGE_CONTENT } from "@/lib/homepageDefaults";

interface AboutSectionProps {
  content?: HomepageContent['aboutSection'] | null;
  aboutImageUrl?: string | null;
}

export function AboutSection({ content, aboutImageUrl }: AboutSectionProps) {
  const sectionContent = {
    ...DEFAULT_HOMEPAGE_CONTENT.aboutSection,
    ...(content || {}),
  };

  const highlights = sectionContent?.highlights || DEFAULT_HOMEPAGE_CONTENT.aboutSection?.highlights || [];

  return (
    <div className="container-custom mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="order-2 lg:order-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-medium mb-6">
            <User className="w-4 h-4" />
            {sectionContent?.label || 'Sobre Nós'}
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-[#1D1D1D]">
            {sectionContent?.heading || 'Quem Somos'}
          </h2>

          <p className="text-slate-600 text-lg mb-6 leading-relaxed">
            {sectionContent?.description || 'Somos uma empresa de limpeza profissional dedicada a proporcionar ambientes limpos e saudáveis para nossos clientes. Com anos de experiência no mercado, oferecemos serviços de alta qualidade com comprometimento e excelência.'}
          </p>

          {highlights.length > 0 && (
            <div className="space-y-4 mb-8">
              {highlights.map((highlight, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-[#1D1D1D] mb-1">{highlight.title}</h4>
                    <p className="text-slate-600">{highlight.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="order-1 lg:order-2 h-[450px] rounded-2xl overflow-hidden shadow-2xl border border-slate-100 relative">
          <img
            src={aboutImageUrl || DEFAULT_HOMEPAGE_CONTENT.aboutSection?.defaultImageUrl || '/placeholder-about.jpg'}
            alt={sectionContent?.heading || 'Sobre nossa empresa'}
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}
