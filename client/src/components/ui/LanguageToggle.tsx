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
        className={clsx(
          "text-sm font-bold transition-colors duration-200",
          !isPortuguese ? "text-white" : "text-gray-400"
        )}
      >
        EN
      </span>

      {/* Toggle Switch */}
      <button
        onClick={toggleLanguage}
        className="relative inline-flex h-8 w-16 items-center rounded-full bg-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent"
        role="switch"
        aria-checked={isPortuguese}
        aria-label={`Switch to ${isPortuguese ? 'English' : 'Portuguese'}`}
      >
        {/* Background track with flag */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          {/* US Flag background (left side) */}
          <div 
            className={clsx(
              "absolute left-0 top-0 h-full w-1/2 transition-opacity duration-200",
              !isPortuguese ? "opacity-100" : "opacity-40"
            )}
          >
            <img 
              src="https://flagcdn.com/w40/us.png"
              srcSet="https://flagcdn.com/w80/us.png 2x"
              alt="USA"
              className="w-full h-full object-cover rounded-l-full"
            />
          </div>
          {/* Brazil Flag background (right side) */}
          <div 
            className={clsx(
              "absolute right-0 top-0 h-full w-1/2 transition-opacity duration-200",
              isPortuguese ? "opacity-100" : "opacity-40"
            )}
          >
            <img 
              src="https://flagcdn.com/w40/br.png"
              srcSet="https://flagcdn.com/w80/br.png 2x"
              alt="Brazil"
              className="w-full h-full object-cover rounded-r-full"
            />
          </div>
        </div>

        {/* Toggle Circle */}
        <span
          className={clsx(
            "relative inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
            isPortuguese ? "translate-x-9" : "translate-x-1"
          )}
        >
          {/* Active flag in the circle */}
          <div className="absolute inset-0.5 rounded-full overflow-hidden">
            <img 
              src={isPortuguese ? "https://flagcdn.com/w40/br.png" : "https://flagcdn.com/w40/us.png"}
              srcSet={isPortuguese ? "https://flagcdn.com/w80/br.png 2x" : "https://flagcdn.com/w80/us.png 2x"}
              alt={isPortuguese ? "Brazil" : "USA"}
              className="w-full h-full object-cover"
            />
          </div>
        </span>
      </button>

      {/* PT Label */}
      <span 
        className={clsx(
          "text-sm font-bold transition-colors duration-200",
          isPortuguese ? "text-white" : "text-gray-400"
        )}
      >
        PT
      </span>
    </div>
  );
}