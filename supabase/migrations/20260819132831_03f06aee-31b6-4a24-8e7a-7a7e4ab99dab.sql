UPDATE public.apify_profiles
SET display_name = 'FKF',
    followers = 12300,
    following = 9,
    likes_count = 80200,
    avatar_url = COALESCE(avatar_url, '/fkf-logo.png'),
    fetched_at = now()
WHERE platform = 'tiktok' AND handle = 'footballkenya';