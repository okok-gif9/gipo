create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, public_handle, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', new.email),
    lower(nullif(new.raw_user_meta_data->>'public_handle', '')),
    case when new.raw_user_meta_data->>'locale' in ('fa', 'en') then new.raw_user_meta_data->>'locale' else 'fa' end
  );
  return new;
end;
$$;
