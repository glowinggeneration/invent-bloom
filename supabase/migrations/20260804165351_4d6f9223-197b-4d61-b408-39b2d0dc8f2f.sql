CREATE TABLE public.persona_images (
  persona_id TEXT NOT NULL PRIMARY KEY,
  query TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL,
  background_url TEXT NOT NULL,
  color TEXT,
  photographer_name TEXT NOT NULL DEFAULT '',
  photographer_url TEXT NOT NULL DEFAULT '',
  unsplash_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.persona_images TO authenticated;
GRANT ALL ON public.persona_images TO service_role;
ALTER TABLE public.persona_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Persona images readable by signed-in users" ON public.persona_images FOR SELECT TO authenticated USING (true);
CREATE TRIGGER persona_images_updated_at BEFORE UPDATE ON public.persona_images FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();