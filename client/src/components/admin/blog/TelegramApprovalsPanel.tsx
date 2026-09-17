// Telegram blog approvals — autoblog-parity SC-07 / SC-11.
//
// Approve or reject a draft from the chat the card lands in, including a group
// and a single forum topic inside one ("<chat_id>:<thread_id>").
//
// The approvals bot is deliberately allowed to differ from the alert bot: it is
// the one exposed to a public webhook, so it should be revocable on its own.
// Leaving both fields empty inherits the Telegram integration's bot and chats.
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, RefreshCw, Send } from 'lucide-react';
import { AdminCard } from '../shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

/** Matches the server: "keep the stored token", as opposed to clearing it. */
const TOKEN_SENTINEL = '********';

interface TelegramApprovalsStatus {
  integrationConfigured: boolean;
  approvalsEnabled: boolean;
  hasApprovalsBotToken: boolean;
  approvalsChatIds: string[];
  /** What a card would actually be sent to, after the fallback to the alert list. */
  effectiveChatIds: string[];
  webhookConfigured: boolean;
  webhookUrl: string | null;
}

export function TelegramApprovalsPanel() {
  const { toast } = useToast();
  const [chatIdsText, setChatIdsText] = useState('');
  const [botToken, setBotToken] = useState('');

  const { data: status } = useQuery<TelegramApprovalsStatus>({
    queryKey: ['/api/blog/telegram'],
  });

  useEffect(() => {
    if (status) setChatIdsText((status.approvalsChatIds ?? []).join('\n'));
  }, [status]);

  const saveMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const chatIds = chatIdsText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      return apiRequest('PUT', '/api/blog/telegram', {
        enabled,
        // An untouched field must not clear a stored token, and an empty one
        // must: the sentinel is what tells those two apart.
        botToken: botToken.trim() === '' ? TOKEN_SENTINEL : botToken.trim(),
        chatIds,
      });
    },
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog/telegram'] });
      setBotToken('');
      toast({
        title: enabled ? 'Telegram approvals enabled' : 'Telegram approvals disabled',
        description: enabled
          ? 'New drafts arrive in your chat with Approve and Reject buttons.'
          : 'The webhook was removed.',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Could not save', description: err.message, variant: 'destructive' });
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/blog/telegram/reconcile', {});
      return res.json() as Promise<{ reRegistered: boolean; previousError?: string | null }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog/telegram'] });
      toast({
        title: result.reRegistered ? 'Webhook re-registered' : 'Webhook is healthy',
        description: result.reRegistered
          ? `Telegram had a stale registration${result.previousError ? `: ${result.previousError}` : ''}.`
          : 'Telegram is pointing at the right URL.',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Reconcile failed', description: err.message, variant: 'destructive' });
    },
  });

  if (!status) return null;

  return (
    <AdminCard>
      <div className="space-y-5 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> Approve from Telegram
            </h2>
            <p className="text-sm text-muted-foreground">
              Send every new draft to a Telegram chat with Approve and Reject buttons, so a post can be published
              without opening the admin. Works in a group, and in a single topic of a group.
            </p>
          </div>
        </div>

        {!status.integrationConfigured ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Configure the Telegram integration (bot token and at least one chat) before enabling approvals.</span>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>Approval chats</Label>
              <Textarea
                placeholder={'-1001234567890\n-1001234567890:42'}
                value={chatIdsText}
                onChange={(e) => setChatIdsText(e.target.value)}
                rows={3}
                data-testid="textarea-telegram-approval-chats"
              />
              <p className="text-xs text-muted-foreground">
                One per line. Use <code>-100…</code> for a group, or <code>-100…:42</code> to post into one forum topic.
                Leave empty to reuse the chats from your Telegram integration.
                {status.effectiveChatIds.length > 0 && ` Cards currently go to: ${status.effectiveChatIds.join(', ')}.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Approvals bot token (optional)</Label>
              <Input
                type="password"
                placeholder={status.hasApprovalsBotToken ? '•••••••• (stored)' : 'Leave empty to use your alert bot'}
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                data-testid="input-telegram-approvals-token"
              />
              <p className="text-xs text-muted-foreground">
                A separate bot is recommended: this is the one exposed to a public webhook, so it can be revoked
                without touching your alert notifications.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                {status.approvalsEnabled
                  ? status.webhookConfigured
                    ? `Webhook registered${status.webhookUrl ? ` at ${status.webhookUrl}` : ''}.`
                    : 'Enabled, but no webhook is registered.'
                  : 'Approvals are off.'}
              </p>
              <div className="flex items-center gap-2">
                {status.approvalsEnabled && (
                  <>
                    {/* Telegram silently drops a webhook whose URL stops
                        resolving; the only symptom is buttons that stop
                        working, so checking has to be one click. */}
                    <Button
                      variant="ghost"
                      onClick={() => reconcileMutation.mutate()}
                      disabled={reconcileMutation.isPending}
                    >
                      {reconcileMutation.isPending
                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        : <RefreshCw className="w-4 h-4 mr-2" />}
                      Check webhook
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => saveMutation.mutate(false)}
                      disabled={saveMutation.isPending}
                    >
                      Disable
                    </Button>
                  </>
                )}
                <Button
                  onClick={() => saveMutation.mutate(true)}
                  disabled={saveMutation.isPending}
                  data-testid="button-telegram-approvals-save"
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {status.approvalsEnabled ? 'Save' : 'Enable approvals'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminCard>
  );
}
