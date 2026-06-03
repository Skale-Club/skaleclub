-- Normalize lead_classificacao enum values from Portuguese to English.
-- Uses ALTER TYPE ... RENAME VALUE (PG 10+) — no row data is rewritten.

ALTER TYPE lead_classificacao RENAME VALUE 'QUENTE' TO 'HOT';
ALTER TYPE lead_classificacao RENAME VALUE 'MORNO' TO 'WARM';
ALTER TYPE lead_classificacao RENAME VALUE 'FRIO' TO 'COLD';
ALTER TYPE lead_classificacao RENAME VALUE 'DESQUALIFICADO' TO 'DISQUALIFIED';
