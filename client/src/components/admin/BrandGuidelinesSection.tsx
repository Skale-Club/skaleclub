import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BookOpen, Save } from 'lucide-react';
import { AdminCard, SectionHeader } from './shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';

export function BrandGuidelinesSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [content, setContent] = useState('');

  const { data, isLoading } = useQuery<{ content: string }>({
    queryKey: ['/api/brand-guidelines'],
  });

  useEffect(() => {
    if (data?.content != null) {
      setContent(data.content);
    }
  }, [data?.content]);

  const saveMutation = useMutation({
    mutationFn: (text: string) =>
      apiRequest('PUT', '/api/brand-guidelines', { content: text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/brand-guidelines'] });
      toast({
        title: t('Brand guidelines saved'),
        description: t('Claude will use these guidelines when generating slides.'),
      });
    },
    onError: (err: any) => {
      toast({
        title: t('Save failed'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(content);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('Brand Guidelines')}
        description={t('Define your brand voice, colors, fonts, and rules for Claude to follow when building slides.')}
        icon={<BookOpen className="w-5 h-5" />}
      />

      <AdminCard>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand-guidelines-content">
              {t('Guidelines document')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('Write in Markdown. Describe logo usage, primary colors, fonts, tone of voice, and any "always include / never include" rules. Claude reads this before generating each presentation.')}
            </p>
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Textarea
                  id="brand-guidelines-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={20}
                  placeholder={t('## Brand Identity\n\n**Primary Color:** #1C53A3\n**Accent Color:** #FFFF01\n**Fonts:** Outfit (headings), Inter (body)\n\n## Tone of Voice\n\n- Professional yet approachable\n- Action-oriented language\n\n## Always Include\n- Company name: Skale Club\n\n## Never Include\n- Competitor mentions')}
                  className="font-mono text-sm resize-y min-h-[300px]"
                />
                <p className={`text-xs text-right ${content.length > 2000 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {content.length} / 2000
                </p>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || isLoading}
              className="gap-2"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t('Save guidelines')}
            </Button>
          </div>
        </div>
      </AdminCard>
    </div>
  );
}
