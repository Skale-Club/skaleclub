import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { HelpCircle, Loader2, Plus, Star } from 'lucide-react';
import { EmptyState } from '../shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { DEFAULT_FORM_CONFIG, calculateMaxScore, getSortedQuestions } from '@shared/form';
import type { FormConfig, FormQuestion } from '@shared/schema';
import { QuestionForm } from './QuestionForm';
import { SortableQuestionItem } from './SortableQuestionItem';
import { ThresholdsForm } from './ThresholdsForm';

export interface FormEditorContentProps {
  /**
   * Form to edit. When provided, the editor reads/writes /api/forms/:formId.
   * When omitted, falls back to the legacy global /api/form-config endpoint
   * so existing call sites (Leads section Edit Form sheet) keep working.
   */
  formId?: number;
}

export function FormEditorContent({ formId }: FormEditorContentProps = {}) {
  const { toast } = useToast();
  const [editingQuestion, setEditingQuestion] = useState<FormQuestion | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isThresholdsOpen, setIsThresholdsOpen] = useState(false);

  const configEndpoint = formId ? `/api/forms/${formId}` : '/api/form-config';

  const { data: formConfig, isLoading } = useQuery<FormConfig>({
    queryKey: [configEndpoint],
    queryFn: async () => {
      const res = await apiRequest('GET', configEndpoint);
      const json = await res.json();
      // When fetching a form row, extract its `config` payload.
      return formId ? json.config : json;
    },
  });

  const [config, setConfig] = useState<FormConfig>(formConfig || DEFAULT_FORM_CONFIG);

  useEffect(() => {
    setConfig(formConfig || DEFAULT_FORM_CONFIG);
  }, [formConfig]);

  const sortedQuestions = getSortedQuestions(config);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const saveConfig = useMutation({
    mutationFn: async (newConfig: FormConfig) => {
      if (formId) {
        const res = await apiRequest('PUT', `/api/forms/${formId}`, { config: newConfig });
        const json = await res.json();
        return json.config as FormConfig;
      }
      const res = await apiRequest('PUT', '/api/form-config', newConfig);
      return res.json() as Promise<FormConfig>;
    },
    onSuccess: (data: FormConfig) => {
      setConfig(data);
      queryClient.invalidateQueries({ queryKey: [configEndpoint] });
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
      toast({ title: 'Configuration saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save configuration', description: error.message, variant: 'destructive' });
    }
  });

  const handleSaveQuestion = (question: FormQuestion) => {
    const existingIndex = config.questions.findIndex(q => q.id === question.id);
    let newQuestions: FormQuestion[];

    if (existingIndex >= 0) {
      newQuestions = config.questions.map(q => q.id === question.id ? question : q);
    } else {
      newQuestions = [...config.questions, question];
    }

    newQuestions = newQuestions
      .sort((a, b) => a.order - b.order)
      .map((q, i) => ({ ...q, order: i + 1 }));

    const newConfig: FormConfig = {
      ...config,
      questions: newQuestions,
      maxScore: calculateMaxScore({ ...config, questions: newQuestions }),
    };

    setConfig(newConfig);
    saveConfig.mutate(newConfig);
    setIsDialogOpen(false);
    setEditingQuestion(null);
  };

  const handleDeleteQuestion = (questionId: string) => {
    const newQuestions = config.questions
      .filter(q => q.id !== questionId)
      .sort((a, b) => a.order - b.order)
      .map((q, i) => ({ ...q, order: i + 1 }));

    const newConfig: FormConfig = {
      ...config,
      questions: newQuestions,
      maxScore: calculateMaxScore({ ...config, questions: newQuestions }),
    };

    setConfig(newConfig);
    saveConfig.mutate(newConfig);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sortedQuestions.findIndex(q => q.id === active.id);
      const newIndex = sortedQuestions.findIndex(q => q.id === over.id);
      const reordered = arrayMove(sortedQuestions, oldIndex, newIndex);
      const newQuestions = reordered.map((q, i) => ({ ...q, order: i + 1 }));
      const newConfig: FormConfig = {
        ...config,
        questions: newQuestions,
        maxScore: calculateMaxScore({ ...config, questions: newQuestions }),
      };
      setConfig(newConfig);
      saveConfig.mutate(newConfig);
    }
  };

  const handleSaveThresholds = (thresholds: FormConfig['thresholds']) => {
    const newConfig: FormConfig = { ...config, thresholds };
    setConfig(newConfig);
    saveConfig.mutate(newConfig);
    setIsThresholdsOpen(false);
  };

  const getQuestionTypeBadge = (type: FormQuestion['type']) => {
    const labels = { text: 'Text', email: 'Email', tel: 'Phone', select: 'Multiple choice' };
    return labels[type] || type;
  };

  const getQuestionMaxPoints = (question: FormQuestion) => {
    if (question.type !== 'select' || !question.options) return 0;
    return Math.max(...question.options.map(o => o.points));
  };

  if (isLoading && !formConfig) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingQuestion(null); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Question
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <QuestionForm
              question={editingQuestion}
              onSave={handleSaveQuestion}
              isLoading={saveConfig.isPending}
              nextOrder={sortedQuestions.length + 1}
              existingIds={config.questions.map(q => q.id)}
            />
          </DialogContent>
        </Dialog>
        <Dialog open={isThresholdsOpen} onOpenChange={setIsThresholdsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Star className="w-4 h-4 mr-2" />
              Thresholds
            </Button>
          </DialogTrigger>
          <DialogContent>
            <ThresholdsForm
              thresholds={config.thresholds}
              onSave={handleSaveThresholds}
              isLoading={saveConfig.isPending}
            />
          </DialogContent>
        </Dialog>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded ml-auto">
          Max score: {config.maxScore}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
          <p className="text-xs text-green-600 dark:text-green-400 font-semibold">HOT</p>
          <p className="text-lg font-bold text-green-700 dark:text-green-300">&ge; {config.thresholds.hot} pts</p>
        </div>
        <div className="p-3 rounded-xl border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">WARM</p>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">&ge; {config.thresholds.warm} pts</p>
        </div>
        <div className="p-3 rounded-xl border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">COLD</p>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">&ge; {config.thresholds.cold} pts</p>
        </div>
        <div className="p-3 rounded-xl border bg-muted">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">DISQUALIFIED</p>
          <p className="text-lg font-bold text-slate-600 dark:text-slate-300">&lt; {config.thresholds.cold} pts</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50">
          <p className="text-sm font-semibold text-muted-foreground">{sortedQuestions.length} questions</p>
        </div>

        {sortedQuestions.length === 0 ? (
          <EmptyState
            icon={<HelpCircle />}
            title="No questions yet"
            description="Add questions to your qualification form"
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortedQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-border">
                {sortedQuestions.map((question) => (
                  <SortableQuestionItem
                    key={question.id}
                    question={question}
                    onEdit={(q) => { setEditingQuestion(q); setIsDialogOpen(true); }}
                    onDelete={(id) => {
                      if (window.confirm('Are you sure you want to delete this question?')) {
                        handleDeleteQuestion(id);
                      }
                    }}
                    typeBadge={getQuestionTypeBadge(question.type)}
                    maxPoints={getQuestionMaxPoints(question)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
