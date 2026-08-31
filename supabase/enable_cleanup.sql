-- Run as the project owner after both migrations, once only.
-- Free Supabase Cron extension; no Edge Function or paid external scheduler.
create extension if not exists pg_cron;
select cron.schedule('explorepath-social-cleanup', '* * * * *', 'select public.social_cleanup()');
