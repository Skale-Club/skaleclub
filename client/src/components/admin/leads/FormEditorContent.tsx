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
import {
  Gauge,
  HelpCircle,
  Plus,
  Star,
} from 'lucide-react';
import { EmptyState } from '../shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import { DEFAULT_FORM_CONFIG, calculateMaxScore, getSortedQuestions } from '@shared/form';
import type { FormConfig, FormQuestion } from '@shared/schema';
import { QuestionForm } from './QuestionForm';
import { SortableQuestionItem } from './SortableQuestionItem';
import { ThresholdsForm } from './ThresholdsForm';

export interface FormEditorContentProps {
  formId: number;
}

export function FormEditorContent({ formId }: FormEditorContentProps) {
  const { toast } = useToast();
  const [editingQuestion, setEditingQuestion] = useState<FormQuestion | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isThresholdsOpen, setIsThresholdsOpen] = useState(false);

  const configEndpoint = `/api/forms/${formId}`;

  const { data: form, isLoading } = useQuery<{ config: FormConfig }>({
    queryKey: [configEndpoint],
    queryFn: async () => {
      const res = await apiRequest('GET', configEndpoint);
      return res.json();
    },
  });
  const formConfig = form?.config;

  const hydrateConfig = (incoming: FormConfig | undefined): FormConfig => {
    const base = incoming ?? DEFAULT_FORM_CONFIG;
    return {
      ...base,
      questions: Array.isArray(base.questions) ? base.questions : [],
      thresholds: base.thresholds ?? DEFAULT_FORM_CONFIG.thresholds,
      maxScore: typeof base.maxScore === 'number' ? base.maxScore : 0,
    };
  };

  const [config, setConfig] = useState<FormConfig>(hydrateConfig(formConfig));

  useEffect(() => {
    setConfig(hydrateConfig(formConfig));
  }, [formConfig]);

  const sortedQuestions = getSortedQuestions(config);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const saveConfig = useMutation({
    mutationFn: async (newConfig: FormConfig) => {
      const res = await apiRequest('PUT', `/api/forms/${formId}`, { config: newConfig });
      const json = await res.json();
      return json.config as FormConfig;
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
    return <div className="flex w-full justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingQuestion(null); }}>
          <DialogTrigger asChild>
            <Button>
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
            <Button variant="outline">
              <Gauge className="w-4 h-4 mr-2" />
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
        <span className="inline-flex h-9 items-center rounded-md border bg-muted px-3 text-xs text-muted-foreground ml-auto">
          Max score: {config.maxScore}
        </span>
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
                    onInlineSave={handleSaveQuestion}
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

