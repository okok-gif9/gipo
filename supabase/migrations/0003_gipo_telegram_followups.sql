create table if not exists public.follow_up_deliveries (
  id uuid primary key default gen_random_uuid(),
  story_run_id uuid not null references public.story_runs(id) on delete cascade,
  interaction_at timestamptz not null,
  status text not null default 'reserved' check (status in ('reserved', 'sent', 'failed')),
  reserved_at timestamptz not null default now(),
  sent_at timestamptz,
  error_code text,
  unique (story_run_id, interaction_at)
);
create index if not exists follow_up_deliveries_pending_idx on public.follow_up_deliveries(status, reserved_at);

create or replace function public.claim_due_follow_ups(p_limit integer default 25)
returns table (story_run_id uuid, interaction_at timestamptz)
language sql security definer set search_path = public
as $$
  with due as (
    select p.story_run_id, r.last_interaction_at
    from public.follow_up_preferences p join public.story_runs r on r.id = p.story_run_id
    where p.is_opted_in and r.status = 'active'
      and r.last_interaction_at <= now() - make_interval(hours => p.inactivity_hours)
      and (p.last_follow_up_at is null or p.last_follow_up_at < r.last_interaction_at)
    order by r.last_interaction_at asc limit greatest(1, least(p_limit, 100))
  ), claimed as (
    insert into public.follow_up_deliveries(story_run_id, interaction_at)
    select story_run_id, last_interaction_at from due
    on conflict (story_run_id, interaction_at) do nothing
    returning story_run_id, interaction_at
  ) select * from claimed;
$$;
revoke all on function public.claim_due_follow_ups(integer) from public;
grant execute on function public.claim_due_follow_ups(integer) to service_role;
