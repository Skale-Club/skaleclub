import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';

const MASKED_KEY = '********';

interface ResendSettings {
  enabled: boolean;
  apiKey: string;
  fromName: string;
  fromEmail: string;
  toEmails: string[];
}

const isValidEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

export function ResendSection() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ResendSettings>({
    queryKey: ['/api/integrations/email'],
  });

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled ?? false);
      setApiKey(data.apiKey || '');
      setFromName(data.fromName || '');
      setFromEmail(data.fromEmail || '');
      setToEmails(Array.isArray(data.toEmails) ? data.toEmails : []);
    }
  }, [data]);

  const persist = async (overrides?: Partial<ResendSettings>, successTitle?: string) => {
    const payload = {
      enabled,
      fromName,
      fromEmail,
      toEmails,
      ...overrides,
      apiKey: apiKey && apiKey !== MASKED_KEY ? apiKey : undefined,
    };
    setIsSaving(true);
    try {
      const res = await apiRequest('PUT', '/api/integrations/email', payload);
      const saved: ResendSettings = await res.json();
      setEnabled(saved.enabled ?? false);
      setApiKey(saved.apiKey || '');
      setFromName(saved.fromName || '');
      setFromEmail(saved.fromEmail || '');
      setToEmails(Array.isArray(saved.toEmails) ? saved.toEmails : []);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/email'] });
      if (successTitle) toast({ title: successTitle });
      return true;
    } catch (error: any) {
      toast({ title: 'Failed to save Resend settings', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const addRecipient = () => {
    const email = newRecipient.trim();
    if (!isValidEmail(email) || toEmails.includes(email)) {
      setNewRecipient('');
      return;
    }
    const updated = [...toEmails, email];
    setToEmails(updated);
    setNewRecipient('');
    void persist({ toEmails: updated });
  };

  const removeRecipient = (email: string) => {
    const updated = toEmails.filter((e) => e !== email);
    setToEmails(updated);
    void persist({ toEmails: updated });
  };

  const handleToggleEnabled = async (checked: boolean) => {
    if (checked && (!apiKey || !fromEmail || toEmails.length === 0)) {
      toast({
        title: 'Missing fields',
        description: 'Add an API key, a From email and at least one recipient before enabling.',
        variant: 'destructive',
      });
      return;
    }
    setEnabled(checked);
    const ok = await persist({ enabled: checked }, checked ? 'Resend enabled' : 'Resend disabled');
    if (!ok) setEnabled(!checked);
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult('idle');
    setTestMessage(null);
    try {
      const response = await fetch('/api/integrations/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          apiKey: apiKey && apiKey !== MASKED_KEY ? apiKey : undefined,
          fromName,
          fromEmail,
          toEmails,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setTestResult('success');
        setTestMessage('Test email sent successfully. Check your inbox.');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/email'] });
        toast({ title: 'Test email sent' });
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

  if (isLoading) {
    return <div className="flex w-full justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <Card className="rounded-2xl shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Resend Email</CardTitle>
              <p className="text-sm text-muted-foreground">Send email notifications for new leads and contacts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Label className="text-sm">{enabled ? 'Enabled' : 'Disabled'}</Label>
            <Switch checked={enabled} onCheckedChange={handleToggleEnabled} disabled={isSaving} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="resend-api-key">API Key</Label>
            <Input
              id="resend-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onBlur={() => apiKey && apiKey !== MASKED_KEY && void persist()}
              placeholder="re_..."
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resend-from-name">From Name</Label>
            <Input
              id="resend-from-name"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              onBlur={() => void persist()}
              placeholder="Skale Club"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="resend-from-email">From Email</Label>
            <Input
              id="resend-from-email"
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              onBlur={() => void persist()}
              placeholder="info@yourdomain.com"
            />
            <p className="text-xs text-muted-foreground">Verified email in your Resend account</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="resend-to-email">To Emails</Label>
            <div className="flex gap-2">
              <Input
                id="resend-to-email"
                type="email"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRecipient(); } }}
                placeholder="admin@yourcompany.com"
              />
              <Button type="button" variant="outline" onClick={addRecipient} disabled={!isValidEmail(newRecipient)}>
                + Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Email addresses to receive notifications</p>
            {toEmails.length > 0 && (
              <div className="flex flex-col gap-2 pt-1">
                {toEmails.map((email) => (
                  <div key={email} className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5">
                    <span className="flex-1 truncate text-sm">{email}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRecipient(email)}
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t pt-4">
          <Button
            variant="outline"
            onClick={testConnection}
            disabled={isTesting || !apiKey || !fromEmail || toEmails.length === 0}
          >
            {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Send Test Email
          </Button>
        </div>

        {testMessage && (
          <div className={`p-3 rounded-lg text-sm border ${
            testResult === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
          }`}>
            {testMessage}
          </div>
        )}

        {enabled && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Check className="w-4 h-4" />
              <span className="font-medium text-sm">Resend is enabled</span>
            </div>
            <p className="text-xs text-green-600 dark:text-green-500 mt-1">
              You'll receive email notifications when new leads or contacts are submitted
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
