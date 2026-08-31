-- ExplorePath v0.8.0 social foundation
-- Run in a new Supabase project with Anonymous Sign-Ins and Realtime enabled.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.social_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  nickname text not null default '新探索者' check (char_length(nickname) between 1 and 24),
  friend_code text not null unique check (friend_code ~ '^[A-Z0-9]{8,10}$'),
  availability_until timestamptz,
  pet_name text not null default '未孵化蛋',
  pet_visual_key text not null default 'egg',
  pet_stage text not null default '等待相遇',
  pet_story_chapter text not null default '序章',
  pet_symbol text not null default '◉',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_recovery (
  profile_id uuid primary key references public.social_profiles(id) on delete cascade,
  secret_hash text not null unique check (secret_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.social_friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.social_profiles(id) on delete cascade,
  recipient_id uuid not null references public.social_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'blocked', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  responded_at timestamptz,
  check (sender_id <> recipient_id)
);

create unique index if not exists social_friend_requests_pending_pair
  on public.social_friend_requests (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
  where status = 'pending';

create table if not exists public.social_friendships (
  profile_low uuid not null references public.social_profiles(id) on delete cascade,
  profile_high uuid not null references public.social_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_low, profile_high),
  check (profile_low < profile_high)
);

create table if not exists public.social_friend_labels (
  owner_id uuid not null references public.social_profiles(id) on delete cascade,
  friend_id uuid not null references public.social_profiles(id) on delete cascade,
  category text not null default 'friend' check (category in ('family', 'friend', 'coworker')),
  favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  check (owner_id <> friend_id)
);

create table if not exists public.social_blocks (
  blocker_id uuid not null references public.social_profiles(id) on delete cascade,
  blocked_id uuid not null references public.social_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.social_rooms (
  id uuid primary key default gen_random_uuid(),
  host_profile_id uuid not null references public.social_profiles(id),
  phase text not null default 'waiting' check (phase in ('waiting', 'active', 'completed', 'closed')),
  mode text not null check (mode in ('gather', 'sharedStart')),
  duration_minutes integer not null check (duration_minutes in (30, 60, 90, 120)),
  difficulty text not null check (difficulty in ('relaxed', 'standard', 'challenge')),
  destination_name text not null check (char_length(destination_name) between 1 and 80),
  destination_latitude double precision,
  destination_longitude double precision,
  created_at timestamptz not null default now(),
  lobby_expires_at timestamptz not null default (now() + interval '30 minutes'),
  started_at timestamptz,
  expected_end_at timestamptz,
  max_end_at timestamptz,
  completed_at timestamptz,
  closed_at timestamptz
);

create table if not exists public.social_room_members (
  room_id uuid not null references public.social_rooms(id) on delete cascade,
  profile_id uuid not null references public.social_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  ready_at timestamptz,
  left_at timestamptz,
  arrival_entered_at timestamptz,
  arrived_at timestamptz,
  primary key (room_id, profile_id)
);

create table if not exists public.social_room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.social_rooms(id) on delete cascade,
  sender_id uuid not null references public.social_profiles(id) on delete cascade,
  recipient_id uuid not null references public.social_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  responded_at timestamptz,
  unique (room_id, recipient_id)
);

create table if not exists public.social_room_locations (
  room_id uuid not null references public.social_rooms(id) on delete cascade,
  profile_id uuid not null references public.social_profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision check (accuracy_meters is null or accuracy_meters >= 0),
  captured_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (room_id, profile_id)
);

create table if not exists public.social_room_tasks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.social_rooms(id) on delete cascade,
  sequence integer not null,
  kind text not null check (kind in ('steps', 'activeMinutes', 'observation', 'photo')),
  title text not null check (char_length(title) between 1 and 60),
  prompt text not null check (char_length(prompt) between 1 and 280),
  required boolean not null default true,
  step_target integer,
  active_minute_target integer,
  unique (room_id, sequence)
);

create table if not exists public.social_task_completions (
  task_id uuid not null references public.social_room_tasks(id) on delete cascade,
  profile_id uuid not null references public.social_profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (task_id, profile_id)
);

create table if not exists public.social_kick_votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.social_rooms(id) on delete cascade,
  target_profile_id uuid not null references public.social_profiles(id) on delete cascade,
  started_by uuid not null references public.social_profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'passed', 'failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  resolved_at timestamptz
);

create table if not exists public.social_kick_ballots (
  vote_id uuid not null references public.social_kick_votes(id) on delete cascade,
  voter_profile_id uuid not null references public.social_profiles(id) on delete cascade,
  approve boolean not null,
  created_at timestamptz not null default now(),
  primary key (vote_id, voter_profile_id)
);

