import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Zap } from 'lucide-react';
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
import type { BlogSettings, BlogGenerationJob } from '@shared/schema';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  failed:    { label: 'Failed',    className: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  skipped:   { label: 'Skipped',   className: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
  running:   { label: 'Running',   className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  pending:   { label: 'Pending',   className: 'bg-muted text-muted-foreground' },
};

export function BlogAutomationPanel() {
  const { toast } = useToast();
  const [isSaved, setIsSaved] = useState(false);
  const [formDraft, setFormDraft] = useState({
    enabled: false,
    postsPerDay: 0,
    seoKeywords: '',
    enableTrendAnalysis: false,
    promptStyle: '',
  });

  const { data: settings } = useQuery<BlogSettings>({
    queryKey: ['/api/blog/settings'],
  });

  const { data: latestJob } = useQuery<BlogGenerationJob | null>({
    queryKey: ['/api/blog/jobs/latest'],
  });

  useEffect(() => {
    if (settings) {
      setFormDraft({
        enabled: settings.enabled,
        postsPerDay: settings.postsPerDay,
        seoKeywords: settings.seoKeywords ?? '',
        enableTrendAnalysis: settings.enableTrendAnalysis,
        promptStyle: settings.promptStyle ?? '',
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: typeof formDraft) =>
      apiRequest('PUT', '/api/blog/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog/settings'] });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    },
    onError: (err: any) => {
      toast({ title: 'Error saving settings', description: err.message, variant: 'destructive' });
    },
  });

  // Phase 37 D-17: "Generate Now" now opens PreviewDraftDialog instead of immediately committing.
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  return (
    <AdminCard>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Blog Automation</h2>
            <p className="text-sm text-muted-foreground">Configure automatic blog post generation powered by Gemini.</p>
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
          {/* enabled toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Automation</Label>
              <p className="text-xs text-muted-foreground">Automatically generate blog posts on the configured schedule</p>
            </div>
            <Switch
              checked={formDraft.enabled}
              onCheckedChange={(checked) => setFormDraft(prev => ({ ...prev, enabled: checked }))}
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
