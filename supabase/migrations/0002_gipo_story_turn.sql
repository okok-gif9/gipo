-- Persists message order safely when web and Telegram turns overlap.
create index if not exists story_messages_run_sequence_idx on public.story_messages(story_run_id, sequence);

create or replace function public.append_story_message(
  p_story_run_id uuid, p_role text, p_content text, p_channel text,
  p_media_kind text default 'none', p_media_reference text default null
)
returns public.story_messages
language plpgsql security definer set search_path = public
as $$
declare v_run public.story_runs; v_message public.story_messages; v_sequence integer;
begin
  if p_role not in ('user','assistant','system') or p_channel not in ('web','telegram','system') or p_media_kind not in ('none','sticker','gif') then
    raise exception 'invalid story message fields' using errcode = '22023';
  end if;
  select * into v_run from public.story_runs where id = p_story_run_id for update;
  if not found then raise exception 'story run not found' using errcode = 'P0002'; end if;
  if auth.role() <> 'service_role' and v_run.participant_id <> auth.uid() then raise exception 'story run access denied' using errcode = '42501'; end if;
  select coalesce(max(sequence), 0) + 1 into v_sequence from public.story_messages where story_run_id = p_story_run_id;
  insert into public.story_messages (story_run_id, role, content, channel, sequence, media_kind, media_reference)
  values (p_story_run_id, p_role, p_content, p_channel, v_sequence, p_media_kind, p_media_reference) returning * into v_message;
  update public.story_runs set message_count = message_count + 1, last_interaction_at = now(), updated_at = now() where id = p_story_run_id;
  return v_message;
end;
$$;
revoke all on function public.append_story_message(uuid, text, text, text, text, text) from public;
grant execute on function public.append_story_message(uuid, text, text, text, text, text) to authenticated, service_role;
