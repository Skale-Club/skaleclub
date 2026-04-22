import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Eye } from 'lucide-react';
import { AdminCard } from '@/components/admin/shared';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { usePagePaths } from '@/lib/pagePaths';

export function LivePreview() {
  const { t } = useTranslation();
  const pagePaths = usePagePaths();
  // Subscribe to the same query that LinksSection writes to — dataUpdatedAt bumps after each save.
  const { dataUpdatedAt } = useQuery({ queryKey: ['/api/company-settings'] });
  const [manualBust, setManualBust] = useState<number>(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const src = `${pagePaths.links}?t=${dataUpdatedAt || 0}&r=${manualBust}`;

  const reload = () => {
    setManualBust(Date.now());
    // Belt-and-suspenders: also nudge the iframe directly for the edge case where src key doesn't change.
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.location.reload();
      } catch {
        // cross-origin safety net — harmless to swallow; src key change will still trigger reload.
      }
    }
  };

  return (
    <AdminCard padding="default" className="h-full flex flex-col min-h-[400px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4" />
          <h3 className="text-lg font-semibold">{t('Live Preview')}</h3>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={reload}
          className="flex items-center gap-2"
          aria-label={t('Refresh preview')}
        >
          <RefreshCw className="w-4 h-4" />
          {t('Refresh')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t('Updates automatically after each save. Click Refresh to force reload.')}
      </p>
      <div className="flex-1 overflow-hidden rounded-2xl bg-[#0f1014] shadow-lg min-h-[400px]">
        <iframe
          ref={iframeRef}
          src={src}
          title={t('Live Preview')}
          className="w-full h-full border-0 bg-[#0f1014]"
          loading="lazy"
        />
      </div>
    </AdminCard>
  );
}
