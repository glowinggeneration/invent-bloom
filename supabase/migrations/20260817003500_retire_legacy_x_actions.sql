-- Retire legacy automated X actions that pre-date the compliance-aware engine.
-- New code blocks these actions before queue insertion, but existing pending rows
-- must also be closed so they cannot execute after deployment or a later resume.

update public.scheduled_actions
set
  status = 'failed',
  error = 'Cancelled during compliance migration: automated Like, Bookmark and proactive Follow actions are disabled.'
where status in ('pending', 'paused')
  and action_type in ('like', 'bookmark', 'follow');

update public.publish_actions
set
  status = 'failed',
  error = 'Cancelled during compliance migration: automated Like, Bookmark and proactive Follow actions are disabled.'
where status = 'pending'
  and action_type in ('like', 'bookmark', 'follow');

-- Keyword-triggered automatic reply campaigns are now monitoring-only history.
update public.listening_campaigns
set is_active = false
where is_active = true;

update public.scheduled_actions
set
  status = 'failed',
  error = 'Cancelled during compliance migration: automatic keyword-triggered replies are retired.'
where status in ('pending', 'paused')
  and source = 'campaign';

update public.campaign_replies
set
  status = 'failed',
  error = 'Cancelled during compliance migration: automatic keyword-triggered replies are retired.'
where status = 'pending';
