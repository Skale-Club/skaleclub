import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Star, StarOff } from 'lucide-react';
import { SectionHeader } from '../shared';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import { FormEditorContent } from '../leads/FormEditorContent';
import { EditableFormHeader } from './EditableFormHeader';
import type { FormRow } from './formsTypes';

export function FormEditorView({ formId, onBack }: { formId: number; onBack: () => void }) {
  const { toast } = useToast();

  const { data: form, isLoading } = useQuery<FormRow>({
    queryKey: [`/api/forms/${formId}`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/forms/${formId}`);
      return res.json();
    },
  });

  const updateMetaMutation = useMutation({
    mutationFn: async (updates: { name?: string; description?: string | null }) => {
      const res = await apiRequest('PUT', `/api/forms/${formId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${formId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/forms/${formId}/set-default`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${formId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
      toast({ title: 'This form is now the default.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to set default', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Form not found" icon={<ClipboardList className="w-5 h-5" />} />
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to forms
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EditableFormHeader
        form={form}
        onSave={(updates) => updateMetaMutation.mutate(updates)}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              All forms
            </Button>
            {form.isDefault ? (
              <Button size="sm" variant="ghost" disabled>
                <Star className="w-4 h-4 mr-2 fill-current" />
                Default
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDefaultMutation.mutate()}
                disabled={setDefaultMutation.isPending}
              >
                <StarOff className="w-4 h-4 mr-2" />
                Set as default
              </Button>
            )}
          </div>
        }
      />

      <FormEditorContent formId={formId} />
    </div>
  );
}