create or replace function public.generate_social_friend_code()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
    exit when not exists (select 1 from public.social_profiles where friend_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.create_social_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.social_profiles (auth_user_id, friend_code)
  values (new.id, public.generate_social_friend_code())
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_social_profile_after_auth_user on auth.users;
create trigger create_social_profile_after_auth_user
  after insert on auth.users
  for each row execute function public.create_social_profile_for_auth_user();

insert into public.social_profiles (auth_user_id, friend_code)
select id, public.generate_social_friend_code()
from auth.users
on conflict (auth_user_id) do nothing;

create or replace function public.current_social_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.social_profiles where auth_user_id = auth.uid();
$$;

create or replace function public.are_social_friends(left_id uuid, right_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.social_friendships
    where profile_low = least(left_id, right_id)
      and profile_high = greatest(left_id, right_id)
  );
$$;

create or replace function public.share_social_room(left_id uuid, right_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.social_room_members a
    join public.social_room_members b on b.room_id = a.room_id
    join public.social_rooms r on r.id = a.room_id
    where a.profile_id = left_id and a.left_at is null
      and b.profile_id = right_id and b.left_at is null
      and r.phase in ('waiting', 'active')
  );
$$;

create or replace function public.is_social_room_member(target_room_id uuid, target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.social_room_members
    where room_id = target_room_id and profile_id = target_profile_id and left_at is null
  );
$$;

create or replace function public.social_profile_json(profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'nickname', p.nickname,
    'friendCode', case when p.id=public.current_social_profile_id() then p.friend_code else '' end,
    'availabilityUntil', p.availability_until,
    'pet', jsonb_build_object(
      'name', p.pet_name,
      'visualKey', p.pet_visual_key,
      'stage', p.pet_stage,
      'storyChapter', p.pet_story_chapter,
      'symbol', p.pet_symbol
    )
  )
  from public.social_profiles p where p.id = profile_id;
$$;

create or replace function public.social_distance_meters(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision
language sql
immutable
as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

create or replace function public.social_room_json(target_room_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'phase', r.phase,
    'mode', r.mode,
    'durationMinutes', r.duration_minutes,
    'difficulty', r.difficulty,
    'destinationName', r.destination_name,
    'destination', case when r.destination_latitude is null then null else jsonb_build_object('latitude', r.destination_latitude, 'longitude', r.destination_longitude) end,
    'createdAt', r.created_at,
    'startedAt', r.started_at,
    'expectedEndAt', r.expected_end_at,
    'maxEndAt', r.max_end_at,
    'completedAt', r.completed_at,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profile', public.social_profile_json(m.profile_id),
        'joinedAt', m.joined_at,
        'readyAt', m.ready_at,
        'leftAt', m.left_at,
        'arrivedAt', m.arrived_at,
        'isHost', m.profile_id = r.host_profile_id,
        'location', case
          when l.captured_at is null or l.captured_at < now() - interval '5 minutes' then null
          else jsonb_build_object(
            'profileId', l.profile_id,
            'latitude', l.latitude,
            'longitude', l.longitude,
            'accuracyMeters', l.accuracy_meters,
            'timestamp', l.captured_at
          )
        end
      ) order by m.joined_at)
      from public.social_room_members m
      left join public.social_room_locations l on l.room_id = m.room_id and l.profile_id = m.profile_id
      where m.room_id = r.id and m.left_at is null
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'kind', t.kind,
        'title', t.title,
        'prompt', t.prompt,
        'required', t.required,
        'stepTarget', t.step_target,
        'activeMinuteTarget', t.active_minute_target,
        'status', case when (
          select count(distinct c.profile_id)
          from public.social_task_completions c
          join public.social_room_members cm on cm.room_id = r.id and cm.profile_id = c.profile_id and cm.left_at is null
          where c.task_id = t.id
        ) >= (select count(*) from public.social_room_members am where am.room_id = r.id and am.left_at is null)
        then 'completed' else 'pending' end
      ) order by t.sequence)
      from public.social_room_tasks t where t.room_id = r.id
    ), '[]'::jsonb)
  ) from public.social_rooms r where r.id = target_room_id;
$$;

create or replace function public.get_social_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_social_profile_id();
  room_id uuid;
