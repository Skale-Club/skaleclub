-- MCP API tokens: hashed bearer tokens for external AI agent access
CREATE TABLE api_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  token_hash  TEXT        NOT NULL UNIQUE,  -- SHA-256 of the raw token
  token_prefix TEXT       NOT NULL,          -- first 12 chars of raw token (display only)
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  rotated_at  TIMESTAMPTZ
);

-- MCP audit log: every tool call made via MCP is recorded here
CREATE TABLE mcp_audit_logs (
  id           SERIAL      PRIMARY KEY,
  token_id     UUID        REFERENCES api_tokens(id) ON DELETE SET NULL,
  token_prefix TEXT        NOT NULL,   -- denormalized so logs survive token deletion
  tool_name    TEXT        NOT NULL,
  target_type  TEXT,                   -- 'estimate' | 'presentation' | null
  target_id    TEXT,
  action       TEXT        NOT NULL,   -- 'read' | 'create' | 'update'
  result       TEXT        NOT NULL,   -- 'success' | 'error'
  error_message TEXT,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX mcp_audit_logs_token_id_idx  ON mcp_audit_logs(token_id);
CREATE INDEX mcp_audit_logs_created_at_idx ON mcp_audit_logs(created_at DESC);
