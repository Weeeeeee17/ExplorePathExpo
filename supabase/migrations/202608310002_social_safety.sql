-- Apply after 001. All sensitive reads go through a caller-scoped snapshot.
alter table public.social_rooms add column solo boolean not null default false;
alter table public.social_room_members add column last_seen_at timestamptz not null default now();
alter table public.social_room_members add column last_location_at timestamptz;
alter table public.social_room_members add column location_issue text;

create table public.social_qr_tokens (
  token_hash text primary key, profile_id uuid not null references public.social_profiles(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '10 minutes', uses integer not null default 0 check (uses between 0 and 5)
);
create table public.social_health_summaries (
  room_id uuid references public.social_rooms(id) on delete cascade, profile_id uuid references public.social_profiles(id) on delete cascade,
  steps integer not null default 0 check (steps >= 0), active_seconds integer not null default 0 check (active_seconds >= 0),
  primary key(room_id, profile_id)
);
create table public.social_location_shares (
  id uuid primary key default gen_random_uuid(), requester_id uuid not null references public.social_profiles(id) on delete cascade,
  recipient_id uuid not null references public.social_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','revoked','expired')),
  hours integer not null check (hours in (1,4,8)), expires_at timestamptz not null default now() + interval '15 minutes',
  requester_precise boolean not null default false, recipient_precise boolean not null default false,
  created_at timestamptz not null default now(), check (requester_id <> recipient_id)
);
create unique index social_one_share_pair on public.social_location_shares(least(requester_id, recipient_id), greatest(requester_id, recipient_id)) where status in ('pending','active');
create table public.social_shared_locations (
  share_id uuid references public.social_location_shares(id) on delete cascade, profile_id uuid references public.social_profiles(id) on delete cascade,
  latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
  captured_at timestamptz not null, primary key(share_id, profile_id)
);
alter table public.social_qr_tokens enable row level security;
alter table public.social_health_summaries enable row level security;
alter table public.social_location_shares enable row level security;
alter table public.social_shared_locations enable row level security;

create function public.social_is_blocked(a uuid, b uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.social_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;

create function public.social_stop_room_positions() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.phase in ('completed','closed') then
    delete from public.social_room_locations where room_id=new.id;
    update public.social_room_members set ready_at=null, arrival_entered_at=null where room_id=new.id;
    update public.social_room_invites set status='expired' where room_id=new.id and status='pending';
  end if;
  return new;
end $$;
create trigger social_room_end_privacy after update of phase on public.social_rooms for each row execute function public.social_stop_room_positions();

create function public.social_invalidate_qr() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.friend_code <> old.friend_code then delete from public.social_qr_tokens where profile_id=new.id; end if;
  return new;
end $$;
create trigger social_rotated_code after update of friend_code on public.social_profiles for each row execute function public.social_invalidate_qr();

create function public.create_social_friend_qr() returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare me uuid:=public.current_social_profile_id(); token text:=encode(gen_random_bytes(24),'hex');
begin
  if me is null then raise exception 'social_profile_missing'; end if;
  delete from public.social_qr_tokens where profile_id=me;
  insert into public.social_qr_tokens(token_hash,profile_id) values(encode(digest(token,'sha256'),'hex'),me);
  return jsonb_build_object('token',token,'expiresAt',now()+interval '10 minutes');
end $$;

create function public.send_social_qr_request(p_token text) returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare q public.social_qr_tokens%rowtype; request_id uuid; code text;
begin
  select * into q from public.social_qr_tokens where token_hash=encode(digest(p_token,'sha256'),'hex') for update;
  if q.profile_id is null or q.expires_at<=now() or q.uses>=5 then raise exception 'qr_expired'; end if;
  select friend_code into code from public.social_profiles where id=q.profile_id;
  request_id:=public.send_social_friend_request(code);
  update public.social_qr_tokens set uses=uses+1 where token_hash=q.token_hash;
  return request_id;
end $$;

create function public.remove_social_friend(p_friend_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_social_profile_id();
begin
  delete from public.social_friendships where profile_low=least(me,p_friend_id) and profile_high=greatest(me,p_friend_id);
  delete from public.social_friend_labels where (owner_id=me and friend_id=p_friend_id) or (owner_id=p_friend_id and friend_id=me);
  update public.social_location_shares set status='revoked' where least(requester_id,recipient_id)=least(me,p_friend_id) and greatest(requester_id,recipient_id)=greatest(me,p_friend_id) and status in ('pending','active');
  delete from public.social_shared_locations l using public.social_location_shares s where l.share_id=s.id and s.status='revoked';
end $$;

create function public.social_settle_members(p_room_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare r public.social_rooms%rowtype; remaining integer; next_host uuid;
begin
  select * into r from public.social_rooms where id=p_room_id for update;
  select count(*) into remaining from public.social_room_members where room_id=p_room_id and left_at is null;
  if remaining=0 then
    update public.social_rooms set phase='closed',closed_at=now() where id=p_room_id and phase in ('waiting','active'); return;
  end if;
  if remaining=1 and r.phase='active' then update public.social_rooms set solo=true where id=p_room_id; end if;
  if not exists(select 1 from public.social_room_members where room_id=p_room_id and profile_id=r.host_profile_id and left_at is null and last_seen_at>now()-interval '5 minutes') then
    select profile_id into next_host from public.social_room_members where room_id=p_room_id and left_at is null and last_seen_at>now()-interval '5 minutes' order by joined_at limit 1;
    if next_host is not null then update public.social_rooms set host_profile_id=next_host where id=p_room_id; end if;
  end if;
end $$;

create or replace function public.leave_social_room(p_room_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_social_profile_id();
begin
  perform id from public.social_rooms where id=p_room_id for update;
  update public.social_room_members set left_at=now(),ready_at=null where room_id=p_room_id and profile_id=me and left_at is null;
  if not found then raise exception 'not_room_member'; end if;
  delete from public.social_room_locations where room_id=p_room_id and profile_id=me;
  perform public.social_settle_members(p_room_id);
end $$;

create function public.social_settle_vote(p_vote_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v public.social_kick_votes%rowtype; eligible integer; approvals integer;
begin
  select * into v from public.social_kick_votes where id=p_vote_id for update;
  if v.status<>'open' then return; end if;
  if v.expires_at<=now() then update public.social_kick_votes set status='failed',resolved_at=now() where id=v.id; return; end if;
  select count(*) into eligible from public.social_room_members where room_id=v.room_id and left_at is null and profile_id<>v.target_profile_id;
  select count(*) into approvals from public.social_kick_ballots b join public.social_room_members m on m.room_id=v.room_id and m.profile_id=b.voter_profile_id and m.left_at is null where b.vote_id=v.id and b.approve and b.voter_profile_id<>v.target_profile_id;
  if eligible>0 and approvals>eligible/2 then
    update public.social_kick_votes set status='passed',resolved_at=now() where id=v.id;
    update public.social_room_members set left_at=now(),ready_at=null where room_id=v.room_id and profile_id=v.target_profile_id;
    delete from public.social_room_locations where room_id=v.room_id and profile_id=v.target_profile_id;
    perform public.social_settle_members(v.room_id);
  end if;
end $$;

create function public.block_social_profile(p_target_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_social_profile_id(); r record; vote_id uuid;
begin
  if me is null or me=p_target_id or not exists(select 1 from public.social_profiles where id=p_target_id) then raise exception 'invalid_target'; end if;
  insert into public.social_blocks(blocker_id,blocked_id) values(me,p_target_id) on conflict do nothing;
  perform public.remove_social_friend(p_target_id);
  update public.social_friend_requests set status='blocked',responded_at=now() where status='pending' and least(sender_id,recipient_id)=least(me,p_target_id) and greatest(sender_id,recipient_id)=greatest(me,p_target_id);
  for r in select a.room_id from public.social_room_members a join public.social_room_members b on b.room_id=a.room_id join public.social_rooms room on room.id=a.room_id where a.profile_id=me and b.profile_id=p_target_id and a.left_at is null and b.left_at is null and room.phase in ('waiting','active') loop
    perform id from public.social_rooms where id=r.room_id for update;
    update public.social_kick_votes set status='failed',resolved_at=now() where room_id=r.room_id and status='open' and expires_at<=now();
    if not exists(select 1 from public.social_kick_votes where room_id=r.room_id and target_profile_id=p_target_id and (status='open' or coalesce(resolved_at,created_at)>now()-interval '10 minutes')) then
      insert into public.social_kick_votes(room_id,target_profile_id,started_by) values(r.room_id,p_target_id,me) returning id into vote_id;
      insert into public.social_kick_ballots(vote_id,voter_profile_id,approve) values(vote_id,me,true);
      perform public.social_settle_vote(vote_id);
    end if;
  end loop;
end $$;

create function public.vote_social_kick(p_vote_id uuid,p_approve boolean) returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_social_profile_id(); v public.social_kick_votes%rowtype;
begin
  select * into v from public.social_kick_votes where id=p_vote_id for update;
  if v.id is null or v.status<>'open' or v.expires_at<=now() or v.target_profile_id=me or not public.is_social_room_member(v.room_id,me) then raise exception 'vote_unavailable'; end if;
  insert into public.social_kick_ballots(vote_id,voter_profile_id,approve) values(v.id,me,p_approve) on conflict do nothing;
  perform public.social_settle_vote(v.id);
end $$;

create function public.request_social_share(p_friend_id uuid,p_hours integer) returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_social_profile_id();
begin
  if p_hours not in (1,4,8) or not public.are_social_friends(me,p_friend_id) or public.social_is_blocked(me,p_friend_id) then raise exception 'sharing_not_allowed'; end if;
  update public.social_location_shares set status='expired' where status in ('pending','active') and expires_at<=now();
  insert into public.social_location_shares(requester_id,recipient_id,hours) values(me,p_friend_id,p_hours);
end $$;

create function public.respond_social_share(p_share_id uuid,p_accept boolean) returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_social_profile_id(); s public.social_location_shares%rowtype;
begin
  select * into s from public.social_location_shares where id=p_share_id for update;
  if s.id is null or me not in(s.requester_id,s.recipient_id) then raise exception 'sharing_not_allowed'; end if;
  if not p_accept then
    update public.social_location_shares set status='revoked' where id=s.id;
    delete from public.social_shared_locations where share_id=s.id; return;
  end if;
  if me<>s.recipient_id or s.status<>'pending' or s.expires_at<=now() or not public.are_social_friends(me,s.requester_id) or public.social_is_blocked(me,s.requester_id) then raise exception 'sharing_not_allowed'; end if;
  update public.social_location_shares set status='active',expires_at=now()+make_interval(hours=>s.hours) where id=s.id;
end $$;

create function public.set_social_share_precision(p_share_id uuid,p_precise boolean) returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_social_profile_id(); s public.social_location_shares%rowtype;
begin
  select * into s from public.social_location_shares where id=p_share_id for update;
  if s.id is null or me not in(s.requester_id,s.recipient_id) or s.status<>'active' or s.expires_at<=now() then raise exception 'sharing_not_allowed'; end if;
  update public.social_location_shares set requester_precise=case when me=requester_id then p_precise else requester_precise end,recipient_precise=case when me=recipient_id then p_precise else recipient_precise end where id=s.id;
  -- Downgrading also removes the previously stored exact point immediately.
  delete from public.social_shared_locations where share_id=s.id and profile_id=me;
end $$;

create function public.publish_social_share_location(p_latitude double precision,p_longitude double precision,p_captured_at timestamptz) returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_social_profile_id(); s record; precise boolean;
begin
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or p_captured_at<now()-interval '2 minutes' or p_captured_at>now()+interval '30 seconds' then raise exception 'invalid_location'; end if;
  for s in select * from public.social_location_shares where status='active' and expires_at>now() and me in(requester_id,recipient_id) loop
    if public.social_is_blocked(s.requester_id,s.recipient_id) then continue; end if;
    precise:=case when s.requester_id=me then s.requester_precise else s.recipient_precise end;
    insert into public.social_shared_locations(share_id,profile_id,latitude,longitude,captured_at)
    values(s.id,me,case when precise then p_latitude else round(p_latitude::numeric,2)::double precision end,case when precise then p_longitude else round(p_longitude::numeric,2)::double precision end,p_captured_at)
    on conflict(share_id,profile_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,captured_at=excluded.captured_at
    where excluded.captured_at>social_shared_locations.captured_at+interval '25 seconds';
  end loop;
end $$;

create or replace function public.publish_social_location(p_room_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision,p_captured_at timestamptz) returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_social_profile_id(); r public.social_rooms%rowtype; m public.social_room_members%rowtype; previous public.social_room_locations%rowtype; issue text; inside boolean;
begin
  select * into r from public.social_rooms where id=p_room_id for update;
  select * into m from public.social_room_members where room_id=p_room_id and profile_id=me and left_at is null for update;
  if r.id is null or m.profile_id is null or r.phase not in('waiting','active') or (r.phase='active' and r.max_end_at<=now()) then raise exception 'location_not_allowed'; end if;
  if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or p_captured_at is null or p_captured_at<now()-interval '2 minutes' or p_captured_at>now()+interval '30 seconds' then raise exception 'invalid_location_time'; end if;
  select * into previous from public.social_room_locations where room_id=p_room_id and profile_id=me;
  if previous.captured_at is not null and p_captured_at<=previous.captured_at then return; end if;
  if previous.updated_at>now()-interval '25 seconds' then return; end if;
  if p_accuracy_meters is null or p_accuracy_meters>100 or p_accuracy_meters<0 then issue:='accuracy';
  elsif previous.captured_at is not null and p_captured_at-previous.captured_at<interval '2 minutes' and public.social_distance_meters(previous.latitude,previous.longitude,p_latitude,p_longitude)/greatest(1,extract(epoch from p_captured_at-previous.captured_at))>8 then issue:='movement'; end if;
  insert into public.social_room_locations(room_id,profile_id,latitude,longitude,accuracy_meters,captured_at) values(p_room_id,me,p_latitude,p_longitude,greatest(0,p_accuracy_meters),p_captured_at)
  on conflict(room_id,profile_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy_meters=excluded.accuracy_meters,captured_at=excluded.captured_at,updated_at=now();
  update public.social_room_members set last_seen_at=now(),last_location_at=p_captured_at,location_issue=issue where room_id=p_room_id and profile_id=me;
  if r.phase='active' and now()>=r.started_at then
    inside:=issue is null and public.social_distance_meters(p_latitude,p_longitude,r.destination_latitude,r.destination_longitude)<=60;
    if not inside then update public.social_room_members set arrival_entered_at=null,arrived_at=null where room_id=p_room_id and profile_id=me;
    elsif r.mode='sharedStart' or r.solo then update public.social_room_members set arrived_at=p_captured_at where room_id=p_room_id and profile_id=me;
    elsif m.arrival_entered_at is null or previous.captured_at is null or p_captured_at-previous.captured_at>interval '2 minutes' then update public.social_room_members set arrival_entered_at=p_captured_at,arrived_at=null where room_id=p_room_id and profile_id=me;
    elsif p_captured_at>=m.arrival_entered_at+interval '30 seconds' then update public.social_room_members set arrived_at=p_captured_at where room_id=p_room_id and profile_id=me; end if;
  end if;
end $$;

create function public.save_social_health_summary(p_room_id uuid,p_steps integer,p_active_seconds integer) returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_social_profile_id(); r public.social_rooms%rowtype; elapsed numeric;
begin
  select * into r from public.social_rooms where id=p_room_id;
  if not public.is_social_room_member(p_room_id,me) or r.started_at is null then raise exception 'not_room_member'; end if;
  elapsed:=greatest(0,extract(epoch from least(now(),r.max_end_at)-r.started_at));
  if p_steps<0 or p_steps>elapsed*5+50 or p_active_seconds<0 or p_active_seconds>elapsed+2 then raise exception 'invalid_health_summary'; end if;
  insert into public.social_health_summaries(room_id,profile_id,steps,active_seconds) values(p_room_id,me,p_steps,p_active_seconds)
  on conflict(room_id,profile_id) do update set steps=greatest(social_health_summaries.steps,excluded.steps),active_seconds=greatest(social_health_summaries.active_seconds,excluded.active_seconds);
end $$;

create function public.confirm_social_task(p_room_id uuid,p_task_id uuid,p_steps integer,p_active_seconds integer) returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_social_profile_id(); t public.social_room_tasks%rowtype; r public.social_rooms%rowtype; target integer;
begin
  select * into r from public.social_rooms where id=p_room_id for update;
  if r.id is null or r.phase<>'active' or r.started_at>now() or r.max_end_at<=now() or r.solo or not public.is_social_room_member(p_room_id,me) then raise exception 'task_not_allowed'; end if;
  select * into t from public.social_room_tasks where id=p_task_id and room_id=p_room_id;
  if t.id is null then raise exception 'task_not_found'; end if;
  if t.kind in ('steps','activeMinutes') and not exists(select 1 from public.social_room_members m join public.social_room_locations l on l.room_id=m.room_id and l.profile_id=m.profile_id where m.room_id=p_room_id and m.profile_id=me and m.left_at is null and m.location_issue is null and l.captured_at>now()-interval '2 minutes') then raise exception 'fresh_locations_required'; end if;
  perform public.save_social_health_summary(p_room_id,p_steps,p_active_seconds);
  if t.kind='steps' then
    select sum(step_target) into target from public.social_room_tasks where room_id=p_room_id and kind='steps' and sequence<=t.sequence;
    if p_steps<target then raise exception 'task_not_reached'; end if;
  elsif t.kind='activeMinutes' then
    select sum(active_minute_target)*60 into target from public.social_room_tasks where room_id=p_room_id and kind='activeMinutes' and sequence<=t.sequence;
    if p_active_seconds<target then raise exception 'task_not_reached'; end if;
  end if;
  insert into public.social_task_completions(task_id,profile_id) values(p_task_id,me) on conflict do nothing;
end $$;

create or replace function public.finish_social_room(p_room_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_social_profile_id(); r public.social_rooms%rowtype;
begin
  select * into r from public.social_rooms where id=p_room_id for update;
  if r.id is null or r.phase<>'active' or r.started_at>now() or r.max_end_at<=now() or not public.is_social_room_member(p_room_id,me) then raise exception 'not_room_member'; end if;
  if exists(select 1 from public.social_room_members m left join public.social_room_locations l on l.room_id=m.room_id and l.profile_id=m.profile_id where m.room_id=p_room_id and m.left_at is null and (m.arrived_at is null or m.location_issue is not null or l.captured_at is null or l.captured_at<now()-interval '2 minutes')) then raise exception 'members_not_arrived'; end if;
  if not r.solo and exists(select 1 from public.social_room_tasks t cross join public.social_room_members m where t.room_id=p_room_id and m.room_id=p_room_id and m.left_at is null and t.required and not exists(select 1 from public.social_task_completions c where c.task_id=t.id and c.profile_id=m.profile_id)) then raise exception 'required_tasks_incomplete'; end if;
  update public.social_rooms set phase='completed',completed_at=now() where id=p_room_id;
end $$;

-- Cleanup must also be scheduled with Supabase Cron (see setup file).
-- Read-time expiry remains enforced even if that worker is late.
create function public.social_cleanup() returns void language plpgsql security definer set search_path=public as $$
begin
  update public.social_rooms set phase='closed',closed_at=now() where (phase='waiting' and lobby_expires_at<=now()) or (phase='active' and max_end_at<=now());
  update public.social_room_invites set status='expired' where status='pending' and expires_at<=now();
  update public.social_friend_requests set status='expired' where status='pending' and expires_at<=now();
  update public.social_location_shares set status='expired' where status in('pending','active') and expires_at<=now();
  update public.social_kick_votes set status='failed',resolved_at=now() where status='open' and expires_at<=now();
  delete from public.social_room_locations where captured_at<now()-interval '5 minutes';
  delete from public.social_shared_locations l using public.social_location_shares s where l.share_id=s.id and (s.status<>'active' or s.expires_at<=now());
  delete from public.social_shared_locations where captured_at<now()-interval '5 minutes';
  delete from public.social_qr_tokens where expires_at<=now();
end $$;

alter function public.social_room_json(uuid) rename to social_room_json_base;
create function public.social_room_json(target_room_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid:=public.current_social_profile_id(); result jsonb; r public.social_rooms%rowtype;
begin
  if not public.is_social_room_member(target_room_id,me) then return null; end if;
  select * into r from public.social_rooms where id=target_room_id;
  result:=public.social_room_json_base(target_room_id);
  result:=result || jsonb_build_object('solo',r.solo,'members',coalesce((
    select jsonb_agg(member || jsonb_build_object('lastLocationAt',m.last_location_at,'locationIssue',m.location_issue,'location',case
      when r.phase not in('waiting','active') or public.social_is_blocked(me,m.profile_id) or (me<>m.profile_id and not public.are_social_friends(me,m.profile_id)) then null else member->'location' end))
    from jsonb_array_elements(result->'members') member join public.social_room_members m on m.room_id=r.id and m.profile_id=(member->'profile'->>'id')::uuid
  ),'[]'::jsonb));
  result:=jsonb_set(result,'{tasks}',coalesce((select jsonb_agg(task || jsonb_build_object('confirmedByMe',exists(select 1 from public.social_task_completions c where c.task_id=(task->>'id')::uuid and c.profile_id=me)) || case when r.solo then '{"status":"pending"}'::jsonb else '{}'::jsonb end) from jsonb_array_elements(result->'tasks') task),'[]'::jsonb));
  return result || jsonb_build_object('kickVotes',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'targetId',v.target_profile_id,'expiresAt',v.expires_at,
    'approvals',(select count(*) from public.social_kick_ballots b join public.social_room_members m on m.room_id=r.id and m.profile_id=b.voter_profile_id and m.left_at is null where b.vote_id=v.id and b.approve),
    'needed',(select count(*)/2+1 from public.social_room_members m where m.room_id=r.id and m.left_at is null and m.profile_id<>v.target_profile_id),
    'votedByMe',exists(select 1 from public.social_kick_ballots b where b.vote_id=v.id and b.voter_profile_id=me))) from public.social_kick_votes v where v.room_id=r.id and v.status='open' and v.expires_at>now()),'[]'::jsonb));
end $$;

alter function public.get_social_snapshot() rename to get_social_snapshot_base;
create function public.get_social_snapshot() returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid:=public.current_social_profile_id(); result jsonb; r record;
begin
  if me is null then raise exception 'social_profile_missing'; end if;
  perform public.social_cleanup();
  update public.social_room_members set last_seen_at=now() where profile_id=me and left_at is null and room_id in(select id from public.social_rooms where phase in('waiting','active'));
  for r in select room_id from public.social_room_members where profile_id=me and left_at is null loop perform public.social_settle_members(r.room_id); end loop;
  result:=public.get_social_snapshot_base();
  if result->'activeRoom'='null'::jsonb then
    select m.room_id into r from public.social_room_members m join public.social_rooms room on room.id=m.room_id where m.profile_id=me and m.left_at is null and room.phase='closed' order by room.created_at desc limit 1;
    if found then result:=jsonb_set(result,'{activeRoom}',public.social_room_json(r.room_id)); end if;
  end if;
  return result || jsonb_build_object('shares',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'friend',public.social_profile_json(case when s.requester_id=me then s.recipient_id else s.requester_id end),
    'incoming',s.recipient_id=me,'status',s.status,'hours',s.hours,'expiresAt',s.expires_at,'myPrecision',case when (s.requester_id=me and s.requester_precise) or (s.recipient_id=me and s.recipient_precise) then 'precise' else 'approximate' end,
    'location',(select jsonb_build_object('profileId',l.profile_id,'latitude',l.latitude,'longitude',l.longitude,'timestamp',l.captured_at,'accuracyMeters',null) from public.social_shared_locations l where l.share_id=s.id and l.profile_id<>me and l.captured_at>now()-interval '5 minutes' and s.status='active')))
    from public.social_location_shares s where me in(s.requester_id,s.recipient_id) and s.status in('pending','active') and s.expires_at>now() and not public.social_is_blocked(s.requester_id,s.recipient_id)),'[]'::jsonb));
end $$;

-- Never expose raw coordinates, auth IDs, timestamps, recovery material or ballots.
revoke all on public.social_profiles,public.social_room_members,public.social_room_locations,public.social_task_completions,public.social_kick_votes,public.social_kick_ballots,public.social_qr_tokens,public.social_health_summaries,public.social_location_shares,public.social_shared_locations from anon,authenticated;
alter publication supabase_realtime drop table public.social_room_locations;
alter publication supabase_realtime drop table public.social_room_members;
alter publication supabase_realtime drop table public.social_task_completions;
alter publication supabase_realtime add table public.social_room_invites;

-- Blanket-deny ONLY this feature's functions, then grant its explicit API.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'social_%' or p.proname like '%_social_%') loop
    execute format('revoke execute on function %s from public, anon, authenticated',f.signature);
  end loop;
end $$;
grant execute on function public.current_social_profile_id(),public.is_social_room_member(uuid,uuid) to authenticated;
grant execute on function public.get_social_snapshot(),public.update_social_nickname(text),public.set_social_recovery_hash(text),public.recover_social_profile(text),public.rotate_social_friend_code(),public.set_social_availability(integer),public.send_social_friend_request(text),public.respond_social_friend_request(uuid,text),public.update_social_friend_label(uuid,text,boolean),public.create_social_friend_qr(),public.send_social_qr_request(text),public.remove_social_friend(uuid),public.block_social_profile(uuid) to authenticated;
grant execute on function public.create_social_room(text,integer,text,text,double precision,double precision,jsonb,uuid[]),public.respond_social_room_invite(uuid,boolean),public.set_social_room_ready(uuid,boolean),public.start_social_room(uuid),public.publish_social_location(uuid,double precision,double precision,double precision,timestamptz),public.save_social_health_summary(uuid,integer,integer),public.confirm_social_task(uuid,uuid,integer,integer),public.finish_social_room(uuid),public.leave_social_room(uuid),public.vote_social_kick(uuid,boolean) to authenticated;
grant execute on function public.request_social_share(uuid,integer),public.respond_social_share(uuid,boolean),public.set_social_share_precision(uuid,boolean),public.publish_social_share_location(double precision,double precision,timestamptz) to authenticated;
