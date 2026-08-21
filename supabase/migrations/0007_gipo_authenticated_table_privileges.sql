-- RLS policies filter rows; this migration grants the authenticated PostgREST
-- role only the table operations that those policies evaluate.
grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.story_bots,
  public.story_bot_access,
  public.story_runs,
  public.story_messages,
  public.integration_settings,
  public.telegram_links,
  public.follow_up_preferences
to authenticated;
