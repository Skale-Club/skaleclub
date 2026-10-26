import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { BoardImageError, uploadBoardImage, type UploadedBoardImage } from './images';

/** Uploads a board image with progress / error toasts. Resolves null when it failed. */
export function useImageUpload() {
  const { toast } = useToast();
  const { t } = useTranslation();
  return useCallback(
    async (file: File): Promise<UploadedBoardImage | null> => {
      const progress = toast({ title: t('Uploading image…') });
      try {
        const image = await uploadBoardImage(file);
        progress.dismiss();
        return image;
      } catch (err) {
        progress.dismiss();
        const code = err instanceof BoardImageError ? err.code : 'failed';
        toast({
          title: code === 'storage_not_configured' ? t('Image storage is not configured') : t('Could not add the image'),
          description:
            code === 'storage_not_configured'
              ? t('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server to upload images to boards.')
              : err instanceof Error
                ? err.message
                : undefined,
          variant: 'destructive',
        });
        return null;
      }
    },
    [t, toast],
  );
}
