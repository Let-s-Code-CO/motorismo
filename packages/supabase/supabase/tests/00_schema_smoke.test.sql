-- State-independent pgTAP smoke test: the sandbox is up and the public schema exists.
-- Run with `pnpm db:test`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(1);

select has_schema('public', 'public schema exists');

select * from finish();
rollback;
