-- Minimal cosmetic display; no XP, health, photos, full collection or private notes.
alter table public.social_profiles alter column pet_name set default '探索者徽章';
alter table public.social_profiles alter column pet_visual_key set default 'badge';
alter table public.social_profiles alter column pet_stage set default 'emptyRoom';
alter table public.social_profiles alter column pet_story_chapter set default '';
alter table public.social_profiles alter column pet_symbol set default '⌁';
update public.social_profiles set pet_name='探索者徽章',pet_visual_key='badge',pet_stage='emptyRoom',pet_story_chapter='',pet_symbol='⌁' where pet_visual_key='egg';
create or replace function public.update_social_pet(p_name text, p_series text, p_stage text)
returns void language plpgsql security definer set search_path = public as $$
declare owner_id uuid := public.current_social_profile_id();
begin
  if owner_id is null then raise exception 'social_profile_missing'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 16 then raise exception 'invalid_pet_name'; end if;
  if p_series is null or p_series not in ('badge','pebble','water','porcelain','marble','cloud','thought','voyager','brass','frosted','wood','compass','stargazer') then raise exception 'invalid_pet_series'; end if;
  if p_stage is null or (p_series='badge' and p_stage<>'emptyRoom') or (p_series<>'badge' and p_stage not in ('egg','juvenile','growing','mature')) then raise exception 'invalid_pet_stage'; end if;
  update public.social_profiles set pet_name=trim(p_name),pet_visual_key=p_series,pet_stage=p_stage,
    pet_story_chapter=case when p_stage='emptyRoom' then '' when p_stage='egg' then 'prologue' else 'juvenile' end,
    pet_symbol='⌁',updated_at=now() where id=owner_id;
end;
$$;
revoke all on function public.update_social_pet(text,text,text) from public,anon;
grant execute on function public.update_social_pet(text,text,text) to authenticated;