begin
  if me is null then raise exception 'social_profile_missing'; end if;

  update public.social_friend_requests set status = 'expired'
  where status = 'pending' and expires_at <= now() and (sender_id = me or recipient_id = me);
  update public.social_room_invites set status = 'expired'
  where status = 'pending' and expires_at <= now() and recipient_id = me;
  update public.social_rooms set phase = 'closed', closed_at = now()
  where phase = 'waiting' and lobby_expires_at <= now();

  select m.room_id into room_id
  from public.social_room_members m
  join public.social_rooms r on r.id = m.room_id
  where m.profile_id = me and m.left_at is null and r.phase in ('waiting', 'active', 'completed')
  order by r.created_at desc limit 1;

  return jsonb_build_object(
    'profile', public.social_profile_json(me),
    'friends', coalesce((
      with friend_ids as (
        select case when f.profile_low = me then f.profile_high else f.profile_low end as friend_id
        from public.social_friendships f where f.profile_low = me or f.profile_high = me
      )
      select jsonb_agg(jsonb_build_object(
        'profile', public.social_profile_json(fi.friend_id),
        'category', coalesce(l.category, 'friend'),
        'favorite', coalesce(l.favorite, false)
      ) order by coalesce(l.favorite, false) desc, (public.social_profile_json(fi.friend_id)->>'nickname'))
      from friend_ids fi
      left join public.social_friend_labels l on l.owner_id = me and l.friend_id = fi.friend_id
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'sender', public.social_profile_json(q.sender_id),
        'createdAt', q.created_at,
        'expiresAt', q.expires_at
      ) order by q.created_at desc)
      from public.social_friend_requests q
      where q.recipient_id = me and q.status = 'pending' and q.expires_at > now()
    ), '[]'::jsonb),
    'roomInvites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'roomId', r.id,
        'host', public.social_profile_json(r.host_profile_id),
        'mode', r.mode,
        'durationMinutes', r.duration_minutes,
        'difficulty', r.difficulty,
        'destinationName', r.destination_name,
        'expiresAt', i.expires_at
      ) order by i.created_at desc)
      from public.social_room_invites i
      join public.social_rooms r on r.id = i.room_id
      where i.recipient_id = me and i.status = 'pending' and i.expires_at > now() and r.phase = 'waiting'
    ), '[]'::jsonb),
    'activeRoom', case when room_id is null then null else public.social_room_json(room_id) end
  );
end;
$$;

create or replace function public.update_social_nickname(p_nickname text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(p_nickname)) not between 1 and 24 then raise exception 'invalid_nickname'; end if;
  update public.social_profiles set nickname = trim(p_nickname), updated_at = now()
  where id = public.current_social_profile_id();
end;
$$;

