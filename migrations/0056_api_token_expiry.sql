-- MCP API tokens: give newly issued tokens a lifetime so a leaked bearer token
-- stops working on its own. Existing rows stay NULL ("never expires") so tokens
-- already handed to clients keep working.
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Expired authorization codes still hold the plaintext bearer token they were
-- minted for until they are consumed; the cleanup sweep deletes them by expiry.
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires_at ON oauth_codes(expires_at);
