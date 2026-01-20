-- Rename legacy quiz tables/columns/indexes to form equivalents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'quiz_leads'
  ) THEN
    ALTER TABLE quiz_leads RENAME TO form_leads;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'form_leads' AND column_name = 'quiz_completo'
  ) THEN
    ALTER TABLE form_leads RENAME COLUMN quiz_completo TO form_completo;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'quiz_config'
  ) THEN
    ALTER TABLE company_settings RENAME COLUMN quiz_config TO form_config;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'quiz_leads_email_unique') THEN
    ALTER INDEX quiz_leads_email_unique RENAME TO form_leads_email_unique;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'quiz_leads_email_idx') THEN
    ALTER INDEX quiz_leads_email_idx RENAME TO form_leads_email_idx;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'quiz_leads_session_idx') THEN
    ALTER INDEX quiz_leads_session_idx RENAME TO form_leads_session_idx;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'quiz_leads_classificacao_idx') THEN
    ALTER INDEX quiz_leads_classificacao_idx RENAME TO form_leads_classificacao_idx;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'quiz_leads_created_at_idx') THEN
    ALTER INDEX quiz_leads_created_at_idx RENAME TO form_leads_created_at_idx;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'quiz_leads_status_idx') THEN
    ALTER INDEX quiz_leads_status_idx RENAME TO form_leads_status_idx;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_leads_score_total_check') THEN
    ALTER TABLE form_leads RENAME CONSTRAINT quiz_leads_score_total_check TO form_leads_score_total_check;
  END IF;
END $$;
