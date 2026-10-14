-- Cartas del Mundo: ligas privadas. Ejecutar una vez en el SQL Editor de Supabase.
begin;
create extension if not exists pgcrypto;

create table if not exists public.game_leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  invite_code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.game_league_members (
  league_id uuid not null references public.game_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  joined_at timestamptz not null default now(),
  primary key (league_id,user_id)
);

create table if not exists public.game_league_attempts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  user_id uuid not null,
  week_start date not null,
  category text not null check (category in
    ('flags','capitals','mixed','study','survival_flags','survival_capitals','survival_mixed')),
  attempt_no smallint not null check (attempt_no between 1 and 3),
  status text not null default 'started' check (status in ('started','completed')),
  points smallint check (points between 0 and 100),
  hits smallint,
  total smallint,
  duration_ms integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (league_id,user_id,week_start,category,attempt_no),
  foreign key (league_id,user_id) references public.game_league_members(league_id,user_id) on delete cascade
);

create table if not exists public.game_league_daily (
  league_id uuid not null,
  user_id uuid not null,
  day date not null,
  week_start date not null,
  correct boolean not null,
  clues_used smallint not null check (clues_used between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (league_id,user_id,day),
  foreign key (league_id,user_id) references public.game_league_members(league_id,user_id) on delete cascade
);

create index if not exists game_league_attempts_week_idx on public.game_league_attempts(league_id,week_start);
create index if not exists game_league_daily_week_idx on public.game_league_daily(league_id,week_start);
create index if not exists game_league_members_user_idx on public.game_league_members(user_id);

alter table public.game_leagues enable row level security;
alter table public.game_league_members enable row level security;
alter table public.game_league_attempts enable row level security;
alter table public.game_league_daily enable row level security;

revoke all on public.game_leagues,public.game_league_members,
  public.game_league_attempts,public.game_league_daily from anon,authenticated;
grant select on public.game_leagues,public.game_league_members,
  public.game_league_attempts,public.game_league_daily to authenticated;

create or replace function public.is_game_league_member(p_league_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.game_league_members m
    where m.league_id=p_league_id and m.user_id=(select auth.uid()));
$$;

create policy "Members read their leagues" on public.game_leagues for select to authenticated
  using (public.is_game_league_member(id));
create policy "Members read members" on public.game_league_members for select to authenticated
  using (public.is_game_league_member(league_id));
create policy "Members read attempts" on public.game_league_attempts for select to authenticated
  using (public.is_game_league_member(league_id));
create policy "Members read daily results" on public.game_league_daily for select to authenticated
  using (public.is_game_league_member(league_id));

create or replace function public.create_game_league(p_name text,p_display_name text)
returns public.game_leagues language plpgsql security definer set search_path = '' as $$
declare v_league public.game_leagues;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if char_length(trim(p_name)) not between 2 and 40 or
     char_length(trim(p_display_name)) not between 1 and 24 then
    raise exception 'Nombre no válido';
  end if;
  insert into public.game_leagues(name,invite_code,owner_id)
  values(trim(p_name),upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),auth.uid())
  returning * into v_league;
  insert into public.game_league_members(league_id,user_id,display_name)
  values(v_league.id,auth.uid(),trim(p_display_name));
  return v_league;
end;
$$;

create or replace function public.join_game_league(p_code text,p_display_name text)
returns public.game_leagues language plpgsql security definer set search_path = '' as $$
declare v_league public.game_leagues;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if char_length(trim(p_display_name)) not between 1 and 24 then raise exception 'Nombre no válido'; end if;
  select * into v_league from public.game_leagues where invite_code=upper(trim(p_code));
  if not found then raise exception 'Código de liga desconocido'; end if;
  insert into public.game_league_members(league_id,user_id,display_name)
  values(v_league.id,auth.uid(),trim(p_display_name)) on conflict do nothing;
  return v_league;
end;
$$;

