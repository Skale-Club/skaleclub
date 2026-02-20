import { useTranslation } from "@/hooks/useTranslation";
import { clsx } from "clsx";

export function MobileLanguageToggle() {
  const { language, setLanguage } = useTranslation();
  const isPortuguese = language === 'pt';

  const toggleLanguage = () => {
    setLanguage(isPortuguese ? 'en' : 'pt');
  };

  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center gap-4 select-none">
        {/* EN Label */}
        <span
          onClick={() => setLanguage('en')}
          className={clsx(
            "text-base font-bold transition-colors duration-200 cursor-pointer",
            !isPortuguese ? "text-slate-700" : "text-slate-400 hover:text-slate-600"
          )}
        >
          EN
        </span>

        {/* Toggle Switch */}
        <button
          onClick={toggleLanguage}
          className="relative inline-flex h-[34px] w-[56px] items-center rounded-full bg-[#E5E7EB] shadow-[inset_-2px_2px_4px_rgba(0,0,0,0.25),inset_1px_-1px_2px_rgba(255,255,255,0.8)] transition-colors duration-200 focus:outline-none border-0"
          role="switch"
          aria-checked={isPortuguese}
          aria-label={`Switch to ${isPortuguese ? 'English' : 'Portuguese'}`}
        >
          {/* Toggle Circle */}
          <span
            className={clsx(
              "relative inline-block h-[28px] w-[28px] transform rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_3px_3px_rgba(255,255,255,1),inset_0_-2px_2px_rgba(0,0,0,0.1)] transition-transform duration-200 ease-in-out z-10",
              isPortuguese ? "translate-x-[25px]" : "translate-x-[3px]"
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
            "text-base font-bold transition-colors duration-200 cursor-pointer",
            isPortuguese ? "text-slate-700" : "text-slate-400 hover:text-slate-600"
          )}
        >
          PT
        </span>
      </div>
    </div>
  );
}