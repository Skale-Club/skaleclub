import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Palette } from 'lucide-react';
import { AdminCard, FormGrid } from '@/components/admin/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { DEFAULT_LINKS_PAGE_THEME } from '@shared/links';
import type { LinksPageTheme } from '@shared/schema';

export interface ThemeEditorProps {
  theme: LinksPageTheme;
  onChange: (patch: Partial<LinksPageTheme>) => void;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const COLOR_INPUT_CLASS =
  "w-10 h-10 rounded-lg border border-border/60 bg-transparent p-0.5 cursor-pointer overflow-hidden " +
  "[&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 " +
  "[&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-0";

export function ThemeEditor({ theme, onChange }: ThemeEditorProps) {
  const { t } = useTranslation();

  const [primary, setPrimary] = useState<string>(
    theme.primaryColor ?? DEFAULT_LINKS_PAGE_THEME.primaryColor,
  );
  const [bg, setBg] = useState<string>(
    theme.backgroundColor ?? DEFAULT_LINKS_PAGE_THEME.backgroundColor,
  );
  const [gradient, setGradient] = useState<string>(theme.backgroundGradient ?? '');

  // Re-sync local state when upstream theme changes (after save/refetch).
  useEffect(() => {
    setPrimary(theme.primaryColor ?? DEFAULT_LINKS_PAGE_THEME.primaryColor);
    setBg(theme.backgroundColor ?? DEFAULT_LINKS_PAGE_THEME.backgroundColor);
    setGradient(theme.backgroundGradient ?? '');
  }, [theme.primaryColor, theme.backgroundColor, theme.backgroundGradient]);

  // Debounced upstream save (400ms). Each change replaces any pending save.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedule = (patch: Partial<LinksPageTheme>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onChange(patch), 400);
  };

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const handleReset = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setPrimary(DEFAULT_LINKS_PAGE_THEME.primaryColor);
    setBg(DEFAULT_LINKS_PAGE_THEME.backgroundColor);
    setGradient(DEFAULT_LINKS_PAGE_THEME.backgroundGradient);
    onChange({
      primaryColor: DEFAULT_LINKS_PAGE_THEME.primaryColor,
      backgroundColor: DEFAULT_LINKS_PAGE_THEME.backgroundColor,
      backgroundGradient: DEFAULT_LINKS_PAGE_THEME.backgroundGradient,
    });
  };

  return (
    <AdminCard>
      <div className="flex items-center gap-2 mb-4">
        <Palette className="w-4 h-4" />
        <div>
          <h3 className="text-lg font-semibold">{t('Theme')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('Colors and background for your links page')}
          </p>
        </div>
      </div>
      <FormGrid cols={1}>
        {/* Primary color */}
        <div className="space-y-2">
          <Label htmlFor="primaryColor">{t('Primary Color')}</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              id="primaryColor"
              value={primary}
              onChange={(e) => {
                setPrimary(e.target.value);
                schedule({ primaryColor: e.target.value });
              }}
              className={COLOR_INPUT_CLASS}
              aria-label={t('Primary Color')}
            />
            <Input
              value={primary}
              onChange={(e) => {
                const v = e.target.value;
                setPrimary(v);
                if (HEX_RE.test(v)) schedule({ primaryColor: v });
              }}
              placeholder="#1C53A3"
              className="font-mono flex-1"
            />
          </div>
        </div>

        {/* Background color */}
        <div className="space-y-2">
          <Label htmlFor="backgroundColor">{t('Background Color')}</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              id="backgroundColor"
              value={bg}
              onChange={(e) => {
                setBg(e.target.value);
                schedule({ backgroundColor: e.target.value });
              }}
              className={COLOR_INPUT_CLASS}
              aria-label={t('Background Color')}
            />
            <Input
              value={bg}
              onChange={(e) => {
                const v = e.target.value;
                setBg(v);
                if (HEX_RE.test(v)) schedule({ backgroundColor: v });
              }}
              placeholder="#0f1014"
              className="font-mono flex-1"
            />
          </div>
        </div>

        {/* Gradient */}
        <div className="space-y-2">
          <Label htmlFor="backgroundGradient">{t('Background Gradient (CSS)')}</Label>
          <Input
            id="backgroundGradient"
            value={gradient}
            onChange={(e) => {
              setGradient(e.target.value);
              schedule({ backgroundGradient: e.target.value });
            }}
            placeholder="linear-gradient(135deg, #1C53A3 0%, #0f1014 100%)"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            {t('Optional. If set, overrides background color on the public page.')}
          </p>
        </div>

        {/* Reset */}
        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            {t('Reset to defaults')}
          </Button>
        </div>
      </FormGrid>
    </AdminCard>
  );
}
