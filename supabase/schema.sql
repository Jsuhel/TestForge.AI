-- ═══════════════════════════════════════════════════════════════════════════
-- TestForge AI — Supabase schema
--
-- Run this ONCE in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- It is idempotent (safe to run again).
--
-- project_sessions: one row per analyzed FSD project. All pipeline payloads
-- (analysis, chat, test cases, automation, run results) live in JSONB columns,
-- so future data shape changes need no schema migration — new kinds of data
-- get their own table added here when they arrive.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.project_sessions (
  id                uuid primary key,
  title             text        not null default 'Untitled project',
  phase             text        not null default 'analyzed',
  analysis          jsonb,
  chat              jsonb       not null default '[]'::jsonb,
  chat_engine_label text,
  test_cases        jsonb       not null default '[]'::jsonb,
  test_engine       text        not null default 'builtin',
  test_engine_label text,
  automation        jsonb,
  run_result        jsonb,
  run_logs          jsonb       not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Row Level Security: enabled with open-access policies so the publishable
-- (browser) key can read/write. If a login is added later (Supabase Auth),
-- replace the `using (true)` clauses with `using (auth.uid() = user_id)`.
alter table public.project_sessions enable row level security;

drop policy if exists "sessions_public_read"   on public.project_sessions;
drop policy if exists "sessions_public_insert" on public.project_sessions;
drop policy if exists "sessions_public_update" on public.project_sessions;
drop policy if exists "sessions_public_delete" on public.project_sessions;

create policy "sessions_public_read"   on public.project_sessions for select using (true);
create policy "sessions_public_insert" on public.project_sessions for insert with check (true);
create policy "sessions_public_update" on public.project_sessions for update using (true) with check (true);
create policy "sessions_public_delete" on public.project_sessions for delete using (true);

-- Keep updated_at fresh on every write.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists project_sessions_touch on public.project_sessions;
create trigger project_sessions_touch
  before update on public.project_sessions
  for each row execute function public.touch_updated_at();

-- Live sync: broadcast row changes to connected browsers (History list stays
-- fresh across tabs and devices).
do $$
begin
  alter publication supabase_realtime add table public.project_sessions;
exception
  when duplicate_object then null; -- already in the publication
end $$;
