create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.story_bots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name varchar(120) not null,
  description text not null,
  avatar_symbol varchar(12) not null default '✦',
  behavioral_instruction text not null,
  story_premise text not null,
  role_options jsonb not null default '[]'::jsonb,
  world_rules text not null,
  ending_conditions text not null,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  allow_telegram_media boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.story_bot_access (
  story_bot_id uuid not null references public.story_bots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_bot_id, user_id)
);

create table public.story_runs (
  id uuid primary key default gen_random_uuid(),
  story_bot_id uuid not null references public.story_bots(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(180) not null,
  selected_role varchar(160) not null,
  status text not null default 'active' check (status in ('active', 'ended', 'archived')),
  state_summary text not null default '',
  state_json jsonb not null default '{}'::jsonb,
  ending_title varchar(180),
  ending_text text,
  message_count integer not null default 0,
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.story_messages (
  id uuid primary key default gen_random_uuid(),
  story_run_id uuid not null references public.story_runs(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  channel text not null check (channel in ('web', 'telegram', 'system')),
  sequence integer not null,
  media_kind text not null default 'none' check (media_kind in ('none', 'sticker', 'gif')),
  media_reference text,
  created_at timestamptz not null default now(),
  unique (story_run_id, sequence)
);

create table public.integration_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  grok_api_key_ciphertext text,
  grok_model varchar(80) not null default 'grok-4.6',
  telegram_bot_token_ciphertext text,
  telegram_webhook_secret_ciphertext text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.telegram_links (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  telegram_user_id varchar(32) unique,
  telegram_chat_id varchar(32),
  link_code_hash varchar(128),
  link_code_expires_at timestamptz,
  active_story_run_id uuid references public.story_runs(id) on delete set null,
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.telegram_updates (
  update_id varchar(32) primary key,
  processed_at timestamptz not null default now()
);

create table public.follow_up_preferences (
  story_run_id uuid primary key references public.story_runs(id) on delete cascade,
  is_opted_in boolean not null default false,
  inactivity_hours integer not null default 48 check (inactivity_hours between 24 and 720),
  last_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index story_bots_owner_id_idx on public.story_bots(owner_id);
create index story_bots_visibility_idx on public.story_bots(visibility);
create index story_runs_participant_status_updated_idx on public.story_runs(participant_id, status, updated_at desc);
create index story_messages_run_created_idx on public.story_messages(story_run_id, created_at);
create index telegram_links_telegram_user_id_idx on public.telegram_links(telegram_user_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email)); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger story_bots_updated_at before update on public.story_bots for each row execute procedure public.set_updated_at();
create trigger story_runs_updated_at before update on public.story_runs for each row execute procedure public.set_updated_at();
create trigger integration_settings_updated_at before update on public.integration_settings for each row execute procedure public.set_updated_at();
create trigger telegram_links_updated_at before update on public.telegram_links for each row execute procedure public.set_updated_at();
create trigger follow_up_preferences_updated_at before update on public.follow_up_preferences for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.story_bots enable row level security;
alter table public.story_bot_access enable row level security;
alter table public.story_runs enable row level security;
alter table public.story_messages enable row level security;
alter table public.integration_settings enable row level security;
alter table public.telegram_links enable row level security;
alter table public.telegram_updates enable row level security;
alter table public.follow_up_preferences enable row level security;

create policy "profiles own record" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "read visible bots" on public.story_bots for select using (not is_archived and (visibility = 'public' or owner_id = auth.uid() or exists (select 1 from public.story_bot_access a where a.story_bot_id = id and a.user_id = auth.uid())));
create policy "owners manage bots" on public.story_bots for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage bot access" on public.story_bot_access for all using (exists (select 1 from public.story_bots b where b.id = story_bot_id and b.owner_id = auth.uid())) with check (exists (select 1 from public.story_bots b where b.id = story_bot_id and b.owner_id = auth.uid()));
create policy "participants manage runs" on public.story_runs for all using (participant_id = auth.uid()) with check (participant_id = auth.uid());
create policy "participants manage messages" on public.story_messages for all using (exists (select 1 from public.story_runs r where r.id = story_run_id and r.participant_id = auth.uid())) with check (exists (select 1 from public.story_runs r where r.id = story_run_id and r.participant_id = auth.uid()));
create policy "users manage integration settings" on public.integration_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage their telegram link" on public.telegram_links for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "participants manage follow up preferences" on public.follow_up_preferences for all using (exists (select 1 from public.story_runs r where r.id = story_run_id and r.participant_id = auth.uid())) with check (exists (select 1 from public.story_runs r where r.id = story_run_id and r.participant_id = auth.uid()));
