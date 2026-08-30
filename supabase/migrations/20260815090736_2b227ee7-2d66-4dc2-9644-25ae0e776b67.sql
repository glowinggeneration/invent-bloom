insert into public.apify_profiles (platform, handle, display_name, description, profile_url, fetched_at)
values ('tiktok','footballkenya','Football Kenya Federation','Official TikTok page of Football Kenya Federation.','https://www.tiktok.com/@footballkenya', now())
on conflict (platform, handle) do update set profile_url = excluded.profile_url;