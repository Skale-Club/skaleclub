import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Check, Zap } from 'lucide-react';
import { AdminCard } from '../shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { PreviewDraftDialog } from './PreviewDraftDialog';
import { OpenRouterModelPicker, type OpenRouterModelsResponse } from './OpenRouterModelPicker';
import type { BlogSettings, BlogGenerationJob } from '@shared/schema';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  failed:    { label: 'Failed',    className: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  skipped:   { label: 'Skipped',   className: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
  running:   { label: 'Running',   className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  pending:   { label: 'Pending',   className: 'bg-muted text-muted-foreground' },
};

interface BlogHealth {
  openrouterKeyConfigured: boolean;
  textModelConfigured: boolean;
  imageModelConfigured: boolean;
  configured: boolean;
}

export function BlogAutomationPanel() {
  const { toast } = useToast();
  const [isSaved, setIsSaved] = useState(false);
  const [formDraft, setFormDraft] = useState({
    enabled: false,
    postsPerDay: 0,
    seoKeywords: '',
    enableTrendAnalysis: false,
    promptStyle: '',
    systemPrompt: '',
    autoApprove: false,
    openrouterTextModel: '',
    openrouterImageModel: '',
  });

  const { data: settings } = useQuery<BlogSettings>({
    queryKey: ['/api/blog/settings'],
  });

  const { data: latestJob } = useQuery<BlogGenerationJob | null>({
    queryKey: ['/api/blog/jobs/latest'],
  });

  const { data: health } = useQuery<BlogHealth>({
    queryKey: ['/api/blog/health'],
    staleTime: 30_000,
  });

  const { data: modelsData, isLoading: isLoadingModels } = useQuery<OpenRouterModelsResponse>({
    queryKey: ['/api/integrations/openrouter/models'],
  });

  useEffect(() => {
    if (settings) {
      setFormDraft({
        enabled: settings.enabled,
        postsPerDay: settings.postsPerDay,
        seoKeywords: settings.seoKeywords ?? '',
        enableTrendAnalysis: settings.enableTrendAnalysis,
        promptStyle: settings.promptStyle ?? '',
        systemPrompt: settings.systemPrompt ?? '',
        autoApprove: settings.autoApprove ?? false,
        openrouterTextModel: settings.openrouterTextModel ?? '',
        openrouterImageModel: settings.openrouterImageModel ?? '',
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: typeof formDraft) =>
      apiRequest('PUT', '/api/blog/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/blog/health'] });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    },
    onError: (err: any) => {
      toast({ title: 'Error saving settings', description: err.message, variant: 'destructive' });
    },
  });

  // Phase 37 D-17: "Generate Now" opens PreviewDraftDialog instead of immediately committing.
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const allModels = modelsData?.models ?? [];
  // Only image-capable models belong in the image picker; fall back to the
  // full list if the catalog did not report modalities (stale cache/fallback).
  const imageModels = allModels.filter((m) => m.outputModalities?.includes('image'));
  const hasKey = health?.openrouterKeyConfigured ?? false;
  const canEnable = hasKey
    && formDraft.openrouterTextModel.trim().length > 0
    && formDraft.openrouterImageModel.trim().length > 0;

  return (
    <AdminCard>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Blog Automation</h2>
            <p className="text-sm text-muted-foreground">Configure automatic blog post generation powered by OpenRouter.</p>
          </div>
          <Button
            onClick={() => setIsPreviewOpen(true)}
            variant="outline"
            data-testid="button-generate-now"
          >
            <Zap className="w-4 h-4 mr-2" />
            Generate Now
          </Button>
        </div>

        {/* Status bar */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground border rounded-lg px-4 py-2.5 bg-muted/30">
          {settings?.lastRunAt ? (
            <span>Last generated: {formatDistanceToNow(new Date(settings.lastRunAt), { addSuffix: true })}</span>
          ) : (
            <span>Never generated</span>
          )}
          {latestJob && (
            <>
              <span className="text-border">·</span>
              <span>Last job:</span>
              <span className={clsx('rounded-full px-2 py-0.5 font-medium', STATUS_BADGE[latestJob.status]?.className)}>
                {STATUS_BADGE[latestJob.status]?.label ?? latestJob.status}
              </span>
              {latestJob.startedAt && (
                <span>{formatDistanceToNow(new Date(latestJob.startedAt), { addSuffix: true })}</span>
              )}
            </>
          )}
        </div>

        {/* Settings form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate(formDraft);
          }}
          className="space-y-5"
        >
          {/* AI provider configuration (autopost port) */}
          <div className="space-y-4 p-4 border rounded-lg bg-card">
            <div>
              <Label className="text-base">AI Provider (OpenRouter)</Label>
              <p className="text-xs text-muted-foreground">
                The API key lives in{' '}
                <a href="/admin?section=integrations" className="underline hover:text-foreground">
                  Integrations → AI Assistant → OpenRouter
                </a>
                . Pick here which models write the posts and generate the cover images.
              </p>
            </div>
            {!hasKey && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  No OpenRouter API key configured. Add one in Integrations before enabling automation.
                </span>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Text Model</Label>
                <OpenRouterModelPicker
                  value={formDraft.openrouterTextModel}
                  onChange={(id) => setFormDraft(prev => ({ ...prev, openrouterTextModel: id }))}
                  models={allModels}
                  isLoading={isLoadingModels}
                  placeholder="Select a text model..."
                  testId="select-blog-text-model"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Image Model</Label>
                <OpenRouterModelPicker
                  value={formDraft.openrouterImageModel}
                  onChange={(id) => setFormDraft(prev => ({ ...prev, openrouterImageModel: id }))}
                  models={imageModels.length > 0 ? imageModels : allModels}
                  isLoading={isLoadingModels}
                  placeholder="Select an image model..."
                  testId="select-blog-image-model"
                />
                <p className="text-xs text-muted-foreground">Only image-capable models are listed.</p>
              </div>
            </div>
          </div>

          {/* enabled toggle — gated on key + models */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Automation</Label>
              <p className="text-xs text-muted-foreground">
                {canEnable
                  ? 'Automatically generate blog posts on the configured schedule'
                  : 'Configure the OpenRouter key and both models to enable automation'}
              </p>
            </div>
            <Switch
              checked={formDraft.enabled}
              disabled={!canEnable && !formDraft.enabled}
              onCheckedChange={(checked) => setFormDraft(prev => ({ ...prev, enabled: checked }))}
              data-testid="switch-blog-automation-enabled"
            />
          </div>

          {/* autoApprove toggle (autopost port) */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
            <div className="space-y-0.5">
              <Label className="text-base">Auto-approve posts</Label>
              <p className="text-xs text-muted-foreground">
                On: generated posts are published immediately. Off: they wait in the approval queue below, and every approve/reject teaches the generator.
              </p>
            </div>
            <Switch
              checked={formDraft.autoApprove}
              onCheckedChange={(checked) => setFormDraft(prev => ({ ...prev, autoApprove: checked }))}
              data-testid="switch-blog-auto-approve"
            />
          </div>

          {/* postsPerDay select */}
          <div className="space-y-1.5">
            <Label>Posts Per Day</Label>
            <Select
              value={String(formDraft.postsPerDay)}
              onValueChange={(v) => setFormDraft(prev => ({ ...prev, postsPerDay: Number(v) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 — disabled</SelectItem>
                <SelectItem value="1">1 post / day</SelectItem>
                <SelectItem value="2">2 posts / day</SelectItem>
                <SelectItem value="3">3 posts / day</SelectItem>
                <SelectItem value="4">4 posts / day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* systemPrompt textarea (autopost port) */}
          <div className="space-y-1.5">
            <Label>System Prompt (editorial guide)</Label>
            <Textarea
              placeholder="e.g. Você é o redator do blog da Skale Club. Escreva para donos de negócios B2B no Brasil, tom direto e orientado a dados..."
              value={formDraft.systemPrompt}
              onChange={(e) => setFormDraft(prev => ({ ...prev, systemPrompt: e.target.value }))}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Injected into every generation as the editorial voice. Leave empty to use the built-in Skale Club voice.
            </p>
          </div>

          {/* seoKeywords textarea */}
          <div className="space-y-1.5">
            <Label>SEO Keywords</Label>
            <Textarea
              placeholder="e.g. field sales, CRM, B2B outreach"
              value={formDraft.seoKeywords}
              onChange={(e) => setFormDraft(prev => ({ ...prev, seoKeywords: e.target.value }))}
              rows={3}
            />
          </div>

          {/* enableTrendAnalysis toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Trend Analysis</Label>
              <p className="text-xs text-muted-foreground">Use current market trends to inform topic selection</p>
            </div>
            <Switch
              checked={formDraft.enableTrendAnalysis}
              onCheckedChange={(checked) => setFormDraft(prev => ({ ...prev, enableTrendAnalysis: checked }))}
            />
          </div>

          {/* promptStyle textarea */}
          <div className="space-y-1.5">
            <Label>Prompt Style</Label>
            <Textarea
              placeholder="e.g. Professional, data-driven tone targeting sales managers"
              value={formDraft.promptStyle}
              onChange={(e) => setFormDraft(prev => ({ ...prev, promptStyle: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              className={isSaved ? 'bg-green-600 hover:bg-green-600' : ''}
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isSaved && <Check className="w-4 h-4 mr-2" />}
              {isSaved ? 'Saved' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </div>
      <PreviewDraftDialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen} />
    </AdminCard>
  );
}
