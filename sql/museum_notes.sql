-- ひとこと帳（/notes）用の表。Supabase の SQL Editor で1回だけ実行する。
create table if not exists public.museum_notes (
  id uuid primary key default gen_random_uuid(),
  body text not null check (length(trim(body)) between 1 and 140),
  bold boolean not null default false,
  color text not null default '#2B2622' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  size text not null default 'm' check (size in ('s', 'm', 'l', 'xl')),
  created_at timestamptz not null default now()
);
alter table public.museum_notes enable row level security;
create policy "notes are public" on public.museum_notes for select using (true);
create policy "admins write notes" on public.museum_notes for all to authenticated
  using (exists (select 1 from public.museum_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.museum_admins a where a.user_id = auth.uid()));
grant select on public.museum_notes to anon, authenticated;
grant insert, update, delete on public.museum_notes to authenticated;
