import { useTranslation } from "@/hooks/useTranslation";
import { NotFoundState } from "@/components/NotFoundState";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <NotFoundState
      layout="screen"
      code="404"
      title={t('Page Not Found')}
      description={t('The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.')}
      actionLabel={t('Back to Home')}
    />
  );
}
