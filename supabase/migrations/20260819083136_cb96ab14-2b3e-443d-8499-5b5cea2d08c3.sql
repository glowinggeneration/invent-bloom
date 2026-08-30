
update public.scheduled_actions set status='pending', attempts=0, run_at=now(), error=null where id='95c10d1e-8d5e-4428-ac54-555c98121f66';

insert into public.scheduled_actions (user_id, source, job_id, publish_action_id, account_id, handle, persona_name, action_type, content, target_tweet_id, run_at, status)
select a.user_id, 'publish', a.job_id, a.id, a.account_id, x.handle, coalesce(x.display_name, x.handle), 'comment', a.content,
  regexp_replace(j.target_tweet_url, '^.*/status/([0-9]+).*$', '\1'), now(), 'pending'
from public.publish_actions a
join public.publish_jobs j on j.id = a.job_id
join public.x_accounts x on x.id = a.account_id
where a.id in ('23ca8355-34e6-4eb3-af78-60e386b7edfd','0bb83010-ddce-4854-939f-559b8a077678','e351320a-b147-4fd8-9e77-7fd942e4ea58');