create or replace function public.set_social_recovery_hash(p_secret_hash text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if lower(p_secret_hash) !~ '^[a-f0-9]{64}$' then raise exception 'invalid_recovery_hash'; end if;
  insert into public.social_recovery (profile_id, secret_hash)
  values (public.current_social_profile_id(), lower(p_secret_hash))
  on conflict (profile_id) do update set secret_hash = excluded.secret_hash, created_at = now();
end;
$$;

create or replace function public.recover_social_profile(p_secret_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  fresh_profile uuid := public.current_social_profile_id();
  recovered_profile uuid;
begin
  select profile_id into recovered_profile from public.social_recovery where secret_hash = lower(p_secret_hash);
  if recovered_profile is null then return false; end if;
  if recovered_profile = fresh_profile then return true; end if;
  if exists (select 1 from public.social_friendships where profile_low = fresh_profile or profile_high = fresh_profile)
    or exists (select 1 from public.social_room_members where profile_id = fresh_profile) then
    raise exception 'current_profile_not_empty';
  end if;
  delete from public.social_profiles where id = fresh_profile;
  update public.social_profiles set auth_user_id = auth.uid(), updated_at = now() where id = recovered_profile;
  return true;
end;
$$;

create or replace function public.rotate_social_friend_code()
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  code := public.generate_social_friend_code();
  update public.social_profiles set friend_code = code, updated_at = now() where id = public.current_social_profile_id();
  return code;
end;
$$;

create or replace function public.set_social_availability(p_hours integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_hours not in (0, 1, 4, 8) then raise exception 'invalid_availability'; end if;
  update public.social_profiles
  set availability_until = case when p_hours = 0 then null else now() + make_interval(hours => p_hours) end,
      updated_at = now()
  where id = public.current_social_profile_id();
end;
$$;

create or replace function public.social_friend_count(profile_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.social_friendships where profile_low = profile_id or profile_high = profile_id;
$$;

create or replace function public.send_social_friend_request(p_friend_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_social_profile_id();
  recipient uuid;
  request_id uuid;
begin
  select id into recipient from public.social_profiles where friend_code = upper(regexp_replace(p_friend_code, '[^A-Za-z0-9]', '', 'g'));
  if recipient is null or recipient = me then raise exception 'invalid_friend_code'; end if;
  perform id from public.social_profiles where id in (me, recipient) order by id for update;
  update public.social_friend_requests set status = 'expired' where status = 'pending' and expires_at <= now() and (sender_id = me or recipient_id = me);
  if public.social_friend_count(me) >= 50 then raise exception 'friend_limit_reached'; end if;
  if public.are_social_friends(me, recipient) then raise exception 'already_friends'; end if;
  if exists (select 1 from public.social_blocks where (blocker_id = me and blocked_id = recipient) or (blocker_id = recipient and blocked_id = me)) then raise exception 'blocked'; end if;
  if (select count(*) from public.social_friend_requests where sender_id = me and created_at >= (date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei')) >= 10 then raise exception 'daily_invite_limit'; end if;
  if exists (select 1 from public.social_friend_requests where sender_id = me and recipient_id = recipient and status = 'declined' and responded_at > now() - interval '24 hours') then raise exception 'invite_cooldown'; end if;
  insert into public.social_friend_requests (sender_id, recipient_id)
  values (me, recipient) returning id into request_id;
  return request_id;
end;
$$;

create or replace function public.respond_social_friend_request(p_request_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_social_profile_id();
  request public.social_friend_requests%rowtype;
begin
  select * into request from public.social_friend_requests where id = p_request_id for update;
  if request.id is null or request.recipient_id <> me or request.status <> 'pending' or request.expires_at <= now() then raise exception 'request_unavailable'; end if;
  if p_action = 'accept' then
    perform id from public.social_profiles where id in (me, request.sender_id) order by id for update;
    if exists (select 1 from public.social_blocks where (blocker_id = me and blocked_id = request.sender_id) or (blocker_id = request.sender_id and blocked_id = me)) then raise exception 'blocked'; end if;
    if public.social_friend_count(me) >= 50 or public.social_friend_count(request.sender_id) >= 50 then raise exception 'friend_limit_reached'; end if;
    insert into public.social_friendships (profile_low, profile_high)
    values (least(me, request.sender_id), greatest(me, request.sender_id)) on conflict do nothing;
    update public.social_friend_requests set status = 'accepted', responded_at = now() where id = request.id;
  elsif p_action = 'decline' then
    update public.social_friend_requests set status = 'declined', responded_at = now() where id = request.id;
  elsif p_action = 'block' then
    insert into public.social_blocks (blocker_id, blocked_id) values (me, request.sender_id) on conflict do nothing;
    delete from public.social_friendships where profile_low = least(me, request.sender_id) and profile_high = greatest(me, request.sender_id);
    update public.social_friend_requests set status = 'blocked', responded_at = now() where id = request.id;
  else raise exception 'invalid_action';
  end if;
end;
$$;

create or replace function public.update_social_friend_label(p_friend_profile_id uuid, p_category text, p_favorite boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public.current_social_profile_id();
begin
  if p_category not in ('family', 'friend', 'coworker') or not public.are_social_friends(me, p_friend_profile_id) then raise exception 'invalid_friend_label'; end if;
  insert into public.social_friend_labels (owner_id, friend_id, category, favorite)
  values (me, p_friend_profile_id, p_category, p_favorite)
  on conflict (owner_id, friend_id) do update set category = excluded.category, favorite = excluded.favorite, updated_at = now();
end;
$$;

create or replace function public.create_social_room(
  p_mode text,
  p_duration_minutes integer,
  p_difficulty text,
  p_destination_name text,
  p_destination_latitude double precision,
  p_destination_longitude double precision,
  p_tasks jsonb,
  p_invited_profile_ids uuid[]
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_social_profile_id();
  room_id uuid;
  task jsonb;
  task_index integer := 0;
  invitee uuid;
  expected_required integer;
begin
  if p_mode not in ('gather', 'sharedStart') or p_duration_minutes not in (30,60,90,120) or p_difficulty not in ('relaxed','standard','challenge') then raise exception 'invalid_room_settings'; end if;
  perform id from public.social_profiles where id = me for update;
  if p_destination_latitude is null or p_destination_longitude is null or p_destination_latitude not between -90 and 90 or p_destination_longitude not between -180 and 180 then raise exception 'invalid_destination'; end if;
  if char_length(trim(p_destination_name)) not between 1 and 80 then raise exception 'invalid_destination'; end if;
  if coalesce(array_length(p_invited_profile_ids, 1), 0) > 5 then raise exception 'room_member_limit'; end if;
  if exists (select 1 from public.social_room_members m join public.social_rooms r on r.id = m.room_id where m.profile_id = me and m.left_at is null and r.phase in ('waiting','active')) then raise exception 'already_in_room'; end if;
  expected_required := case p_duration_minutes when 30 then 2 when 60 then 3 when 90 then 4 else 5 end;
  if p_tasks is null or jsonb_typeof(p_tasks)<>'array' then raise exception 'invalid_task_count'; end if;
  if jsonb_array_length(p_tasks) < expected_required or jsonb_array_length(p_tasks) > expected_required + 2 then raise exception 'invalid_task_count'; end if;
  if (select count(*) from jsonb_array_elements(p_tasks) t where coalesce((t->>'required')::boolean, true)) <> expected_required then raise exception 'invalid_task_count'; end if;
  if exists (select 1 from jsonb_array_elements(p_tasks) t where (t->>'kind' = 'steps' and (t->>'stepTarget')::integer is distinct from 300) or (t->>'kind' = 'activeMinutes' and (t->>'activeMinuteTarget')::integer is distinct from 5)) then raise exception 'invalid_physical_target'; end if;
  insert into public.social_rooms (host_profile_id, mode, duration_minutes, difficulty, destination_name, destination_latitude, destination_longitude)
  values (me, p_mode, p_duration_minutes, p_difficulty, trim(p_destination_name), p_destination_latitude, p_destination_longitude)
  returning id into room_id;
  insert into public.social_room_members (room_id, profile_id) values (room_id, me);
  for task in select * from jsonb_array_elements(p_tasks) loop
    insert into public.social_room_tasks (room_id, sequence, kind, title, prompt, required, step_target, active_minute_target)
    values (room_id, task_index, task->>'kind', task->>'title', task->>'prompt', coalesce((task->>'required')::boolean, true), nullif(task->>'stepTarget','')::integer, nullif(task->>'activeMinuteTarget','')::integer);
    task_index := task_index + 1;
  end loop;
  foreach invitee in array coalesce(p_invited_profile_ids, array[]::uuid[]) loop
    if not public.are_social_friends(me, invitee) then raise exception 'invitee_not_friend'; end if;
    insert into public.social_room_invites (room_id, sender_id, recipient_id) values (room_id, me, invitee);
  end loop;
  return room_id;
end;
$$;

create or replace function public.respond_social_room_invite(p_invite_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_social_profile_id();
  invite public.social_room_invites%rowtype;
begin
  select * into invite from public.social_room_invites where id = p_invite_id for update;
  if invite.id is null or invite.recipient_id <> me or invite.status <> 'pending' or invite.expires_at <= now() then raise exception 'invite_unavailable'; end if;
  if not p_accept then update public.social_room_invites set status = 'declined', responded_at = now() where id = invite.id; return; end if;
  perform id from public.social_profiles where id = me for update;
  perform id from public.social_rooms where id = invite.room_id for update;
  if not public.are_social_friends(me, invite.sender_id) then raise exception 'invitee_not_friend'; end if;
  if exists (select 1 from public.social_room_members m join public.social_rooms r on r.id = m.room_id where m.profile_id = me and m.left_at is null and r.phase in ('waiting','active')) then raise exception 'already_in_room'; end if;
  if (select lobby_expires_at from public.social_rooms where id = invite.room_id) <= now() then raise exception 'invite_unavailable'; end if;
  if (select phase from public.social_rooms where id = invite.room_id) <> 'waiting' then raise exception 'room_already_started'; end if;
  if (select count(*) from public.social_room_members where room_id = invite.room_id and left_at is null) >= 6 then raise exception 'room_member_limit'; end if;
  insert into public.social_room_members (room_id, profile_id) values (invite.room_id, me) on conflict do nothing;
  update public.social_room_invites set status = 'accepted', responded_at = now() where id = invite.id;
end;
$$;

create or replace function public.set_social_room_ready(p_room_id uuid, p_ready boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select phase from public.social_rooms where id = p_room_id) <> 'waiting' then raise exception 'room_not_waiting'; end if;
  update public.social_room_members set ready_at = case when p_ready then now() else null end
  where room_id = p_room_id and profile_id = public.current_social_profile_id() and left_at is null;
  if not found then raise exception 'not_room_member'; end if;
end;
$$;

create or replace function public.start_social_room(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  room public.social_rooms%rowtype;
  first_location public.social_room_locations%rowtype;
  member_location public.social_room_locations%rowtype;
begin
  select * into room from public.social_rooms where id = p_room_id for update;
  if room.host_profile_id <> public.current_social_profile_id() or room.phase <> 'waiting' or room.lobby_expires_at <= now() then raise exception 'cannot_start_room'; end if;
  if (select count(*) from public.social_room_members where room_id = p_room_id and left_at is null) not between 2 and 6 then raise exception 'invalid_member_count'; end if;
  if exists (select 1 from public.social_room_members where room_id = p_room_id and left_at is null and ready_at is null) then raise exception 'members_not_ready'; end if;
  if exists (select 1 from public.social_room_members where room_id=p_room_id and left_at is null and location_issue is not null) then raise exception 'fresh_locations_required'; end if;
  if exists (select 1 from public.social_room_members m left join public.social_room_locations l on l.room_id = m.room_id and l.profile_id = m.profile_id where m.room_id = p_room_id and m.left_at is null and (l.captured_at is null or l.captured_at < now() - interval '2 minutes' or l.accuracy_meters is null or l.accuracy_meters > 100)) then raise exception 'fresh_locations_required'; end if;
  if room.mode = 'sharedStart' then
    if exists (select 1 from public.social_room_locations a join public.social_room_locations b on b.room_id = a.room_id and b.profile_id <> a.profile_id join public.social_room_members am on am.room_id = a.room_id and am.profile_id = a.profile_id and am.left_at is null join public.social_room_members bm on bm.room_id = b.room_id and bm.profile_id = b.profile_id and bm.left_at is null where a.room_id = p_room_id and public.social_distance_meters(a.latitude, a.longitude, b.latitude, b.longitude) > 100) then raise exception 'members_not_within_100m'; end if;
    select l.* into first_location from public.social_room_locations l join public.social_room_members m on m.room_id = l.room_id and m.profile_id = l.profile_id where l.room_id = p_room_id and m.left_at is null order by m.joined_at limit 1;
    if first_location.captured_at is null or first_location.captured_at < now() - interval '2 minutes' then raise exception 'fresh_locations_required'; end if;
    for member_location in select l.* from public.social_room_locations l join public.social_room_members m on m.room_id = l.room_id and m.profile_id = l.profile_id where l.room_id = p_room_id and m.left_at is null loop
      if member_location.captured_at < now() - interval '2 minutes' or public.social_distance_meters(first_location.latitude, first_location.longitude, member_location.latitude, member_location.longitude) > 100 then raise exception 'members_not_within_100m'; end if;
    end loop;
  end if;
  update public.social_rooms set phase = 'active', started_at = now() + interval '10 seconds', expected_end_at = now() + interval '10 seconds' + make_interval(mins => room.duration_minutes), max_end_at = now() + interval '4 hours 10 seconds' where id = p_room_id;
end;
$$;

create or replace function public.publish_social_location(p_room_id uuid, p_latitude double precision, p_longitude double precision, p_accuracy_meters double precision, p_captured_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_social_profile_id();
  room public.social_rooms%rowtype;
  current_member public.social_room_members%rowtype;
  inside boolean := false;
begin
  select * into room from public.social_rooms where id = p_room_id;
  select * into current_member from public.social_room_members where room_id = p_room_id and profile_id = me and left_at is null;
  if room.id is null or current_member.profile_id is null or room.phase not in ('waiting','active') then raise exception 'location_not_allowed'; end if;
  if p_captured_at < now() - interval '5 minutes' or p_captured_at > now() + interval '1 minute' then raise exception 'invalid_location_time'; end if;
  insert into public.social_room_locations (room_id, profile_id, latitude, longitude, accuracy_meters, captured_at)
  values (p_room_id, me, p_latitude, p_longitude, p_accuracy_meters, p_captured_at)
  on conflict (room_id, profile_id) do update set latitude = excluded.latitude, longitude = excluded.longitude, accuracy_meters = excluded.accuracy_meters, captured_at = excluded.captured_at, updated_at = now()
  where excluded.captured_at > social_room_locations.captured_at;
  if room.phase = 'active' and room.destination_latitude is not null and coalesce(p_accuracy_meters, 0) <= 100 then
    inside := public.social_distance_meters(p_latitude, p_longitude, room.destination_latitude, room.destination_longitude) <= 60;
    if inside and current_member.arrival_entered_at is null then
      update public.social_room_members set arrival_entered_at = p_captured_at where room_id = p_room_id and profile_id = me;
    elsif inside and p_captured_at >= current_member.arrival_entered_at + interval '30 seconds' then
      update public.social_room_members set arrived_at = coalesce(arrived_at, p_captured_at) where room_id = p_room_id and profile_id = me;
    elsif not inside then
      update public.social_room_members set arrival_entered_at = null where room_id = p_room_id and profile_id = me and arrived_at is null;
    end if;
  end if;
end;
$$;

create or replace function public.complete_social_task(p_room_id uuid, p_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public.current_social_profile_id();
begin
  if not exists (select 1 from public.social_room_members where room_id = p_room_id and profile_id = me and left_at is null) then raise exception 'not_room_member'; end if;
  if not exists (select 1 from public.social_room_tasks where id = p_task_id and room_id = p_room_id) then raise exception 'task_not_found'; end if;
  insert into public.social_task_completions (task_id, profile_id) values (p_task_id, me) on conflict do nothing;
end;
$$;

create or replace function public.finish_social_room(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public.current_social_profile_id();
begin
  if not exists (select 1 from public.social_room_members where room_id = p_room_id and profile_id = me and left_at is null) then raise exception 'not_room_member'; end if;
  if exists (select 1 from public.social_room_members where room_id = p_room_id and left_at is null and arrived_at is null) then raise exception 'members_not_arrived'; end if;
  if exists (
    select 1 from public.social_room_tasks t
    where t.room_id = p_room_id and t.required and (
      select count(distinct c.profile_id) from public.social_task_completions c
      join public.social_room_members m on m.room_id = p_room_id and m.profile_id = c.profile_id and m.left_at is null
      where c.task_id = t.id
    ) < (select count(*) from public.social_room_members where room_id = p_room_id and left_at is null)
  ) then raise exception 'required_tasks_incomplete'; end if;
  update public.social_rooms set phase = 'completed', completed_at = now() where id = p_room_id and phase = 'active';
end;
$$;

create or replace function public.leave_social_room(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_social_profile_id();
  remaining integer;
  next_host uuid;
begin
  update public.social_room_members set left_at = now() where room_id = p_room_id and profile_id = me and left_at is null;
  if not found then raise exception 'not_room_member'; end if;
  select count(*) into remaining from public.social_room_members where room_id = p_room_id and left_at is null;
  if remaining <= 1 then
    update public.social_room_members set left_at = now() where room_id = p_room_id and left_at is null;
    update public.social_rooms set phase = 'closed', closed_at = now() where id = p_room_id;
    return;
  end if;
  if (select host_profile_id from public.social_rooms where id = p_room_id) = me then
    select profile_id into next_host from public.social_room_members where room_id = p_room_id and left_at is null order by joined_at limit 1;
    update public.social_rooms set host_profile_id = next_host where id = p_room_id;
  end if;
end;
$$;

alter table public.social_profiles enable row level security;
alter table public.social_recovery enable row level security;
alter table public.social_friend_requests enable row level security;
alter table public.social_friendships enable row level security;
alter table public.social_friend_labels enable row level security;
alter table public.social_blocks enable row level security;
alter table public.social_rooms enable row level security;
alter table public.social_room_members enable row level security;
alter table public.social_room_invites enable row level security;
alter table public.social_room_locations enable row level security;
alter table public.social_room_tasks enable row level security;
alter table public.social_task_completions enable row level security;
alter table public.social_kick_votes enable row level security;
alter table public.social_kick_ballots enable row level security;

drop policy if exists social_profiles_read on public.social_profiles;
create policy social_profiles_read on public.social_profiles for select to authenticated using (
  id = public.current_social_profile_id()
  or public.are_social_friends(id, public.current_social_profile_id())
  or public.share_social_room(id, public.current_social_profile_id())
);
drop policy if exists social_friend_requests_read on public.social_friend_requests;
create policy social_friend_requests_read on public.social_friend_requests for select to authenticated using (sender_id = public.current_social_profile_id() or recipient_id = public.current_social_profile_id());
drop policy if exists social_friendships_read on public.social_friendships;
create policy social_friendships_read on public.social_friendships for select to authenticated using (profile_low = public.current_social_profile_id() or profile_high = public.current_social_profile_id());
drop policy if exists social_friend_labels_read on public.social_friend_labels;
create policy social_friend_labels_read on public.social_friend_labels for select to authenticated using (owner_id = public.current_social_profile_id());
drop policy if exists social_blocks_read on public.social_blocks;
create policy social_blocks_read on public.social_blocks for select to authenticated using (blocker_id = public.current_social_profile_id());
drop policy if exists social_rooms_read on public.social_rooms;
create policy social_rooms_read on public.social_rooms for select to authenticated using (public.is_social_room_member(id, public.current_social_profile_id()));
drop policy if exists social_room_members_read on public.social_room_members;
create policy social_room_members_read on public.social_room_members for select to authenticated using (public.is_social_room_member(room_id, public.current_social_profile_id()));
drop policy if exists social_room_invites_read on public.social_room_invites;
create policy social_room_invites_read on public.social_room_invites for select to authenticated using (sender_id = public.current_social_profile_id() or recipient_id = public.current_social_profile_id());
drop policy if exists social_room_locations_read on public.social_room_locations;
create policy social_room_locations_read on public.social_room_locations for select to authenticated using (public.is_social_room_member(room_id, public.current_social_profile_id()));
drop policy if exists social_room_tasks_read on public.social_room_tasks;
create policy social_room_tasks_read on public.social_room_tasks for select to authenticated using (public.is_social_room_member(room_id, public.current_social_profile_id()));
drop policy if exists social_task_completions_read on public.social_task_completions;
create policy social_task_completions_read on public.social_task_completions for select to authenticated using (exists (select 1 from public.social_room_tasks t join public.social_room_members mine on mine.room_id = t.room_id where t.id = task_id and mine.profile_id = public.current_social_profile_id() and mine.left_at is null));

revoke all on public.social_recovery from anon, authenticated;
revoke insert, update, delete on public.social_profiles, public.social_friend_requests, public.social_friendships, public.social_friend_labels, public.social_blocks, public.social_rooms, public.social_room_members, public.social_room_invites, public.social_room_locations, public.social_room_tasks, public.social_task_completions, public.social_kick_votes, public.social_kick_ballots from anon, authenticated;
grant select on public.social_profiles, public.social_friend_requests, public.social_friendships, public.social_friend_labels, public.social_blocks, public.social_rooms, public.social_room_members, public.social_room_invites, public.social_room_locations, public.social_room_tasks, public.social_task_completions, public.social_kick_votes, public.social_kick_ballots to authenticated;
revoke execute on function public.generate_social_friend_code() from public;
revoke execute on function public.create_social_profile_for_auth_user() from public;
revoke execute on function public.current_social_profile_id() from public;
revoke execute on function public.are_social_friends(uuid, uuid) from public;
revoke execute on function public.share_social_room(uuid, uuid) from public;
revoke execute on function public.is_social_room_member(uuid, uuid) from public;
revoke execute on function public.social_profile_json(uuid) from public;
revoke execute on function public.social_distance_meters(double precision, double precision, double precision, double precision) from public;
revoke execute on function public.social_room_json(uuid) from public;
revoke execute on function public.get_social_snapshot() from public;
revoke execute on function public.update_social_nickname(text) from public;
revoke execute on function public.set_social_recovery_hash(text) from public;
revoke execute on function public.recover_social_profile(text) from public;
revoke execute on function public.rotate_social_friend_code() from public;
revoke execute on function public.set_social_availability(integer) from public;
revoke execute on function public.social_friend_count(uuid) from public;
revoke execute on function public.send_social_friend_request(text) from public;
revoke execute on function public.respond_social_friend_request(uuid, text) from public;
revoke execute on function public.update_social_friend_label(uuid, text, boolean) from public;
revoke execute on function public.create_social_room(text, integer, text, text, double precision, double precision, jsonb, uuid[]) from public;
revoke execute on function public.respond_social_room_invite(uuid, boolean) from public;
revoke execute on function public.set_social_room_ready(uuid, boolean) from public;
revoke execute on function public.start_social_room(uuid) from public;
revoke execute on function public.publish_social_location(uuid, double precision, double precision, double precision, timestamptz) from public;
revoke execute on function public.complete_social_task(uuid, uuid) from public;
revoke execute on function public.finish_social_room(uuid) from public;
revoke execute on function public.leave_social_room(uuid) from public;
grant execute on function public.get_social_snapshot() to authenticated;
grant execute on function public.update_social_nickname(text) to authenticated;
grant execute on function public.set_social_recovery_hash(text) to authenticated;
grant execute on function public.recover_social_profile(text) to authenticated;
grant execute on function public.rotate_social_friend_code() to authenticated;
grant execute on function public.set_social_availability(integer) to authenticated;
grant execute on function public.send_social_friend_request(text) to authenticated;
grant execute on function public.respond_social_friend_request(uuid, text) to authenticated;
grant execute on function public.update_social_friend_label(uuid, text, boolean) to authenticated;
grant execute on function public.create_social_room(text, integer, text, text, double precision, double precision, jsonb, uuid[]) to authenticated;
grant execute on function public.respond_social_room_invite(uuid, boolean) to authenticated;
grant execute on function public.set_social_room_ready(uuid, boolean) to authenticated;
grant execute on function public.start_social_room(uuid) to authenticated;
grant execute on function public.publish_social_location(uuid, double precision, double precision, double precision, timestamptz) to authenticated;
grant execute on function public.complete_social_task(uuid, uuid) to authenticated;
grant execute on function public.finish_social_room(uuid) to authenticated;
grant execute on function public.leave_social_room(uuid) to authenticated;

alter publication supabase_realtime add table public.social_friend_requests;
alter publication supabase_realtime add table public.social_friendships;
alter publication supabase_realtime add table public.social_rooms;
alter publication supabase_realtime add table public.social_room_members;
alter publication supabase_realtime add table public.social_room_locations;
alter publication supabase_realtime add table public.social_room_tasks;
alter publication supabase_realtime add table public.social_task_completions;
