-- Extends investigations with a generated brief and the evidence it was
-- built from, so saving an investigation preserves its sources rather than
-- just its topic. Additive only - existing rows get empty defaults and
-- keep working with every prior query against this table.

ALTER TABLE public.investigations
  ADD COLUMN brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN evidence jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.investigations.brief IS
  'Generated { observedFacts, interpretation, suggestedActions, coverageGaps }. Facts cite evidence by key - see src/lib/investigation-brief.server.ts.';
COMMENT ON COLUMN public.investigations.evidence IS
  'Snapshot of the source items the brief was generated from: [{ key, kind, title, url, publishedAt, retrievedAt }]. Preserved even if the live source later disappears.';
