import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createTeamTasks } from '../src/domain/social';

test('v0.8 migrations execute in PostgreSQL and enforce caller isolation', async (t) => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create schema extensions;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    for (const file of ['202608310001_social_v08.sql', '202608310002_social_safety.sql', '202608310003_pet_display_v09.sql']) {
      const sql = readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');
      // PGlite has no replication worker; SQL/RLS/RPCs execute unchanged.
      await db.exec(sql.replace(/^alter publication .*;\r?$/gm, ''));
    }
    const identities: { auth: string; profile: string; code: string }[] = [];
    for (let i = 1; i <= 12; i++) {
      const auth = `10000000-0000-0000-0000-${String(i).padStart(12, '0')}`;
      await db.query('insert into auth.users(id) values($1)', [auth]);
      const { rows } = await db.query<{ id: string; friend_code: string }>('select id,friend_code from social_profiles where auth_user_id=$1', [auth]);
      identities.push({ auth, profile: rows[0]!.id, code: rows[0]!.friend_code });
    }
    async function asUser<T = Record<string, unknown>>(index: number, sql: string, args: unknown[] = []) {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [identities[index]!.auth]);
      await db.exec('set role authenticated');
      try { return await db.query<T>(sql, args); } finally { await db.exec('reset role'); }
    }
    async function friend(a: number, b: number) {
      const result = await asUser<{ id: string }>(a, 'select send_social_friend_request($1) id', [identities[b]!.code]);
      await asUser(b, "select respond_social_friend_request($1,'accept')", [result.rows[0]!.id]);
    }
    async function snapshot(i: number) {
      return (await asUser<{ data: any }>(i, 'select get_social_snapshot() data')).rows[0]!.data;
    }
    let roomId: string;
    await t.test('pet display RPC writes only caller cosmetics and validates input', async () => {
      assert.equal((await snapshot(0)).profile.pet.visualKey, 'badge');
      await asUser(0, 'select update_social_pet($1,$2,$3)', ['我的水靈','water','juvenile']);
      assert.equal((await snapshot(0)).profile.pet.visualKey,'water');
      assert.equal((await snapshot(1)).profile.pet.visualKey,'badge');
      await assert.rejects(asUser(0,'select update_social_pet($1,$2,$3)',['x','fox','juvenile']),/invalid_pet_series/);
      await assert.rejects(asUser(0,'select update_social_pet($1,$2,$3)',['x','badge','mature']),/invalid_pet_stage/);
      await assert.rejects(asUser(0,'select update_social_pet($1,$2,$3)',['x'.repeat(17),'water','egg']),/invalid_pet_name/);
      await db.exec('set role anon');
      try { await assert.rejects(db.query("select update_social_pet('x','water','egg')"),/permission denied/); } finally { await db.exec('reset role'); }
    });
    await t.test('anonymous profile trigger and private recovery', async () => {
      const me = await snapshot(0);
      assert.equal(me.profile.id, identities[0]!.profile);
      assert.equal(me.friends.length, 0);
      await asUser(0, 'select set_social_recovery_hash($1)', ['a'.repeat(64)]);
      await assert.rejects(asUser(1, 'select * from social_recovery'), /permission denied/);
      await assert.rejects(asUser(1, 'select social_profile_json($1)', [identities[0]!.profile]), /permission denied/);
      await assert.rejects(asUser(1, 'select * from social_profiles'), /permission denied/);
    });
    await t.test('mutual friends, private labels and declined cooldown', async () => {
      await friend(0, 1); await friend(0, 2); await friend(1, 2);
      await asUser(0, "select update_social_friend_label($1,'family',true)", [identities[1]!.profile]);
      assert.equal((await snapshot(0)).friends.find((f: any) => f.profile.id === identities[1]!.profile).category, 'family');
      assert.equal((await asUser(1, 'select * from social_friend_labels')).rows.length, 0);
      const request = await asUser<{ id: string }>(3, 'select send_social_friend_request($1) id', [identities[4]!.code]);
      await asUser(4, "select respond_social_friend_request($1,'decline')", [request.rows[0]!.id]);
      await assert.rejects(asUser(3, 'select send_social_friend_request($1)', [identities[4]!.code]), /invite_cooldown/);
    });
    await t.test('QR enforces five uses, expiry and friend-code rotation', async () => {
      const qr = (await asUser<{ q: any }>(5, 'select create_social_friend_qr() q')).rows[0]!.q;
      for (let i = 6; i <= 10; i++) await asUser(i, 'select send_social_qr_request($1)', [qr.token]);
      await assert.rejects(asUser(11, 'select send_social_qr_request($1)', [qr.token]), /qr_expired/);
      const next = (await asUser<{ q: any }>(5, 'select create_social_friend_qr() q')).rows[0]!.q;
      await asUser(5, 'select rotate_social_friend_code()');
      await assert.rejects(asUser(11, 'select send_social_qr_request($1)', [next.token]), /qr_expired/);
      await assert.rejects(asUser(11, 'select send_social_friend_request($1)', [identities[5]!.code]), /invalid_friend_code/);
    });
    await t.test('room invites, permissions, preparation and ten-second countdown', async () => {
      const created = await asUser<{ id: string }>(0, "select create_social_room('sharedStart',30,'relaxed','公園',25.03,121.56,$1::jsonb,$2::uuid[]) id", [JSON.stringify(createTeamTasks(30, 'relaxed', 'db')), [identities[1]!.profile, identities[2]!.profile]]);
      roomId = created.rows[0]!.id;
      for (const i of [1, 2]) {
        const invite = (await snapshot(i)).roomInvites[0];
        await asUser(i, 'select respond_social_room_invite($1,true)', [invite.id]);
      }
      await assert.rejects(asUser(0, 'select start_social_room($1)', [roomId]), /members_not_ready/);
      for (const i of [0, 1, 2]) {
        await asUser(i, 'select publish_social_location($1,25.03,121.56,10,now())', [roomId]);
        await asUser(i, 'select set_social_room_ready($1,true)', [roomId]);
      }
      await asUser(0, 'select start_social_room($1)', [roomId]);
      const room = (await snapshot(1)).activeRoom;
      assert.equal(room.phase, 'active');
      assert.ok(Date.parse(room.startedAt) > Date.now() + 5000);
      assert.equal((await asUser(4, 'select * from social_rooms where id=$1', [roomId])).rows.length, 0);
      await assert.rejects(asUser(4, 'select publish_social_location($1,25.03,121.56,10,now())', [roomId]), /location_not_allowed/);
      await assert.rejects(asUser(1, 'select * from social_room_locations'), /permission denied/);
    });
    await t.test('physical tasks cannot be confirmed early or by a non-member', async () => {
      const taskId = (await snapshot(0)).activeRoom.tasks.find((task: any) => task.kind === 'steps').id;
      await assert.rejects(asUser(0, 'select confirm_social_task($1,$2,0,0)', [roomId, taskId]), /task_not_allowed/);
      await db.query("update social_rooms set started_at=now()-interval '10 minutes' where id=$1", [roomId]);
      await assert.rejects(asUser(0, 'select confirm_social_task($1,$2,0,0)', [roomId, taskId]), /task_not_reached/);
      await assert.rejects(asUser(4, 'select confirm_social_task($1,$2,300,0)', [roomId, taskId]), /task_not_allowed/);
      await assert.rejects(asUser(0, 'select complete_social_task($1,$2)', [roomId, taskId]), /permission denied/);
      await asUser(0, 'select confirm_social_task($1,$2,300,0)', [roomId, taskId]);
      assert.equal((await snapshot(0)).activeRoom.tasks.find((task: any) => task.id === taskId).confirmedByMe, true);
    });
    await t.test('location sharing requires consent, defaults approximate, and revokes immediately', async () => {
      await asUser(0, 'select request_social_share($1,1)', [identities[1]!.profile]);
      const share = (await snapshot(1)).shares[0];
      await asUser(0, 'select publish_social_share_location(25.031234,121.564321,now())');
      assert.equal((await snapshot(1)).shares[0].location, null);
      await asUser(1, 'select respond_social_share($1,true)', [share.id]);
      await asUser(0, 'select publish_social_share_location(25.031234,121.564321,now())');
      assert.equal((await snapshot(1)).shares[0].location.latitude, 25.03);
      await asUser(0, 'select set_social_share_precision($1,true)', [share.id]);
      await asUser(0, 'select publish_social_share_location(25.031234,121.564321,now())');
      assert.equal((await snapshot(1)).shares[0].location.latitude, 25.031234);
      await asUser(1, 'select respond_social_share($1,false)', [share.id]);
      assert.equal((await snapshot(0)).shares.length, 0);
      assert.equal((await db.query('select * from social_shared_locations')).rows.length, 0);
    });
    await t.test('blocking hides bilateral location before the strict-majority vote passes', async () => {
      await asUser(0, 'select block_social_profile($1)', [identities[1]!.profile]);
      const room = (await snapshot(0)).activeRoom;
      assert.equal(room.members.find((m: any) => m.profile.id === identities[1]!.profile).location, null);
      assert.equal(room.members.length, 3);
      assert.equal(room.kickVotes[0].approvals, 1);
      assert.equal(room.kickVotes[0].needed, 2);
      await assert.rejects(asUser(1, 'select vote_social_kick($1,true)', [room.kickVotes[0].id]), /vote_unavailable/);
      await asUser(2, 'select vote_social_kick($1,true)', [room.kickVotes[0].id]);
      assert.equal((await snapshot(1)).activeRoom, null);
      assert.equal((await snapshot(0)).activeRoom.members.length, 2);
    });
    await t.test('host exit transfers ownership and preserves a solo continuation', async () => {
      await asUser(0, 'select leave_social_room($1)', [roomId]);
      const room = (await snapshot(2)).activeRoom;
      assert.equal(room.solo, true);
      assert.equal(room.members.length, 1);
      assert.equal(room.members[0].isHost, true);
      assert.ok(room.tasks.every((task: any) => task.status === 'pending'));
    });
    await t.test('four-hour cleanup deletes precise locations and keeps a closed record', async () => {
      await db.query("update social_rooms set max_end_at=now()-interval '1 second' where id=$1", [roomId]);
      assert.equal((await snapshot(2)).activeRoom.phase, 'closed');
      assert.equal((await db.query('select * from social_room_locations where room_id=$1', [roomId])).rows.length, 0);
      assert.ok((await db.query('select * from social_health_summaries where room_id=$1', [roomId])).rows.length > 0);
    });
    await t.test('recovery moves the account and revokes the previous identity', async () => {
      const result = await asUser<{ recovered: boolean }>(11, 'select recover_social_profile($1) recovered', ['a'.repeat(64)]);
      assert.equal(result.rows[0]!.recovered, true);
      assert.equal((await snapshot(11)).profile.id, identities[0]!.profile);
      await assert.rejects(snapshot(0), /social_profile_missing/);
    });
    await t.test('expired QR and room invitations cannot be reused', async () => {
      const q = (await asUser<{ q: any }>(7, 'select create_social_friend_qr() q')).rows[0]!.q;
      await db.query("update social_qr_tokens set expires_at=now()-interval '1 second' where profile_id=$1", [identities[7]!.profile]);
      await assert.rejects(asUser(8, 'select send_social_qr_request($1)', [q.token]), /qr_expired/);
      await friend(6,7);
      const created = await asUser<{ id: string }>(6, "select create_social_room('gather',30,'standard','另一座公園',25.03,121.56,$1::jsonb,$2::uuid[]) id", [JSON.stringify(createTeamTasks(30, 'standard', 'safety')), [identities[7]!.profile]]);
      const id = created.rows[0]!.id;
      const invite = (await snapshot(7)).roomInvites[0];
      await db.query("update social_room_invites set expires_at=now()-interval '1 second' where id=$1", [invite.id]);
      await assert.rejects(asUser(7, 'select respond_social_room_invite($1,true)', [invite.id]), /invite_unavailable/);
      await db.query("update social_rooms set lobby_expires_at=now()-interval '1 second' where id=$1", [id]);
      await snapshot(6);
      assert.equal((await db.query<{ phase: string }>('select phase from social_rooms where id=$1', [id])).rows[0]!.phase, 'closed');
      await asUser(6, 'select leave_social_room($1)', [id]);
    });
    await t.test('GPS anomalies and gather dwell protect completion; finishing deletes coordinates', async () => {
      const created = await asUser<{ id: string }>(6, "select create_social_room('gather',30,'relaxed','測試集合點',25.03,121.56,$1::jsonb,$2::uuid[]) id", [JSON.stringify(createTeamTasks(30, 'relaxed', 'arrival')), [identities[7]!.profile]]);
      const id = created.rows[0]!.id;
      await asUser(7, 'select respond_social_room_invite($1,true)', [(await snapshot(7)).roomInvites[0].id]);
      await db.query("update social_rooms set phase='active',started_at=now()-interval '10 minutes',max_end_at=now()+interval '3 hours' where id=$1", [id]);
      await asUser(6, 'select publish_social_location($1,25.03,121.56,300,now())', [id]);
      assert.equal((await snapshot(6)).activeRoom.members.find((m: any) => m.profile.id === identities[6]!.profile).locationIssue, 'accuracy');
      await assert.rejects(asUser(6, 'select finish_social_room($1)', [id]), /members_not_arrived/);
      for (const i of [6,7]) {
        await db.query("delete from social_room_locations where room_id=$1 and profile_id=$2", [id, identities[i]!.profile]);
        await asUser(i, "select publish_social_location($1,25.03,121.56,10,now()-interval '45 seconds')", [id]);
        await db.query("update social_room_locations set updated_at=now()-interval '30 seconds' where room_id=$1 and profile_id=$2", [id, identities[i]!.profile]);
        await asUser(i, 'select publish_social_location($1,25.03,121.56,10,now())', [id]);
        const room = (await snapshot(i)).activeRoom;
        assert.ok(room.members.find((m: any) => m.profile.id === identities[i]!.profile).arrivedAt);
        for (const task of room.tasks.filter((task: any) => task.required)) await asUser(i, 'select confirm_social_task($1,$2,300,0)', [id, task.id]);
      }
      await db.query("update social_room_locations set captured_at=now()-interval '121 seconds' where room_id=$1 and profile_id=$2", [id, identities[7]!.profile]);
      await assert.rejects(asUser(6, 'select finish_social_room($1)', [id]), /members_not_arrived/);
      await db.query('update social_room_locations set captured_at=now() where room_id=$1', [id]);
      await asUser(6, 'select finish_social_room($1)', [id]);
      assert.equal((await snapshot(7)).activeRoom.phase, 'completed');
      assert.equal((await db.query('select * from social_room_locations where room_id=$1', [id])).rows.length, 0);
    });
  } finally { await db.close(); }
});
