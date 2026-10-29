CREATE TABLE IF NOT EXISTS platform.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  company text NOT NULL,
  owner_name text NOT NULL,
  owner_email text NOT NULL,
  -- queued, provisioning, ready or failed
  status text NOT NULL DEFAULT 'queued',
  step text,
  error text,
  claim_hash text NOT NULL,
  setup_token_sealed text NOT NULL,
  -- Railway ids made so far, so a restart carries on where it stopped
  railway jsonb NOT NULL DEFAULT '{}'::jsonb,
  app_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz
);

CREATE INDEX IF NOT EXISTS workspaces_status_idx ON platform.workspaces (status);
