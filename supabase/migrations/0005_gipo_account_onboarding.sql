alter table public.profiles
  add column if not exists public_handle text,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists age_gate_acknowledged_at timestamptz,
  add column if not exists locale text not null default 'fa',
  add column if not exists theme_preference text not null default 'system',
  add column if not exists background_preference text not null default 'none',
  add column if not exists persona_name text,
  add column if not exists persona_pronouns text,
  add column if not exists persona_description text,
  add column if not exists persona_enabled_by_default boolean not null default false,
  add column if not exists profile_visibility text not null default 'private',
  add column if not exists account_status text not null default 'active',
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_effective_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_public_handle_format,
  drop constraint if exists profiles_locale_allowed,
  drop constraint if exists profiles_theme_allowed,
  drop constraint if exists profiles_background_allowed,
  drop constraint if exists profiles_visibility_allowed,
  drop constraint if exists profiles_account_status_allowed,
  drop constraint if exists profiles_persona_name_length,
  drop constraint if exists profiles_persona_pronouns_length,
  drop constraint if exists profiles_persona_description_length;

alter table public.profiles
  add constraint profiles_public_handle_format check (public_handle is null or public_handle ~ '^[a-z0-9_]{3,24}$'),
  add constraint profiles_locale_allowed check (locale in ('fa', 'en')),
  add constraint profiles_theme_allowed check (theme_preference in ('system', 'light', 'dark')),
  add constraint profiles_background_allowed check (background_preference in ('none', 'cats-dark', 'doodles-gradient')),
  add constraint profiles_visibility_allowed check (profile_visibility in ('private', 'public')),
  add constraint profiles_account_status_allowed check (account_status in ('active', 'deletion_pending')),
  add constraint profiles_persona_name_length check (persona_name is null or char_length(persona_name) <= 80),
  add constraint profiles_persona_pronouns_length check (persona_pronouns is null or char_length(persona_pronouns) <= 80),
  add constraint profiles_persona_description_length check (persona_description is null or char_length(persona_description) <= 600);

create unique index if not exists profiles_public_handle_lower_idx on public.profiles (lower(public_handle)) where public_handle is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, public_handle)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', new.email),
    lower(nullif(new.raw_user_meta_data->>'public_handle', ''))
  );
  return new;
end;
$$;

create or replace function public.is_active_account()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.account_status = 'active'
  );
$$;

grant execute on function public.is_active_account() to authenticated;

create or replace function public.protect_profile_lifecycle()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    if old.account_status = 'deletion_pending' then
      raise exception 'ACCOUNT_DELETION_PENDING';
    end if;
    if new.account_status is distinct from old.account_status
      or new.deletion_requested_at is distinct from old.deletion_requested_at
      or new.deletion_effective_at is distinct from old.deletion_effective_at then
      raise exception 'ACCOUNT_LIFECYCLE_MANAGED_SERVER_SIDE';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_lifecycle on public.profiles;
create trigger profiles_protect_lifecycle before update on public.profiles for each row execute procedure public.protect_profile_lifecycle();

drop policy if exists "read visible bots" on public.story_bots;
create policy "read visible bots" on public.story_bots for select using (
  public.is_active_account() and not is_archived and (
    visibility = 'public' or owner_id = auth.uid() or exists (
      select 1 from public.story_bot_access access where access.story_bot_id = id and access.user_id = auth.uid()
    )
  )
);

drop policy if exists "owners manage bots" on public.story_bots;
create policy "owners manage bots" on public.story_bots for all using (
  public.is_active_account() and owner_id = auth.uid()
) with check (
  public.is_active_account() and owner_id = auth.uid()
);

drop policy if exists "owners manage bot access" on public.story_bot_access;
create policy "owners manage bot access" on public.story_bot_access for all using (
  public.is_active_account() and exists (
    select 1 from public.story_bots bot where bot.id = story_bot_id and bot.owner_id = auth.uid()
  )
) with check (
  public.is_active_account() and exists (
    select 1 from public.story_bots bot where bot.id = story_bot_id and bot.owner_id = auth.uid()
  )
);

drop policy if exists "participants manage runs" on public.story_runs;
create policy "participants manage runs" on public.story_runs for all using (
  public.is_active_account() and participant_id = auth.uid()
) with check (
  public.is_active_account() and participant_id = auth.uid()
);

drop policy if exists "participants manage messages" on public.story_messages;
create policy "participants manage messages" on public.story_messages for all using (
  public.is_active_account() and exists (
    select 1 from public.story_runs run where run.id = story_run_id and run.participant_id = auth.uid()
  )
) with check (
  public.is_active_account() and exists (
    select 1 from public.story_runs run where run.id = story_run_id and run.participant_id = auth.uid()
  )
);

drop policy if exists "users manage integration settings" on public.integration_settings;
create policy "users manage integration settings" on public.integration_settings for all using (
  public.is_active_account() and user_id = auth.uid()
) with check (
  public.is_active_account() and user_id = auth.uid()
);

drop policy if exists "users manage their telegram link" on public.telegram_links;
create policy "users manage their telegram link" on public.telegram_links for all using (
  public.is_active_account() and user_id = auth.uid()
) with check (
  public.is_active_account() and user_id = auth.uid()
);

drop policy if exists "participants manage follow up preferences" on public.follow_up_preferences;
create policy "participants manage follow up preferences" on public.follow_up_preferences for all using (
  public.is_active_account() and exists (
    select 1 from public.story_runs run where run.id = story_run_id and run.participant_id = auth.uid()
  )
) with check (
  public.is_active_account() and exists (
    select 1 from public.story_runs run where run.id = story_run_id and run.participant_id = auth.uid()
  )
);