create or replace function public.reserve_game_attempt(p_league_id uuid,p_category text)
returns public.game_league_attempts language plpgsql security definer set search_path = '' as $$
declare v_week date; v_count integer; v_attempt public.game_league_attempts;
begin
  if auth.uid() is null or not public.is_game_league_member(p_league_id) then
    raise exception 'No perteneces a esta liga';
  end if;
  if p_category not in ('flags','capitals','mixed','study','survival_flags','survival_capitals','survival_mixed') then
    raise exception 'Modo no válido';
  end if;
  v_week := date_trunc('week',now() at time zone 'Europe/Madrid')::date;
  perform pg_advisory_xact_lock(hashtext(p_league_id::text||auth.uid()::text||v_week::text||p_category));
  select count(*) into v_count from public.game_league_attempts
    where league_id=p_league_id and user_id=auth.uid() and week_start=v_week and category=p_category;
  if v_count>=3 then raise exception 'Ya has usado los tres intentos de este reto'; end if;
  insert into public.game_league_attempts(league_id,user_id,week_start,category,attempt_no)
  values(p_league_id,auth.uid(),v_week,p_category,v_count+1) returning * into v_attempt;
  return v_attempt;
end;
$$;

create or replace function public.finish_game_attempt(
  p_attempt_id uuid,p_hits integer,p_misses integer,p_total integer,
  p_study_first_hits integer,p_duration_ms integer)
returns public.game_league_attempts language plpgsql security definer set search_path = '' as $$
declare v_attempt public.game_league_attempts; v_points integer;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into v_attempt from public.game_league_attempts where id=p_attempt_id for update;
  if not found or v_attempt.user_id<>auth.uid() then raise exception 'Intento no encontrado'; end if;
  if v_attempt.status='completed' then return v_attempt; end if;
  if v_attempt.started_at < now()-interval '2 hours' then raise exception 'Intento caducado'; end if;
  if p_duration_ms is null or p_duration_ms<0 or p_duration_ms>7200000 or
     p_hits is null or p_hits<0 or p_hits>400 or p_misses is null or p_misses<0 or p_misses>400 or
     p_total is null or p_total<1 or p_total>400 then raise exception 'Resultado no válido'; end if;
  if v_attempt.category='study' then
    if p_total<>10 or p_study_first_hits is null or p_study_first_hits not between 0 and 10 then raise exception 'Estudio no válido'; end if;
    v_points:=p_study_first_hits*10;
  elsif v_attempt.category like 'survival_%' then
    if p_hits+p_misses>p_total or p_misses>1 then raise exception 'Supervivencia no válida'; end if;
    v_points:=round(100.0*p_hits/p_total);
  else
    if p_total<>10 or p_hits+p_misses<>10 then raise exception 'Partida no válida'; end if;
    v_points:=p_hits*10;
  end if;
  update public.game_league_attempts set status='completed',points=v_points,
    hits=p_hits,total=p_total,duration_ms=p_duration_ms,completed_at=now()
    where id=p_attempt_id returning * into v_attempt;
  return v_attempt;
end;
$$;

create or replace function public.submit_game_daily(p_day date,p_correct boolean,p_clues_used integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_day is distinct from (now() at time zone 'Europe/Madrid')::date or
     p_correct is null or p_clues_used is null or p_clues_used not between 0 and 3 then
    raise exception 'Misterio no válido para hoy';
  end if;
  insert into public.game_league_daily(league_id,user_id,day,week_start,correct,clues_used)
    select league_id,auth.uid(),p_day,date_trunc('week',p_day::timestamp)::date,p_correct,p_clues_used
    from public.game_league_members where user_id=auth.uid()
    on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.is_game_league_member(uuid),public.create_game_league(text,text),
  public.join_game_league(text,text),public.reserve_game_attempt(uuid,text),
  public.finish_game_attempt(uuid,integer,integer,integer,integer,integer),
  public.submit_game_daily(date,boolean,integer) from public,anon;
grant execute on function public.is_game_league_member(uuid),public.create_game_league(text,text),
  public.join_game_league(text,text),public.reserve_game_attempt(uuid,text),
  public.finish_game_attempt(uuid,integer,integer,integer,integer,integer),
  public.submit_game_daily(date,boolean,integer) to authenticated;
commit;
