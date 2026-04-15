import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { FormOption, FormQuestion } from '@shared/schema';

export function QuestionForm({
  question,
  onSave,
  isLoading,
  nextOrder,
  existingIds,
}: {
  question: FormQuestion | null;
  onSave: (q: FormQuestion) => void;
  isLoading: boolean;
  nextOrder: number;
  existingIds: string[];
}) {
  const [id, setId] = useState(question?.id || '');
  const [title, setTitle] = useState(question?.title || '');
  const [type, setType] = useState<FormQuestion['type']>(question?.type || 'text');
  const [required, setRequired] = useState(question?.required ?? true);
  const [placeholder, setPlaceholder] = useState(question?.placeholder || '');
  const [order, setOrder] = useState(question?.order ?? nextOrder);
  const [options, setOptions] = useState<FormOption[]>(question?.options || []);
  const [hasConditional, setHasConditional] = useState(!!question?.conditionalField);
  const [conditionalShowWhen, setConditionalShowWhen] = useState(question?.conditionalField?.showWhen || '');
  const [conditionalTitle, setConditionalTitle] = useState(question?.conditionalField?.title || '');
  const [conditionalPlaceholder, setConditionalPlaceholder] = useState(question?.conditionalField?.placeholder || '');
  const [ghlFieldId, setGhlFieldId] = useState(question?.ghlFieldId || '');

  const { data: ghlStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/integrations/ghl/status'],
  });
  const { data: ghlFieldsData, isLoading: isLoadingGhlFields } = useQuery<{
    success: boolean;
    standardFields?: Array<{ id: string; name: string; fieldKey: string; dataType: string }>;
    customFields?: Array<{ id: string; name: string; fieldKey: string; dataType: string }>;
  }>({
    queryKey: ['/api/integrations/ghl/custom-fields'],
    enabled: ghlStatus?.enabled === true,
  });

  useEffect(() => {
    setId(question?.id || '');
    setTitle(question?.title || '');
    setType(question?.type || 'text');
    setRequired(question?.required ?? true);
    setPlaceholder(question?.placeholder || '');
    setOrder(question?.order ?? nextOrder);
    setOptions(question?.options || []);
    setHasConditional(!!question?.conditionalField);
    setConditionalShowWhen(question?.conditionalField?.showWhen || '');
    setConditionalTitle(question?.conditionalField?.title || '');
    setConditionalPlaceholder(question?.conditionalField?.placeholder || '');
    setGhlFieldId(question?.ghlFieldId || '');
  }, [question, nextOrder]);

  const isEditing = !!question;

  const handleAddOption = () => {
    setOptions([...options, { value: '', label: '', points: 0 }]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, field: keyof FormOption, value: string | number) => {
    const newOptions = [...options];
    if (field === 'points') {
      newOptions[index] = { ...newOptions[index], [field]: Number(value) };
    } else {
      newOptions[index] = { ...newOptions[index], [field]: value };
      if (field === 'label' && !newOptions[index].value) {
        newOptions[index].value = value as string;
      }
    }
    setOptions(newOptions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    let finalId = id;
    if (!isEditing) {
      finalId = title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .join('_');

      let counter = 1;
      let testId = finalId;
      while (existingIds.includes(testId)) {
        testId = `${finalId}${counter}`;
        counter++;
      }
      finalId = testId;
    }

    let generatedConditionalId = '';
    if (hasConditional && conditionalShowWhen) {
      generatedConditionalId = `${finalId}_${conditionalShowWhen.replace(/\s+/g, '').toLowerCase()}`;
    }

    const questionData: FormQuestion = {
      id: finalId,
      order: isEditing ? order : nextOrder,
      title,
      type,
      required,
      placeholder: placeholder || undefined,
      options: type === 'select' ? options.filter(o => o.label && o.value) : undefined,
      conditionalField: hasConditional && conditionalShowWhen ? {
        showWhen: conditionalShowWhen,
        id: generatedConditionalId,
        title: conditionalTitle,
        placeholder: conditionalPlaceholder,
      } : undefined,
      ghlFieldId: ghlFieldId || undefined,
    };

    onSave(questionData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Question' : 'New Question'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="question-title">Question Text</Label>
          <Textarea
            id="question-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. What is your full name?"
            required
            rows={2}
          />
          {!isEditing && title && (
            <p className="text-xs text-muted-foreground">
              ID will be: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                {title
                  .toLowerCase()
                  .replace(/[^a-z0-9\s]/g, '')
                  .trim()
                  .split(/\s+/)
                  .slice(0, 3)
                  .join('_') || 'your_id_here'}
              </code>
            </p>
          )}
          {isEditing && (
            <p className="text-xs text-muted-foreground">
              ID: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{id}</code> · Order: <strong>{order}</strong>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Answer Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FormQuestion['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Free text</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="tel">Phone</SelectItem>
                <SelectItem value="select">Multiple choice</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="question-placeholder">Placeholder</Label>
            <Input
              id="question-placeholder"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="Helper text"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="question-required" checked={required} onCheckedChange={(c) => setRequired(!!c)} />
          <Label htmlFor="question-required" className="text-sm">Required question</Label>
        </div>

        {ghlStatus?.enabled && (
          <div className="space-y-2 p-3 bg-purple-50/50 dark:bg-purple-950/30 rounded-lg border border-purple-200/50 dark:border-purple-900/50">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Link to GoHighLevel
            </Label>
            <Select value={ghlFieldId || "none"} onValueChange={(val) => setGhlFieldId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Don't link" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Don't link</SelectItem>
                {isLoadingGhlFields && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading fields...
                  </div>
                )}
                {ghlFieldsData?.standardFields && ghlFieldsData.standardFields.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">
                      Standard Fields
                    </div>
                    {ghlFieldsData.standardFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>
                    ))}
                  </>
                )}
                {ghlFieldsData?.customFields && ghlFieldsData.customFields.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">
                      Custom Fields
                    </div>
                    {ghlFieldsData.customFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>
                    ))}
                  </>
                )}
                {ghlFieldsData?.success && (!ghlFieldsData.customFields || ghlFieldsData.customFields.length === 0) && (!ghlFieldsData.standardFields || ghlFieldsData.standardFields.length === 0) && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No fields found in GHL
                  </div>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The value of this question will be sent to the selected GHL field
            </p>
          </div>
        )}

        {type === 'select' && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Answer Options</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddOption}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {options.length === 0 && (
              <p className="text-sm text-muted-foreground">No options. Click "Add" to create one.</p>
            )}
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-background rounded border">
                  <Input
                    value={option.label}
                    onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
                    placeholder="Label (visible text)"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={option.points}
                    onChange={(e) => handleOptionChange(index, 'points', e.target.value)}
                    placeholder="Pts"
                    className="w-20"
                    min={0}
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveOption(index)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="has-conditional" checked={hasConditional} onCheckedChange={(c) => setHasConditional(!!c)} />
                <Label htmlFor="has-conditional" className="text-sm font-semibold">Add conditional field</Label>
                <span className="text-xs text-muted-foreground">(appears only when a specific option is selected)</span>
              </div>
              {hasConditional && (
                <div className="space-y-3 p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-200/50 dark:border-blue-900/50">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Show this field when:</Label>
                    <p className="text-xs text-muted-foreground mb-2">Select which option above triggers the additional field</p>
                    <Select value={conditionalShowWhen} onValueChange={setConditionalShowWhen}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an option..." />
                      </SelectTrigger>
                      <SelectContent>
                        {options.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Add options above first</div>}
                        {options.filter(o => o.value).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label || opt.value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conditional-title" className="text-sm font-semibold">Additional field question</Label>
                    <Input
                      id="conditional-title"
                      value={conditionalTitle}
                      onChange={(e) => setConditionalTitle(e.target.value)}
                      placeholder="e.g., Please describe your business"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conditional-placeholder" className="text-sm font-semibold">Helper text (Placeholder)</Label>
                    <Input
                      id="conditional-placeholder"
                      value={conditionalPlaceholder}
                      onChange={(e) => setConditionalPlaceholder(e.target.value)}
                      placeholder="e.g. Enter your business type..."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditing ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}
