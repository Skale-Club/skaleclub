import { useTranslation } from "@/hooks/useTranslation";
import { clsx } from "clsx";

export function LanguageToggle() {
  const { language, setLanguage } = useTranslation();
  const isPortuguese = language === 'pt';

  const toggleLanguage = () => {
    setLanguage(isPortuguese ? 'en' : 'pt');
  };

  return (
    <div className="flex items-center gap-3 select-none">
      {/* EN Label */}
      <span
        onClick={() => setLanguage('en')}
        className={clsx(
          "text-sm font-bold transition-colors duration-200 cursor-pointer",
          !isPortuguese ? "text-white" : "text-gray-500 hover:text-gray-300"
        )}
      >
        EN
      </span>

      {/* Toggle Switch */}
      <button
        onClick={toggleLanguage}
        className="relative inline-flex h-[26px] w-[44px] items-center rounded-full bg-[#E5E7EB] shadow-[inset_-2px_2px_4px_rgba(0,0,0,0.25),inset_1px_-1px_2px_rgba(255,255,255,0.8)] transition-colors duration-200 focus:outline-none border-0"
        role="switch"
        aria-checked={isPortuguese}
        aria-label={`Switch to ${isPortuguese ? 'English' : 'Portuguese'}`}
      >
        {/* Toggle Circle */}
        <span
          className={clsx(
            "relative inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_2px_2px_rgba(255,255,255,1),inset_0_-2px_2px_rgba(0,0,0,0.1)] transition-transform duration-200 ease-in-out z-10",
            isPortuguese ? "translate-x-[20px]" : "translate-x-[2px]"
          )}
        >
          {/* Active flag in the circle */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <img
              src={isPortuguese ? "https://flagcdn.com/w40/br.png" : "https://flagcdn.com/w40/us.png"}
              srcSet={isPortuguese ? "https://flagcdn.com/w80/br.png 2x" : "https://flagcdn.com/w80/us.png 2x"}
              alt={isPortuguese ? "Brazil" : "USA"}
              className={clsx(
                "w-full h-full rounded-full object-cover",
                !isPortuguese && "object-[20%_center] scale-[1.15]"
              )}
            />
          </div>
        </span>
      </button>

      {/* PT Label */}
      <span
        onClick={() => setLanguage('pt')}
        className={clsx(
          "text-sm font-bold transition-colors duration-200 cursor-pointer",
          isPortuguese ? "text-white" : "text-gray-500 hover:text-gray-300"
        )}
      >
        PT
      </span>
    </div>
  );
}