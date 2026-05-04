import { clsx } from "clsx";

export type LanguageSwitchValue = 'en' | 'pt';

interface LanguageSwitchProps {
  value: LanguageSwitchValue;
  onValueChange: (value: LanguageSwitchValue) => void;
  size?: 'sm' | 'md';
  className?: string;
}

const sizeClasses = {
  sm: {
    track: 'h-[26px] w-[44px]',
    knob: 'h-[22px] w-[22px]',
    knobEn: 'translate-x-[2px]',
    knobPt: 'translate-x-[20px]',
  },
  md: {
    track: 'h-[34px] w-[56px]',
    knob: 'h-[28px] w-[28px]',
    knobEn: 'translate-x-[3px]',
    knobPt: 'translate-x-[25px]',
  },
};

export function LanguageSwitch({
  value,
  onValueChange,
  size = 'sm',
  className,
}: LanguageSwitchProps) {
  const isPortuguese = value === 'pt';
  const sizes = sizeClasses[size];

  const toggleLanguage = () => {
    onValueChange(isPortuguese ? 'en' : 'pt');
  };

  return (
    <div className={clsx('inline-flex items-center select-none', className)}>
      <button
        type="button"
        onClick={toggleLanguage}
        className={clsx(
          'relative inline-flex items-center rounded-full bg-[#E5E7EB] shadow-[inset_-2px_2px_4px_rgba(0,0,0,0.25),inset_1px_-1px_2px_rgba(255,255,255,0.8)] transition-colors duration-200 focus:outline-none border-0',
          sizes.track,
        )}
        role="switch"
        aria-checked={isPortuguese}
        aria-label={`Switch to ${isPortuguese ? 'English' : 'Portuguese'}`}
      >
        <span
          className={clsx(
            'relative inline-block transform rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_2px_2px_rgba(255,255,255,1),inset_0_-2px_2px_rgba(0,0,0,0.1)] transition-transform duration-200 ease-in-out z-10',
            sizes.knob,
            isPortuguese ? sizes.knobPt : sizes.knobEn,
          )}
        >
          <span className="absolute inset-0 rounded-full overflow-hidden">
            <img
              src={isPortuguese ? '/flags/nucleo/br.svg' : '/flags/nucleo/us.svg'}
              alt={isPortuguese ? 'Brazil' : 'USA'}
              className="w-full h-full rounded-full object-cover scale-[1.4]"
            />
          </span>
        </span>
      </button>
    </div>
  );
}
