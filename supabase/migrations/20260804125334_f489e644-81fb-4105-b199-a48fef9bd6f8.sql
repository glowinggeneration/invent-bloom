CREATE TABLE public.x_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL,
  email text NOT NULL DEFAULT '',
  password text NOT NULL,
  proxy text NOT NULL DEFAULT '',
  persona_label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_code',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, handle)
);

GRANT ALL ON public.x_login_attempts TO service_role;

ALTER TABLE public.x_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER x_login_attempts_updated_at
BEFORE UPDATE ON public.x_login_attempts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();