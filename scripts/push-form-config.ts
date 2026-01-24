import 'dotenv/config';
import { storage } from '../server/storage';
import { DEFAULT_FORM_CONFIG, calculateMaxScore } from '@shared/form';
import { pool } from '../server/db';
import type { FormConfig } from '@shared/schema';

async function main() {
  const config: FormConfig = {
    ...DEFAULT_FORM_CONFIG,
    maxScore: calculateMaxScore(DEFAULT_FORM_CONFIG),
    thresholds: DEFAULT_FORM_CONFIG.thresholds,
  };

  const updated = await storage.updateCompanySettings({ formConfig: config });
  console.log('Form config atualizado no banco:', {
    totalPerguntas: updated.formConfig?.questions.length,
    maxScore: updated.formConfig?.maxScore,
    thresholds: updated.formConfig?.thresholds,
  });
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Erro ao atualizar form_config:', err);
    await pool.end();
    process.exit(1);
  });
