import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@shared/schema';
import { DEFAULT_FORM_CONFIG, calculateMaxScore } from '@shared/form';
import type { FormConfig, FormQuestion } from '@shared/schema';
import { eq } from 'drizzle-orm';

function normalizeConfig(input: FormConfig): FormConfig {
  const spec = DEFAULT_FORM_CONFIG;
  const specById = new Map(spec.questions.map(q => [q.id, q]));

  let normalizedQuestions: FormQuestion[] = input.questions.map(q => {
    const specQ = specById.get(q.id);
    if (!specQ) return q;
    return {
      ...q,
      title: specQ.title,
      type: specQ.type,
      required: specQ.required,
      placeholder: specQ.placeholder,
      options: specQ.options,
      conditionalField: specQ.conditionalField,
    };
  });

  for (const specQ of spec.questions) {
    if (!normalizedQuestions.some(q => q.id === specQ.id)) {
      normalizedQuestions.push({ ...specQ });
    }
  }

  const idxLocalizacao = normalizedQuestions.findIndex(q => q.id === 'localizacao');
  if (idxLocalizacao >= 0) {
    const hasStandaloneCidadeEstado = normalizedQuestions.some(q => q.id === 'cidadeEstado');
    if (hasStandaloneCidadeEstado) {
      normalizedQuestions = normalizedQuestions.filter(q => q.id !== 'cidadeEstado');
    }
    const specLocalizacao = specById.get('localizacao');
    if (specLocalizacao?.conditionalField) {
      normalizedQuestions[idxLocalizacao] = {
        ...normalizedQuestions[idxLocalizacao],
        conditionalField: specLocalizacao.conditionalField,
      };
    }
  }

  const idxTipoNegocio = normalizedQuestions.findIndex(q => q.id === 'tipoNegocio');
  if (idxTipoNegocio >= 0) {
    const hasStandaloneOutro = normalizedQuestions.some(q => q.id === 'tipoNegocioOutro');
    if (hasStandaloneOutro) {
      normalizedQuestions = normalizedQuestions.filter(q => q.id !== 'tipoNegocioOutro');
    }
    const specTipo = specById.get('tipoNegocio');
    if (specTipo?.conditionalField) {
      normalizedQuestions[idxTipoNegocio] = {
        ...normalizedQuestions[idxTipoNegocio],
        conditionalField: specTipo.conditionalField,
      };
    }
  }

  const isKnown = (qId: string) => specById.has(qId);
  normalizedQuestions = normalizedQuestions
    .sort((a, b) => {
      const aKnown = isKnown(a.id);
      const bKnown = isKnown(b.id);
      if (aKnown && bKnown) {
        const aSpec = specById.get(a.id)!.order;
        const bSpec = specById.get(b.id)!.order;
        return aSpec - bSpec;
      }
      if (aKnown && !bKnown) return -1;
      if (!aKnown && bKnown) return 1;
      return (a.order ?? 999) - (b.order ?? 999);
    })
    .map((q, i) => ({ ...q, order: i + 1 }));

  return {
    questions: normalizedQuestions,
    maxScore: calculateMaxScore({ ...input, questions: normalizedQuestions }),
    thresholds: input.thresholds || spec.thresholds,
  };
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

  if (!sourceUrl || !targetUrl) {
    throw new Error('Defina SOURCE_DATABASE_URL e TARGET_DATABASE_URL (ou DATABASE_URL) para sincronizar.');
  }

  const sourcePool = new pg.Pool({ connectionString: sourceUrl });
  const targetPool = new pg.Pool({ connectionString: targetUrl });
  const sourceDb = drizzle(sourcePool, { schema });
  const targetDb = drizzle(targetPool, { schema });

  try {
    const [sourceSettings] = await sourceDb.select().from(schema.companySettings);
    const sourceConfig: FormConfig = (sourceSettings?.formConfig as any) || DEFAULT_FORM_CONFIG;
    const normalized = normalizeConfig(sourceConfig);

    const [targetSettings] = await targetDb.select().from(schema.companySettings);
    if (targetSettings) {
      await targetDb
        .update(schema.companySettings)
        .set({ formConfig: normalized })
        .where(eq(schema.companySettings.id, targetSettings.id));
    } else {
      await targetDb
        .insert(schema.companySettings)
        .values({ formConfig: normalized });
    }

    console.log('Sincronização concluída com sucesso.', {
      totalPerguntas: normalized.questions.length,
      maxScore: normalized.maxScore,
      thresholds: normalized.thresholds,
    });
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

main().catch(err => {
  console.error('Erro na sincronização:', err);
  process.exit(1);
});
