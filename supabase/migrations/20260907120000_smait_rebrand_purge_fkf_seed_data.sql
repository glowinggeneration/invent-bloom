-- SMAIT rebrand: remove FKF-specific *seed* data inserted by earlier
-- migrations (20260807093341, 20260830211009, 20260815090736,
-- 20260819132831). This does not touch real user data - only rows this
-- project's own migrations inserted as example/seed content for the former
-- single hardcoded tenant (Football Kenya Federation).

-- Seeded listening keywords (source = 'seed', inserted verbatim by two
-- earlier migrations against the same unique(lower(term)) index).
DELETE FROM public.mention_keywords
WHERE source = 'seed'
  AND lower(term) IN (
    'football kenya federation',
    'fkf',
    'harambee stars',
    'harambee starlets',
    'fkf premier league',
    'kenyan football',
    'hussein mohammed fkf',
    'fkf president',
    'kenya national team football',
    'fkf elections'
  );

-- Seeded TikTok profile cache row for the former hardcoded tenant. No
-- foreign key references this table by (platform, handle), so this is a
-- plain cache-row delete, not a cascading data-integrity change.
DELETE FROM public.apify_profiles
WHERE platform = 'tiktok' AND handle = 'footballkenya';
