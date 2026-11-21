-- reservations, live — the queue and the agenda up to date without reloading (spec 012, HU-06).
--
-- * extend_reservation_tolerance: staff give a customer on their way 5 more minutes to keep their
--   turn (CA-34): the effective tolerance grows by 5 and becomes the reservation's own, never over
--   60 (RN-11); only while pending and before its tolerance has passed; a customer cannot.
-- * Every «+5 min» is recorded with who, when and the tolerance it left, and the summary counts them
--   (CA-38); nobody writes or deletes the record directly.
-- * The tables the staff screens show are published for Realtime (CA-35); Realtime only sends a row
--   to whoever may read it, so customers receive nothing (RLS of spec 012).
--
-- The clock is fixed through private.agenda_now(), as in 11_reservations.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

create or replace function private.agenda_now()
returns timestamptz language sql stable set search_path = '' as $$
  select current_setting('test.now')::timestamptz;
$$;
create function pg_temp.at(p_local text)
returns void language sql as $$ select set_config('test.now', p_local || '-05', true); $$;

create function pg_temp.act_as(p_id uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.error_hint(p_sql text)
returns text language plpgsql as $$
declare v_hint text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_hint = pg_exception_hint;
  return coalesce(nullif(v_hint, ''), sqlstate);
end $$;

delete from public.reservation_extensions;
delete from public.reservation_services;
delete from public.reservations;

insert into public.staff_invitations (email, full_name, role) values ('live-op@test.local', 'Oscar Operador', 'operator');
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000013b1', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'live-op@test.local', '', '{}');
update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-0000000013b1';
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data,
                        raw_user_meta_data, email_confirmed_at, created_at)
values ('00000000-0000-0000-0000-0000000013c1', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'live-camilo@test.local', '', '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', 'Camilo Cliente', 'data_consent', true), now(), now());

-- Two reservations at 9:00 (Bogotá): one with the general 15 minutes, one with its own 55.
insert into public.reservations (id, customer_id, slot_start, slot_end, tolerance_minutes, created_by)
select r.id, c.id, '2030-06-12 09:00-05', '2030-06-12 10:00-05', r.own, '00000000-0000-0000-0000-0000000013b1'
from public.customers c,
     (values ('00000000-0000-0000-0000-00000000a001'::uuid, null::smallint),
             ('00000000-0000-0000-0000-00000000a002'::uuid, 55::smallint)) as r (id, own)
where c.email = 'live-camilo@test.local';

select pg_temp.at('2030-06-12 09:05');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000013b1');

select is(public.extend_reservation_tolerance('00000000-0000-0000-0000-00000000a001')::int, 20,
  'CA-34: an operator gives a customer on their way 5 more minutes (15 + 5 = 20)');
select is((select tolerance_minutes::int from public.reservations where id = '00000000-0000-0000-0000-00000000a001'),
  20, 'CA-34, RN-11: the 20 minutes are now the reservation''s own');
select is(public.extend_reservation_tolerance('00000000-0000-0000-0000-00000000a001')::int, 25,
  'CA-34: it can be pressed again (20 + 5 = 25)');
select results_eq(
  $$ select minutes::int, tolerance_after::int, created_by, created_at from public.reservation_extensions
     where reservation_id = '00000000-0000-0000-0000-00000000a001' order by tolerance_after $$,
  $$ values (5, 20, '00000000-0000-0000-0000-0000000013b1'::uuid, '2030-06-12 09:05-05'::timestamptz),
            (5, 25, '00000000-0000-0000-0000-0000000013b1'::uuid, '2030-06-12 09:05-05'::timestamptz) $$,
  'CA-38: each «+5 min» is recorded, with who, when and the tolerance it left');
select results_eq(
  $$ select extensions, extended_minutes from public.reservation_summaries
     where id = '00000000-0000-0000-0000-00000000a001' $$,
  $$ values (2, 10) $$,
  'CA-38: the reservation says it was given more time twice, 10 minutes in all');
select results_eq(
  $$ select grace_until, created_by_name from public.reservation_extension_summaries
     where reservation_id = '00000000-0000-0000-0000-00000000a001' order by grace_until $$,
  $$ values ('2030-06-12 09:20-05'::timestamptz, 'Oscar Operador'), ('2030-06-12 09:25-05'::timestamptz, 'Oscar Operador') $$,
  'CA-38: each one says until when it kept its turn and who gave it');
select throws_ok($$ delete from public.reservation_extensions $$, '42501', null,
  'CA-38: nobody erases the time given');
select is(public.extend_reservation_tolerance('00000000-0000-0000-0000-00000000a002')::int, 60,
  'RN-11: from 55, 5 more reach the maximum of 60');
select is(pg_temp.error_hint($$ select public.extend_reservation_tolerance('00000000-0000-0000-0000-00000000a002') $$),
  'reservation_tolerance_max', 'RN-11: never over 60 minutes');

-- At 9:26 the first one (25 minutes) has passed its tolerance.
select pg_temp.at('2030-06-12 09:26');
select is(pg_temp.error_hint($$ select public.extend_reservation_tolerance('00000000-0000-0000-0000-00000000a001') $$),
  'reservation_tolerance_passed', 'CA-34: once its tolerance has passed, there is no more waiting to give');

reset role;
update public.reservations set status = 'cancelled', cancelled_at = now(), cancelled_by = '00000000-0000-0000-0000-0000000013b1'
 where id = '00000000-0000-0000-0000-00000000a002';
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000013b1');
select is(pg_temp.error_hint($$ select public.extend_reservation_tolerance('00000000-0000-0000-0000-00000000a002') $$),
  'reservation_not_pending', 'RN-11: only a pending reservation gets more time');

select pg_temp.act_as('00000000-0000-0000-0000-0000000013c1');
select is(pg_temp.error_hint($$ select public.extend_reservation_tolerance('00000000-0000-0000-0000-00000000a001') $$),
  'reservation_staff_only', 'RN-06: a customer cannot give themselves more time');
select is_empty($$ select 1 from public.reservation_extensions $$, 'RN-06: a customer reads none of it');
reset role;

select function_privs_are('public', 'extend_reservation_tolerance', array['uuid'], 'anon', array[]::text[],
  'anon cannot extend a tolerance');

-- CA-35: what the staff screens show is published for Realtime.
select set_eq(
  $$ select tablename::text from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename in ('work_orders', 'reservations', 'agenda_days', 'agenda_weeks', 'agenda_settings') $$,
  array['work_orders', 'reservations', 'agenda_days', 'agenda_weeks', 'agenda_settings'],
  'CA-35: orders, reservations and the agenda are published for Realtime');
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.work_orders'::regclass, 'public.reservations'::regclass)),
  'CA-35: Realtime sends rows through RLS: customers read none of them');

select * from finish();
rollback;
