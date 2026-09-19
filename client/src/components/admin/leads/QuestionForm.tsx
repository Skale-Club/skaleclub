import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ExternalLink,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from '@/components/ui/loader';
import type { FormOption, FormQuestion } from '@shared/schema';

// `fileUpload` defaults, used when a question carries no limits yet. They match
// what the public upload route accepts — SVG is excluded on purpose there.
const DEFAULT_UPLOAD_EXTENSIONS = 'png, jpg, jpeg, webp, pdf';
const DEFAULT_UPLOAD_MAX_MB = '3';

type NoteMode = 'always' | 'equals' | 'notEquals';

const uploadExtensionsOf = (q: FormQuestion | null) =>
  q?.upload?.extensions?.join(', ') || DEFAULT_UPLOAD_EXTENSIONS;
const uploadMaxSizeOf = (q: FormQuestion | null) =>
  q?.upload?.maxSizeMb ? String(q.upload.maxSizeMb) : DEFAULT_UPLOAD_MAX_MB;
const noteModeOf = (q: FormQuestion | null): NoteMode => {
  if (q?.note?.when?.equals !== undefined) return 'equals';
  if (q?.note?.when?.notEquals !== undefined) return 'notEquals';
  return 'always';
};

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
  const [conditionalType, setConditionalType] = useState<Exclude<FormQuestion['type'], 'select'>>(question?.conditionalField?.type || 'text');
  const [ghlFieldId, setGhlFieldId] = useState(question?.ghlFieldId || '');
  const [uploadExtensions, setUploadExtensions] = useState(uploadExtensionsOf(question));
  const [uploadMaxSizeMb, setUploadMaxSizeMb] = useState(uploadMaxSizeOf(question));
  const [noteText, setNoteText] = useState(question?.note?.text || '');
  const [noteMode, setNoteMode] = useState<NoteMode>(noteModeOf(question));
  const [noteQuestionId, setNoteQuestionId] = useState(question?.note?.when?.questionId || '');
  const [noteValue, setNoteValue] = useState(question?.note?.when?.equals ?? question?.note?.when?.notEquals ?? '');

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
    setConditionalType(question?.conditionalField?.type || 'text');
    setGhlFieldId(question?.ghlFieldId || '');
    setUploadExtensions(uploadExtensionsOf(question));
    setUploadMaxSizeMb(uploadMaxSizeOf(question));
    setNoteText(question?.note?.text || '');
    setNoteMode(noteModeOf(question));
    setNoteQuestionId(question?.note?.when?.questionId || '');
    setNoteValue(question?.note?.when?.equals ?? question?.note?.when?.notEquals ?? '');
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
    const validOptions = options.filter(o => o.label && o.value);
    if (type === 'select' && validOptions.length === 0) {
      window.alert('Multiple choice questions need at least one option.');
      return;
    }

    const parsedExtensions = uploadExtensions
      .split(',')
      .map((ext) => ext.trim().replace(/^\./, '').toLowerCase())
      .filter(Boolean);
    if (type === 'fileUpload' && parsedExtensions.length === 0) {
      window.alert('File upload questions need at least one allowed extension.');
      return;
    }

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
      // Carry over whatever this editor does not expose (`upload` limits, a
      // `note` disclaimer, the `conditionalFields` array form). Without the
      // spread, editing a seeded question here would silently strip them — and
      // a `fileUpload` question with no `upload` config rejects every file.
      // Keys set below still win, so clearing a field keeps working.
      ...(question ?? {}),
      id: finalId,
      order: isEditing ? order : nextOrder,
      title,
      type,
      required,
      placeholder: placeholder || undefined,
      options: type === 'select' ? validOptions : undefined,
      conditionalField: hasConditional && conditionalShowWhen ? {
        showWhen: conditionalShowWhen,
        id: generatedConditionalId,
        title: conditionalTitle,
        placeholder: conditionalPlaceholder,
        type: conditionalType,
      } : undefined,
      ghlFieldId: ghlFieldId || undefined,
      upload: type === 'fileUpload'
        ? { extensions: parsedExtensions, maxSizeMb: Number(uploadMaxSizeMb) || Number(DEFAULT_UPLOAD_MAX_MB) }
        : undefined,
      note: noteText.trim() ? {
        text: noteText.trim(),
        when: noteMode === 'always' || !noteQuestionId.trim() ? undefined : {
          questionId: noteQuestionId.trim(),
          ...(noteMode === 'equals' ? { equals: noteValue } : { notEquals: noteValue }),
        },
      } : undefined,
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
                <SelectItem value="textarea">Long text</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="tel">Phone</SelectItem>
                <SelectItem value="select">Multiple choice</SelectItem>
                <SelectItem value="voice">Voice note</SelectItem>
                <SelectItem value="phoneCountry">Phone + country</SelectItem>
                <SelectItem value="productPicker">Product picker</SelectItem>
                <SelectItem value="quantitySlider">Quantity slider</SelectItem>
                <SelectItem value="fileUpload">File upload</SelectItem>
              </SelectContent>
            </Select>
            {(type === 'productPicker' || type === 'quantitySlider') && (
              <p className="text-xs text-muted-foreground">
                Options, range and prices come from the catalogue in code
                (shared/nfc-pricing.ts), not from this form.
              </p>
            )}
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

        {type === 'fileUpload' && (
          <div className="grid grid-cols-2 gap-4 p-3 rounded-lg border bg-muted/40">
            <div className="space-y-2">
              <Label htmlFor="upload-extensions">Allowed extensions</Label>
              <Input
                id="upload-extensions"
                value={uploadExtensions}
                onChange={(e) => setUploadExtensions(e.target.value)}
                placeholder={DEFAULT_UPLOAD_EXTENSIONS}
              />
              <p className="text-xs text-muted-foreground">
                Comma separated. The upload route enforces this list and never accepts SVG.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-max-size">Max size (MB)</Label>
              <Input
                id="upload-max-size"
                type="number"
                min={1}
                max={3}
                value={uploadMaxSizeMb}
                onChange={(e) => setUploadMaxSizeMb(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                3 MB is the ceiling — above it the request exceeds the public body limit.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2 p-3 rounded-lg border bg-muted/40">
          <Label htmlFor="question-note">Disclaimer (optional)</Label>
          <Textarea
            id="question-note"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="e.g. First order includes a one-time $50 art fee."
            rows={2}
          />
          {noteText.trim() && (
            <div className="grid grid-cols-3 gap-2">
              <Select value={noteMode} onValueChange={(v) => setNoteMode(v as NoteMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">Always show</SelectItem>
                  <SelectItem value="equals">Show when answer is</SelectItem>
                  <SelectItem value="notEquals">Show unless answer is</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={noteQuestionId}
                onChange={(e) => setNoteQuestionId(e.target.value)}
                placeholder="question id"
                disabled={noteMode === 'always'}
              />
              <Input
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                placeholder="option value"
                disabled={noteMode === 'always'}
              />
            </div>
          )}
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
                    <Label className="text-sm font-semibold">Additional field type</Label>
                    <Select value={conditionalType} onValueChange={(value) => setConditionalType(value as Exclude<FormQuestion['type'], 'select'>)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Free text</SelectItem>
                        <SelectItem value="textarea">Long text</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="tel">Phone</SelectItem>
                        <SelectItem value="voice">Voice note</SelectItem>
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

