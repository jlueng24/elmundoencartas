-- Un estado personal por cuenta. El navegador solo puede leer y escribir el suyo.
begin;

create table public.game_player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 2000000),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.game_player_progress enable row level security;
revoke all on public.game_player_progress from anon, authenticated;
grant select, insert, update on public.game_player_progress to authenticated;

create policy "Read own progress" on public.game_player_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Create own progress" on public.game_player_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Update own progress" on public.game_player_progress
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

commit;
