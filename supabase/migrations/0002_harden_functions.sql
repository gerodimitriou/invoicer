-- Hardening pass, from the warnings the Supabase database linter raises
-- against 0001. Run it after 0001.

-- ---------------------------------------------------------------------------
-- Pin the search_path on set_updated_at
-- ---------------------------------------------------------------------------
-- handle_new_user already pinned it; this one was missed. A function without a
-- fixed search_path resolves unqualified names against whatever the caller has
-- set, which is how search_path hijacking works.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stop handle_new_user being callable through the API
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE on new functions to PUBLIC by default, and Supabase
-- exposes everything in the public schema through PostgREST. That made a
-- SECURITY DEFINER function reachable as /rest/v1/rpc/handle_new_user with
-- nothing but the anon key.
--
-- It only ever runs as a trigger on auth.users, and Postgres checks EXECUTE
-- when the trigger is created rather than each time it fires, so taking the
-- grant away does not stop signups from creating profiles.

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

revoke execute on function public.set_updated_at() from public;
revoke execute on function public.set_updated_at() from anon;
revoke execute on function public.set_updated_at() from authenticated;
