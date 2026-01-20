import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { 
  SiFacebook, 
  SiInstagram, 
  SiX, 
  SiYoutube, 
  SiLinkedin, 
  SiTiktok 
} from "react-icons/si";

const platformIcons: Record<string, any> = {
  facebook: SiFacebook,
  instagram: SiInstagram,
  twitter: SiX,
  x: SiX,
  youtube: SiYoutube,
  linkedin: SiLinkedin,
  tiktok: SiTiktok,
};

export function Footer() {
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const companyName = companySettings?.companyName?.trim() || "Skleanings";
  const tagline =
    companySettings?.heroSubtitle?.trim() ||
    companySettings?.seoDescription?.trim() ||
    "Mentoria 1-a-1 em marketing digital para empresários brasileiros que querem escalar nos EUA. Estratégia personalizada, suporte contínuo e foco em resultados reais.";

  return (
    <footer className="bg-[#1F1F1F] text-slate-300 py-8 md:py-10">
      <div className="container-custom mx-auto px-4">
        <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-6">
          <Link href="/" className="flex items-center gap-2">
            {companySettings?.logoDark ? (
              <img
                src={companySettings.logoDark}
                alt={companyName}
                className="h-auto w-[52px]"
              />
            ) : companySettings?.logoIcon ? (
              <img
                src={companySettings.logoIcon}
                alt={companyName}
                className="h-auto w-[52px] brightness-0 invert"
              />
            ) : (
              <img
                src="https://storage.googleapis.com/msgsndr/q6UKnlWOQwyTk82yZPAs/media/695dbac289c99d91ea25f488.svg"
                alt={companyName}
                className="h-auto w-[52px] brightness-0 invert"
              />
            )}
          </Link>
          <p className="text-gray-400 max-w-md text-sm leading-relaxed">
            {tagline}
          </p>

          {companySettings && (companySettings as any).socialLinks && Array.isArray((companySettings as any).socialLinks) && (companySettings as any).socialLinks.length > 0 && (
            <div className="flex gap-4">
              {((companySettings as any).socialLinks as {platform: string, url: string}[]).map((link, i) => {
                const Icon = platformIcons[link.platform.toLowerCase()] || SiFacebook;
                return (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="container-custom mx-auto px-4 mt-8 pt-6 border-t border-[#2A2A2A]">
        <div className="flex flex-col items-center space-y-4 text-center">
          <p className="text-gray-400 text-xs md:text-sm">© {new Date().getFullYear()} {companyName}. Todos os direitos reservados.</p>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 text-xs md:text-sm">
            <Link href="/privacy-policy" className="text-gray-400 hover:text-gray-200 transition-colors">Política de Privacidade</Link>
            <Link href="/terms-of-service" className="text-gray-400 hover:text-gray-200 transition-colors">Termos de Serviço</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
