import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { SiTwilio } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { TwilioSettings } from './shared/types';
export function TwilioSection() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<TwilioSettings>({
    enabled: false,
    accountSid: '',
    authToken: '',
    fromPhoneNumber: '',
    toPhoneNumber: '',
    toPhoneNumbers: [],
    notifyOnNewChat: true
  });
  const [newRecipient, setNewRecipient] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const { data: twilioSettings, isLoading, error: twilioLoadError } = useQuery<TwilioSettings>({
    queryKey: ['/api/integrations/twilio']
  });

  const cleanPhone = useCallback((value: string) => value.replace(/[^\d+]/g, '').trim(), []);

  const extractUsDigits = useCallback((value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    return digits.startsWith('1') ? digits.slice(1, 11) : digits.slice(0, 10);
  }, []);

  const toUsE164 = useCallback((value: string) => {
    const usDigits = extractUsDigits(value);
    return usDigits.length === 10 ? `+1${usDigits}` : '';
  }, [extractUsDigits]);

  const formatUsPhone = useCallback((value: string) => {
    const usDigits = extractUsDigits(value);
    if (!usDigits) return '';
    if (usDigits.length <= 3) return `+1 (${usDigits}`;
    if (usDigits.length <= 6) return `+1 (${usDigits.slice(0, 3)}) ${usDigits.slice(3)}`;
    return `+1 (${usDigits.slice(0, 3)}) ${usDigits.slice(3, 6)}-${usDigits.slice(6, 10)}`;
  }, [extractUsDigits]);

  const isCompleteUsPhone = useCallback((value: string) => extractUsDigits(value).length === 10, [extractUsDigits]);

  const formatPhone = useCallback((value: string) => {
    const digits = value.replace(/[^\d+]/g, '');
    // US format: +1 (XXX) XXX-XXXX
    if (digits.startsWith('+1') && digits.length > 2) {
      const num = digits.slice(2);
      if (num.length <= 3) return `+1 (${num}`;
      if (num.length <= 6) return `+1 (${num.slice(0, 3)}) ${num.slice(3)}`;
      return `+1 (${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(6, 10)}`;
    }
    // BR format: +55 (XX) XXXXX-XXXX
    if (digits.startsWith('+55') && digits.length > 3) {
      const num = digits.slice(3);
      if (num.length <= 2) return `+55 (${num}`;
      if (num.length <= 7) return `+55 (${num.slice(0, 2)}) ${num.slice(2)}`;
      return `+55 (${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7, 11)}`;
    }
    return digits;
  }, []);

  useEffect(() => {
    if (twilioSettings) {
      const recipients = (twilioSettings.toPhoneNumbers && twilioSettings.toPhoneNumbers.length)
        ? twilioSettings.toPhoneNumbers
        : twilioSettings.toPhoneNumber
          ? [twilioSettings.toPhoneNumber]
          : [];

      const normalizedRecipients = recipients
        .map(num => toUsE164(String(num)))
        .filter(Boolean);

      setSettings({
        ...twilioSettings,
        toPhoneNumbers: normalizedRecipients,
        toPhoneNumber: normalizedRecipients[0] || '',
      });
    }
  }, [twilioSettings, toUsE164]);

  useEffect(() => {
    if (twilioLoadError) {
      toast({
        title: 'Failed to load Twilio settings',
        description: twilioLoadError instanceof Error ? twilioLoadError.message : 'Could not fetch settings',
        variant: 'destructive'
      });
    }
  }, [twilioLoadError, toast]);

  const resolveRecipients = useCallback((numbers: string[]) => {
    const pending = toUsE164(newRecipient);
    if (!pending || numbers.includes(pending)) return numbers;
    return [...numbers, pending];
  }, [newRecipient, toUsE164]);

  const persistSettings = useCallback(async (
    nextSettings: TwilioSettings,
    options?: { successTitle?: string }
  ) => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/integrations/twilio', {
        ...nextSettings,
        toPhoneNumbers: nextSettings.toPhoneNumbers,
        toPhoneNumber: nextSettings.toPhoneNumbers[0] || ''
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/twilio'] });
      if (options?.successTitle) {
        toast({ title: options.successTitle });
      }
    } catch (error: any) {
      toast({
        title: 'Failed to save Twilio settings',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  const handleAddRecipient = () => {
    const normalized = toUsE164(newRecipient);
    if (!normalized) return;
    if (settings.toPhoneNumbers.includes(normalized)) {
      setNewRecipient('');
      return;
    }
    const updated = [...settings.toPhoneNumbers, normalized];
    const nextSettings = { ...settings, toPhoneNumbers: updated, toPhoneNumber: updated[0] || '' };
    setSettings(nextSettings);
    setNewRecipient('');
    void persistSettings(nextSettings);
  };

  const handleRemoveRecipient = (value: string) => {
    const updated = settings.toPhoneNumbers.filter(num => num !== value);
    const nextSettings = { ...settings, toPhoneNumbers: updated, toPhoneNumber: updated[0] || '' };
    setSettings(nextSettings);
    void persistSettings(nextSettings);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(extractUsDigits(settings.toPhoneNumbers[index]));
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const normalized = toUsE164(editValue);
    if (!normalized) return;
    const updated = [...settings.toPhoneNumbers];
    updated[editingIndex] = normalized;
    const nextSettings = { ...settings, toPhoneNumbers: updated, toPhoneNumber: updated[0] || '' };
    setSettings(nextSettings);
    setEditingIndex(null);
    setEditValue('');
    void persistSettings(nextSettings);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult('idle');
    setTestMessage(null);
    try {
      const recipients = resolveRecipients(settings.toPhoneNumbers);
      const response = await fetch('/api/integrations/twilio/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid: settings.accountSid,
          authToken: settings.authToken,
          fromPhoneNumber: settings.fromPhoneNumber,
          toPhoneNumbers: recipients,
          toPhoneNumber: recipients[0] || ''
        }),
        credentials: 'include'
      });
      const result = await response.json();

      if (result.success) {
        setTestResult('success');
        setTestMessage('Test message sent successfully!');
        toast({ title: 'Test successful', description: 'Check your phone for the test message.' });
      } else {
        setTestResult('error');
        setTestMessage(result.message || 'Test failed');
        toast({
          title: 'Test failed',
          description: result.message || 'Could not send test message',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setTestResult('error');
      setTestMessage(error.message || 'Connection failed');
      toast({
        title: 'Test failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    if (checked && testResult !== 'success') {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling Twilio.',
        variant: 'destructive'
      });
      return;
    }
    const recipients = resolveRecipients(settings.toPhoneNumbers);
    if (checked && !recipients.length) {
      toast({
        title: 'Add at least one recipient',
        description: 'Include at least one To phone number before enabling Twilio.',
        variant: 'destructive'
      });
      return;
    }
    const newSettings = { ...settings, enabled: checked, toPhoneNumbers: recipients, toPhoneNumber: recipients[0] || '' };
    setSettings(newSettings);
    try {
      await persistSettings(newSettings, { successTitle: checked ? 'Twilio enabled' : 'Twilio disabled' });
    } catch (error: any) {
      setSettings(prev => ({ ...prev, enabled: !checked }));
    }
  };

  const handleNotifyOnNewChatChange = (checked: boolean) => {
    const nextSettings = { ...settings, notifyOnNewChat: checked };
    setSettings(nextSettings);
    void persistSettings(nextSettings);
  };

  const testButtonClass =
    testResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : testResult === 'error'
      ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
      : '';

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 bg-muted">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F22F46] dark:bg-[#F22F46] flex items-center justify-center">
                <SiTwilio className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Twilio SMS</CardTitle>
                <p className="text-sm text-muted-foreground">Get SMS notifications for new chat conversations</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <Label className="text-sm">
                {settings.enabled ? 'Enabled' : 'Disabled'}
              </Label>
              <Switch
                checked={settings.enabled}
                onCheckedChange={handleToggleEnabled}
                disabled={isSaving}
                data-testid="switch-twilio-enabled"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="twilio-account-sid">Account SID</Label>
              <Input
                id="twilio-account-sid"
                type="text"
                value={settings.accountSid}
                onChange={(e) => setSettings(prev => ({ ...prev, accountSid: e.target.value }))}
                onBlur={() => void persistSettings(settings)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                data-testid="input-twilio-account-sid"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-auth-token">Auth Token</Label>
              <Input
                id="twilio-auth-token"
                type="password"
                value={settings.authToken}
                onChange={(e) => setSettings(prev => ({ ...prev, authToken: e.target.value }))}
                onBlur={() => void persistSettings(settings)}
                placeholder="Your Twilio Auth Token"
                data-testid="input-twilio-auth-token"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="twilio-from-phone">From Phone Number</Label>
              <Input
                id="twilio-from-phone"
                type="tel"
                value={formatPhone(settings.fromPhoneNumber)}
                onChange={(e) => setSettings(prev => ({ ...prev, fromPhoneNumber: cleanPhone(e.target.value) }))}
                onBlur={() => void persistSettings(settings)}
                placeholder="+1 (555) 123-4567"
                data-testid="input-twilio-from-phone"
              />
              <p className="text-xs text-muted-foreground">
                Your Twilio phone number (with country code)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-to-phone">To Phone Numbers</Label>
              <div className="flex gap-2">
                <Input
                  id="twilio-to-phone"
                  type="tel"
                  value={formatUsPhone(newRecipient)}
                  onChange={(e) => setNewRecipient(extractUsDigits(e.target.value))}
                  placeholder="+1 (555) 123-4567"
                  data-testid="input-twilio-to-phone"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddRecipient}
                  disabled={!isCompleteUsPhone(newRecipient)}
                >
                  + Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Phone numbers to receive notifications</p>
              {settings.toPhoneNumbers.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  {settings.toPhoneNumbers.map((num, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2"
                    >
                      {editingIndex === index ? (
                        <>
                          <Input
                            type="tel"
                            value={formatUsPhone(editValue)}
                            onChange={(e) => setEditValue(extractUsDigits(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className="h-8 text-sm flex-1"
                            autoFocus
                          />
                          <Button type="button" variant="outline" size="sm" onClick={handleSaveEdit} className="h-8 px-2 text-xs">
                            Save
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit} className="h-8 px-2 text-xs">
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm">{formatUsPhone(num)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(index)}
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRecipient(num)}
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                          >
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="notify-new-chat"
              checked={settings.notifyOnNewChat}
              onCheckedChange={(checked) => handleNotifyOnNewChatChange(checked as boolean)}
              data-testid="checkbox-notify-new-chat"
            />
            <Label htmlFor="notify-new-chat" className="text-sm font-normal cursor-pointer">
              Send SMS when a new chat conversation starts
            </Label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              variant="outline"
              className={testButtonClass}
              onClick={testConnection}
              disabled={
                isTesting
                || !settings.accountSid
                || !settings.authToken
                || !settings.fromPhoneNumber
                || !(settings.toPhoneNumbers?.length || isCompleteUsPhone(newRecipient))
              }
              data-testid="button-test-twilio"
            >
              {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {testResult === 'success' ? 'Test OK' : testResult === 'error' ? 'Test Failed' : 'Send Test SMS'}
            </Button>
          </div>

          {testMessage && (
            <div className={`p-3 rounded-lg text-sm ${
              testResult === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
            }`}>
              {testMessage}
            </div>
          )}

          {settings.enabled && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Check className="w-4 h-4" />
                <span className="font-medium text-sm">Twilio is enabled</span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                You'll receive SMS notifications when new chat conversations start
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

