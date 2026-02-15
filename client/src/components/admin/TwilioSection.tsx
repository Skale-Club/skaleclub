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
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const { data: twilioSettings, isLoading } = useQuery<TwilioSettings>({
    queryKey: ['/api/integrations/twilio']
  });

  const cleanPhone = useCallback((value: string) => value.replace(/[\s()-]/g, '').trim(), []);

  useEffect(() => {
    if (twilioSettings) {
      const recipients = (twilioSettings.toPhoneNumbers && twilioSettings.toPhoneNumbers.length)
        ? twilioSettings.toPhoneNumbers
        : twilioSettings.toPhoneNumber
          ? [twilioSettings.toPhoneNumber]
          : [];

      setSettings({
        ...twilioSettings,
        toPhoneNumbers: recipients,
        toPhoneNumber: recipients[0] || '',
      });
    }
  }, [twilioSettings]);

  const handleAddRecipient = () => {
    const cleaned = cleanPhone(newRecipient);
    if (!cleaned) return;
    if (settings.toPhoneNumbers.includes(cleaned)) {
      setNewRecipient('');
      return;
    }
    const updated = [...settings.toPhoneNumbers, cleaned];
    setSettings(prev => ({ ...prev, toPhoneNumbers: updated, toPhoneNumber: updated[0] || '' }));
    setNewRecipient('');
  };

  const handleRemoveRecipient = (value: string) => {
    const updated = settings.toPhoneNumbers.filter(num => num !== value);
    setSettings(prev => ({ ...prev, toPhoneNumbers: updated, toPhoneNumber: updated[0] || '' }));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const recipients = settings.toPhoneNumbers;
      await apiRequest('PUT', '/api/integrations/twilio', {
        ...settings,
        toPhoneNumbers: recipients,
        toPhoneNumber: recipients[0] || ''
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/twilio'] });
      toast({ title: 'Twilio settings saved successfully' });
    } catch (error: any) {
      toast({
        title: 'Failed to save Twilio settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult('idle');
    setTestMessage(null);
    try {
      const response = await fetch('/api/integrations/twilio/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid: settings.accountSid,
          authToken: settings.authToken,
          fromPhoneNumber: settings.fromPhoneNumber,
          toPhoneNumbers: settings.toPhoneNumbers,
          toPhoneNumber: settings.toPhoneNumber
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
    const recipients = settings.toPhoneNumbers;
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
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/integrations/twilio', newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/twilio'] });
      toast({ title: checked ? 'Twilio enabled' : 'Twilio disabled' });
    } catch (error: any) {
      toast({
        title: 'Failed to update settings',
        description: error.message,
        variant: 'destructive'
      });
      setSettings(prev => ({ ...prev, enabled: !checked }));
    } finally {
      setIsSaving(false);
    }
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
                placeholder="â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢â¬¢"
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
                value={settings.fromPhoneNumber}
                onChange={(e) => setSettings(prev => ({ ...prev, fromPhoneNumber: e.target.value }))}
                placeholder="+1234567890"
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
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  placeholder="+1234567890"
                  data-testid="input-twilio-to-phone"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddRecipient}
                  disabled={!newRecipient.trim()}
                >
                  + Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Phone numbers to receive notifications</p>
              {settings.toPhoneNumbers.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {settings.toPhoneNumbers.map((num) => (
                    <div
                      key={num}
                      className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-sm"
                    >
                      <span>{num}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRecipient(num)}
                        className="h-6 px-2"
                      >
                        Remove
                      </Button>
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
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notifyOnNewChat: checked as boolean }))}
              data-testid="checkbox-notify-new-chat"
            />
            <Label htmlFor="notify-new-chat" className="text-sm font-normal cursor-pointer">
              Send SMS when a new chat conversation starts
            </Label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              onClick={saveSettings}
              disabled={isSaving}
              data-testid="button-save-twilio"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
            <Button
              variant="outline"
              className={testButtonClass}
              onClick={testConnection}
              disabled={
                isTesting
                || !settings.accountSid
                || !settings.authToken
                || !settings.fromPhoneNumber
                || !(settings.toPhoneNumbers?.length)
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

