import { useTranslation } from "@/hooks/useTranslation";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";

export function MobileLanguageToggle() {
  const { language, setLanguage } = useTranslation();
  return (
    <div className="flex items-center justify-center">
      <LanguageSwitch value={language} onValueChange={setLanguage} size="md" />
    </div>
  );
}
