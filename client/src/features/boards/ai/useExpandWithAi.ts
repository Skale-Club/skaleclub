import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { useBoardStoreApi } from '../store/boardStore';
import { EmptyTopicError, expandNodeWithAi } from './aiActions';
import { aiErrorMessage } from './boardsAiApi';

/** "Expand with AI" for a mind node: spinner on the node while it runs, a toast when it fails. */
export function useExpandWithAi() {
  const store = useBoardStoreApi();
  const { t, language } = useTranslation();
  const { toast } = useToast();
  return useCallback(
    async (id: string) => {
      try {
        const added = await expandNodeWithAi(store, id, language === 'pt' ? 'pt' : 'en');
        if (added) toast({ title: `${added} ${added === 1 ? t('topic added') : t('topics added')}` });
      } catch (err) {
        if (err instanceof EmptyTopicError) {
          toast({ title: t('Write the topic text first') });
          return;
        }
        toast({ title: t('Could not expand the topic'), description: t(aiErrorMessage(err)), variant: 'destructive' });
      }
    },
    [language, store, t, toast],
  );
}
