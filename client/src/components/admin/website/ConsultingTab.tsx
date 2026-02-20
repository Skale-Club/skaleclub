import { useCallback, useMemo } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { ArrowDown, ArrowUp, LayoutGrid, LineChart, List, PhoneCall, Plus, Search, Sparkles, Target, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import type { ConsultingStep, HomepageContent } from '@shared/schema';

const consultingIconOptions = [
  { label: 'Pesquisa', value: 'search', icon: Search },
  { label: 'Diferencial', value: 'sparkles', icon: Sparkles },
  { label: 'Layout', value: 'layout', icon: LayoutGrid },
  { label: 'Foco', value: 'target', icon: Target },
  { label: 'Atendimento', value: 'phone-call', icon: PhoneCall },
  { label: 'Resultados', value: 'line-chart', icon: LineChart },
];

interface ConsultingTabProps {
  homepageContent: HomepageContent;
  updateHomepageContent: (updater: (prev: HomepageContent) => HomepageContent, fieldKey?: string) => void;
  SavedIndicator: React.FC<{ field: string }>;
}

export function ConsultingTab({ homepageContent, updateHomepageContent, SavedIndicator }: ConsultingTabProps) {
  const updateConsultingSection = useCallback(
    (updater: (section: NonNullable<HomepageContent['consultingStepsSection']>) => NonNullable<HomepageContent['consultingStepsSection']>, fieldKey?: string) => {
      updateHomepageContent(prev => {
        const currentSection = {
          ...DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection,
          ...(prev.consultingStepsSection || {}),
        } as NonNullable<HomepageContent['consultingStepsSection']>;
        return { ...prev, consultingStepsSection: updater(currentSection) };
      }, fieldKey);
    },
    [updateHomepageContent]
  );

  const updateConsultingSteps = useCallback(
    (updater: (steps: ConsultingStep[]) => ConsultingStep[], fieldKey = 'homepageContent.consultingStepsSection.steps') => {
      updateConsultingSection(section => ({ ...section, steps: updater([...(section.steps || [])]) }), fieldKey);
    },
    [updateConsultingSection]
  );

  const consultingStepsSection = useMemo(() => {
    const base = { ...DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection, ...(homepageContent.consultingStepsSection || {}) };
    const steps = base.steps?.length ? base.steps : DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection?.steps || [];
    return { ...base, steps };
  }, [homepageContent.consultingStepsSection]);

  const consultingSteps = useMemo(
    () => [...(consultingStepsSection.steps || [])].sort((a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel)),
    [consultingStepsSection.steps]
  );

  const practicalBullets =
    consultingStepsSection.practicalBullets?.length && consultingStepsSection.practicalBullets.length > 0
      ? consultingStepsSection.practicalBullets
      : DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection?.practicalBullets || [];

  const handleMoveStep = useCallback(
    (index: number, direction: -1 | 1) => {
      updateConsultingSteps(steps => {
        const ordered = [...steps].sort((a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel));
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= ordered.length) return ordered;
        return arrayMove(ordered, index, targetIndex).map((step, idx) => ({ ...step, order: idx + 1 }));
      });
    },
    [updateConsultingSteps]
  );

  const handleAddStep = useCallback(() => {
    const nextOrder = (consultingStepsSection.steps?.length || 0) + 1;
    updateConsultingSteps(steps => [...steps, {
      order: nextOrder, numberLabel: String(nextOrder).padStart(2, '0'),
      icon: 'sparkles', title: 'New Stage', whatWeDo: '', outcome: '',
    }]);
  }, [consultingStepsSection.steps, updateConsultingSteps]);

  const handleDeleteStep = useCallback(
    (index: number) => {
      updateConsultingSteps(steps => {
        const ordered = [...steps].sort((a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel));
        return ordered.filter((_, i) => i !== index).map((step, idx) => ({ ...step, order: step.order ?? idx + 1 }));
      });
    },
    [updateConsultingSteps]
  );

  const handleStepChange = useCallback(
    (index: number, updater: (step: ConsultingStep) => ConsultingStep, fieldKey: string, resort = false) => {
      updateConsultingSteps(steps => {
        const ordered = [...steps].sort((a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel));
        if (!ordered[index]) return ordered;
        ordered[index] = updater(ordered[index]);
        return resort ? [...ordered].sort((a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel)) : ordered;
      }, fieldKey);
    },
    [updateConsultingSteps]
  );

  return (
    <div className="space-y-6">
      {/* Header + Toggle */}
      <div className="bg-white dark:bg-card rounded-lg border p-6 space-y-6 transition-all">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-primary" />
              Services - How It Works
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Step-by-step process displayed on the landing page.</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={consultingStepsSection.enabled ?? true}
              onCheckedChange={(checked) =>
                updateConsultingSection(section => ({ ...section, enabled: checked }), 'homepageContent.consultingStepsSection.enabled')
              }
            />
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${consultingStepsSection.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {consultingStepsSection.enabled ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <div className="relative">
              <Input value={consultingStepsSection.title || ''} onChange={(e) => updateConsultingSection(s => ({ ...s, title: e.target.value }), 'homepageContent.consultingStepsSection.title')} placeholder="How It Works" />
              <SavedIndicator field="homepageContent.consultingStepsSection.title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Section Slug/ID</Label>
            <div className="relative">
              <Input value={consultingStepsSection.sectionId || ''} onChange={(e) => updateConsultingSection(s => ({ ...s, sectionId: e.target.value }), 'homepageContent.consultingStepsSection.sectionId')} placeholder="how-it-works" />
              <SavedIndicator field="homepageContent.consultingStepsSection.sectionId" />
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Subtitle</Label>
            <div className="relative">
              <Textarea value={consultingStepsSection.subtitle || ''} onChange={(e) => updateConsultingSection(s => ({ ...s, subtitle: e.target.value }), 'homepageContent.consultingStepsSection.subtitle')} className="min-h-[80px]" placeholder="A clear, step-by-step process..." />
              <SavedIndicator field="homepageContent.consultingStepsSection.subtitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CTA Button Text</Label>
            <div className="relative">
              <Input value={consultingStepsSection.ctaButtonLabel || ''} onChange={(e) => updateConsultingSection(s => ({ ...s, ctaButtonLabel: e.target.value }), 'homepageContent.consultingStepsSection.ctaButtonLabel')} placeholder="Schedule Free Consultation" />
              <SavedIndicator field="homepageContent.consultingStepsSection.ctaButtonLabel" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CTA Link/Action</Label>
            <div className="relative">
              <Input value={consultingStepsSection.ctaButtonLink || ''} onChange={(e) => updateConsultingSection(s => ({ ...s, ctaButtonLink: e.target.value }), 'homepageContent.consultingStepsSection.ctaButtonLink')} placeholder="#lead-form" />
              <SavedIndicator field="homepageContent.consultingStepsSection.ctaButtonLink" />
            </div>
            <p className="text-xs text-muted-foreground">Anchor (#lead-form) or internal link.</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Helper Text</Label>
            <div className="relative">
              <Input value={consultingStepsSection.helperText || ''} onChange={(e) => updateConsultingSection(s => ({ ...s, helperText: e.target.value }), 'homepageContent.consultingStepsSection.helperText')} placeholder="Short text below CTA" />
              <SavedIndicator field="homepageContent.consultingStepsSection.helperText" />
            </div>
          </div>
        </div>
      </div>

      {/* Custom Labels */}
      <div className="bg-white dark:bg-card rounded-lg border p-6 space-y-6 transition-all">
        <div>
          <h2 className="text-lg font-semibold">Custom Labels</h2>
          <p className="text-xs text-muted-foreground mt-1">Customize the labels used in the services section.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tag Label</Label>
            <div className="relative">
              <Input value={consultingStepsSection.tagLabel || ''} onChange={(e) => updateConsultingSection(s => ({ ...s, tagLabel: e.target.value }), 'homepageContent.consultingStepsSection.tagLabel')} placeholder="Consulting" />
              <SavedIndicator field="homepageContent.consultingStepsSection.tagLabel" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Stage Label</Label>
            <div className="relative">
              <Input value={consultingStepsSection.stepLabel || ''} onChange={(e) => updateConsultingSection(s => ({ ...s, stepLabel: e.target.value }), 'homepageContent.consultingStepsSection.stepLabel')} placeholder="Stage" />
              <SavedIndicator field="homepageContent.consultingStepsSection.stepLabel" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>What We Do Label</Label>
            <div className="relative">
              <Input value={consultingStepsSection.whatWeDoLabel || ''} onChange={(e) => updateConsultingSection(s => ({ ...s, whatWeDoLabel: e.target.value }), 'homepageContent.consultingStepsSection.whatWeDoLabel')} placeholder="What we do" />
              <SavedIndicator field="homepageContent.consultingStepsSection.whatWeDoLabel" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Outcome Label</Label>
            <div className="relative">
              <Input value={consultingStepsSection.outcomeLabel || ''} onChange={(e) => updateConsultingSection(s => ({ ...s, outcomeLabel: e.target.value }), 'homepageContent.consultingStepsSection.outcomeLabel')} placeholder="You leave with" />
              <SavedIndicator field="homepageContent.consultingStepsSection.outcomeLabel" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Next Step Label</Label>
            <div className="relative">
              <Input value={consultingStepsSection.nextStepLabel || ''} onChange={(e) => updateConsultingSection(s => ({ ...s, nextStepLabel: e.target.value }), 'homepageContent.consultingStepsSection.nextStepLabel')} placeholder="Next step" />
              <SavedIndicator field="homepageContent.consultingStepsSection.nextStepLabel" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Next Step Text</Label>
            <div className="relative">
              <Input value={consultingStepsSection.nextStepText || ''} onChange={(e) => updateConsultingSection(s => ({ ...s, nextStepText: e.target.value }), 'homepageContent.consultingStepsSection.nextStepText')} placeholder="Open schedule for new projects" />
              <SavedIndicator field="homepageContent.consultingStepsSection.nextStepText" />
            </div>
          </div>
        </div>
      </div>

      {/* Practical Block */}
      <div className="bg-white dark:bg-card rounded-lg border p-6 space-y-6 transition-all">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Practical Block</h2>
            <p className="text-xs text-muted-foreground mt-1">Bullet points showing day-to-day work.</p>
          </div>
          {practicalBullets.length < 6 && (
            <Button variant="outline" size="sm" className="border-dashed"
              onClick={() => updateConsultingSection(s => ({ ...s, practicalBullets: [...(s.practicalBullets || []), 'New bullet'] }), 'homepageContent.consultingStepsSection.practicalBullets')}>
              <Plus className="w-4 h-4 mr-2" /> Add bullet
            </Button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Block Title</Label>
            <div className="relative">
              <Input value={consultingStepsSection.practicalBlockTitle || ''} onChange={(e) => updateConsultingSection(s => ({ ...s, practicalBlockTitle: e.target.value }), 'homepageContent.consultingStepsSection.practicalBlockTitle')} placeholder="In practice" />
              <SavedIndicator field="homepageContent.consultingStepsSection.practicalBlockTitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Block Subtitle</Label>
            <div className="relative">
              <Input value={consultingStepsSection.practicalBlockSubtitle || ''} onChange={(e) => updateConsultingSection(s => ({ ...s, practicalBlockSubtitle: e.target.value }), 'homepageContent.consultingStepsSection.practicalBlockSubtitle')} placeholder="How the work happens day by day" />
              <SavedIndicator field="homepageContent.consultingStepsSection.practicalBlockSubtitle" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {practicalBullets.map((bullet, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="relative flex-1">
                <Input value={bullet} onChange={(e) => updateConsultingSection(s => { const c = [...(s.practicalBullets || practicalBullets)]; c[index] = e.target.value; return { ...s, practicalBullets: c }; }, `homepageContent.consultingStepsSection.practicalBullets.${index}`)} />
                <SavedIndicator field={`homepageContent.consultingStepsSection.practicalBullets.${index}`} />
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={practicalBullets.length <= 1}
                onClick={() => updateConsultingSection(s => ({ ...s, practicalBullets: [...(s.practicalBullets || practicalBullets)].filter((_, i) => i !== index) }), 'homepageContent.consultingStepsSection.practicalBullets')}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          {practicalBullets.length === 0 && <p className="text-sm text-muted-foreground">No bullets registered.</p>}
        </div>
      </div>

      {/* Stages */}
      <div className="bg-white dark:bg-card rounded-lg border p-6 space-y-6 transition-all">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <List className="w-5 h-5 text-primary" />
              Stages
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Reorder using arrows or the Order field.</p>
          </div>
          <Button variant="outline" size="sm" className="border-dashed" onClick={handleAddStep}>
            <Plus className="w-4 h-4 mr-2" /> Add stage
          </Button>
        </div>

        <div className="space-y-4">
          {consultingSteps.map((step, index) => (
            <div key={`${step.numberLabel}-${index}`} className="bg-muted rounded-lg p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    {step.numberLabel || String(index + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{step.title || 'Stage'}</p>
                    <p className="text-xs text-muted-foreground">Order {step.order ?? index + 1}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={index === 0} onClick={() => handleMoveStep(index, -1)}><ArrowUp className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={index === consultingSteps.length - 1} onClick={() => handleMoveStep(index, 1)}><ArrowDown className="w-4 h-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete stage?</AlertDialogTitle>
                        <AlertDialogDescription>This will remove "{step.title}". This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteStep(index)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label>Order</Label>
                  <div className="relative">
                    <Input type="number" value={step.order ?? index + 1} onChange={(e) => handleStepChange(index, c => ({ ...c, order: Number(e.target.value) || index + 1 }), `homepageContent.consultingStepsSection.steps.${index}.order`, true)} />
                    <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.order`} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Number</Label>
                  <div className="relative">
                    <Input value={step.numberLabel || ''} onChange={(e) => handleStepChange(index, c => ({ ...c, numberLabel: e.target.value }), `homepageContent.consultingStepsSection.steps.${index}.numberLabel`)} placeholder="01" />
                    <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.numberLabel`} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Icon</Label>
                  <Select value={step.icon || consultingIconOptions[0].value} onValueChange={(v) => handleStepChange(index, c => ({ ...c, icon: v }), `homepageContent.consultingStepsSection.steps.${index}.icon`)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {consultingIconOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2"><opt.icon className="w-4 h-4" /><span>{opt.label}</span></div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <div className="relative">
                  <Input value={step.title} onChange={(e) => handleStepChange(index, c => ({ ...c, title: e.target.value }), `homepageContent.consultingStepsSection.steps.${index}.title`)} />
                  <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.title`} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>What we do</Label>
                  <div className="relative">
                    <Textarea value={step.whatWeDo} onChange={(e) => handleStepChange(index, c => ({ ...c, whatWeDo: e.target.value }), `homepageContent.consultingStepsSection.steps.${index}.whatWeDo`)} className="min-h-[100px]" />
                    <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.whatWeDo`} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>You leave with</Label>
                  <div className="relative">
                    <Textarea value={step.outcome} onChange={(e) => handleStepChange(index, c => ({ ...c, outcome: e.target.value }), `homepageContent.consultingStepsSection.steps.${index}.outcome`)} className="min-h-[100px]" />
                    <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.outcome`} />
                  </div>
                </div>
              </div>
            </div>
          ))}
          {consultingSteps.length === 0 && (
            <div className="bg-muted rounded-lg p-8 text-center">
              <List className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No stages registered. Click "Add stage" to create one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
