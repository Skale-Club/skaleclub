import { useTranslation } from "@/hooks/useTranslation";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";

export function LanguageToggle() {
  const { language, setLanguage } = useTranslation();
  return <LanguageSwitch value={language} onValueChange={setLanguage} />;
}
