CREATE TYPE "lead_classificacao" AS ENUM ('QUENTE', 'MORNO', 'FRIO', 'DESQUALIFICADO');
CREATE TYPE "lead_status" AS ENUM ('novo', 'contatado', 'qualificado', 'convertido', 'descartado');

CREATE TABLE IF NOT EXISTS "quiz_leads" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "nome" text NOT NULL,
  "email" text,
  "telefone" text,
  "cidade_estado" text,
  "tipo_negocio" text,
  "tipo_negocio_outro" text,
  "tempo_negocio" text,
  "experiencia_marketing" text,
  "orcamento_anuncios" text,
  "principal_desafio" text,
  "disponibilidade" text,
  "expectativa_resultado" text,
  "score_total" integer NOT NULL DEFAULT 0,
  "classificacao" "lead_classificacao",
  "score_tipo_negocio" integer NOT NULL DEFAULT 0,
  "score_tempo_negocio" integer NOT NULL DEFAULT 0,
  "score_experiencia" integer NOT NULL DEFAULT 0,
  "score_orcamento" integer NOT NULL DEFAULT 0,
  "score_desafio" integer NOT NULL DEFAULT 0,
  "score_disponibilidade" integer NOT NULL DEFAULT 0,
  "score_expectativa" integer NOT NULL DEFAULT 0,
  "tempo_total_segundos" integer,
  "user_agent" text,
  "url_origem" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "status" "lead_status" NOT NULL DEFAULT 'novo',
  "quiz_completo" boolean NOT NULL DEFAULT false,
  "ultima_pergunta_respondida" integer NOT NULL DEFAULT 0,
  "notificacao_enviada" boolean NOT NULL DEFAULT false,
  "data_contato" timestamp,
  "observacoes" text,
  CONSTRAINT "quiz_leads_score_total_check" CHECK (score_total >= 0 AND score_total <= 78)
);

CREATE UNIQUE INDEX IF NOT EXISTS "quiz_leads_email_unique" ON "quiz_leads" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "quiz_leads_session_idx" ON "quiz_leads" ("session_id");
CREATE INDEX IF NOT EXISTS "quiz_leads_classificacao_idx" ON "quiz_leads" ("classificacao");
CREATE INDEX IF NOT EXISTS "quiz_leads_created_at_idx" ON "quiz_leads" ("created_at");
CREATE INDEX IF NOT EXISTS "quiz_leads_status_idx" ON "quiz_leads" ("status");
