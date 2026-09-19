import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Send } from 'lucide-react';
import { SiTelegram } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';

const MASKED_TOKEN = '********';

type TelegramSettings = {
  enabled: boolean;
  botToken: string;
  chatId: string;
  chatIds: string[];
};

export function TelegramSection() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<TelegramSettings>({ enabled: false, botToken: '', chatId: '', chatIds: [] });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery<TelegramSettings>({ queryKey: ['/api/integrations/telegram'] });

  useEffect(() => {
    if (data) {
      setSettings({
        enabled: data.enabled,
        botToken: data.botToken || '',
        chatId: data.chatId || '',
        // The server is the source of truth for the list; a legacy row that only
        // has the single id still renders as one destination.
        chatIds: data.chatIds?.length ? data.chatIds : (data.chatId ? [data.chatId] : []),
      });
    }
  }, [data]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/integrations/telegram', {
        enabled: settings.enabled,
        botToken: settings.botToken !== MASKED_TOKEN ? settings.botToken : undefined,
        chatIds: settings.chatIds,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/telegram'] });
      toast({ title: 'Telegram settings saved' });
    } catch (error: any) {
      toast({ title: 'Failed to save Telegram settings', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult('idle');
    setTestMessage(null);
    try {
      const response = await fetch('/api/integrations/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: settings.botToken !== MASKED_TOKEN ? settings.botToken : undefined,
          chatIds: settings.chatIds,
          enabled: settings.enabled,
        }),
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        setTestResult('success');
        setTestMessage('Test message sent. Check your Telegram chat.');
      } else {
        setTestResult('error');
        setTestMessage(result.message || 'Test failed');
      }
    } catch (error: any) {
      setTestResult('error');
      setTestMessage(error.message || 'Connection failed');
    } finally {
      setIsTesting(false);
    }
  };

  const hasToken = settings.botToken && settings.botToken !== '';
  const hasChatId = settings.chatIds.length > 0;
  const canSave = hasToken && hasChatId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SiTelegram className="w-5 h-5 text-[#2CA5E0]" />
          Telegram
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings(s => ({ ...s, enabled: checked }))}
                id="telegram-enabled"
              />
              <Label htmlFor="telegram-enabled">Enable Telegram notifications</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telegram-token">Bot Token</Label>
              <Input
                id="telegram-token"
                type="password"
                placeholder="1234567890:ABCDEFabcdef..."
                value={settings.botToken}
                onChange={(e) => setSettings(s => ({ ...s, botToken: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">From @BotFather — format: {'{id}:{token}'}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telegram-chatid">Chat IDs</Label>
              <Input
                id="telegram-chatid"
                placeholder="-1001234567890, 987654321, -1001234567890:42"
                value={settings.chatIds.join(', ')}
                onChange={(e) => setSettings(s => ({
                  ...s,
                  chatIds: e.target.value.split(',').map(id => id.trim()).filter(Boolean),
                }))}
              />
              <p className="text-xs text-muted-foreground">
                One or more, comma-separated. A group or supergroup id works here — the bot
                has to be a member of it. For a forum topic, append the thread:{' '}
                <code>-1001234567890:42</code>. Use @userinfobot to find a chat ID.
              </p>
            </div>

            {testResult !== 'idle' && testMessage && (
              <div className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${
                testResult === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
              }`}>
                {testResult === 'success' && <Check className="w-4 h-4 shrink-0" />}
                {testMessage}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={!canSave || isSaving} className="flex-1">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save
              </Button>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={!canSave || !settings.enabled || isTesting}
              >
                {isTesting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                Test
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
