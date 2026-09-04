-- Initial schema: profiles, invoices, and the Stripe webhook event log.
-- Run this in the Supabase SQL editor, or with `supabase db push` if you use
-- the Supabase CLI.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- One row per auth user. Holds the billing state we care about: which plan the
-- user is on, and the Stripe ids we need to match a webhook back to a user.

create type public.plan as enum ('free', 'pro');

create table public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  email                  text not null,
  plan                   public.plan not null default 'free',
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  -- When the paid period ends. Only used to show "renews on ..." in the UI;
  -- access is decided by `plan`, which the webhook keeps up to date.
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Webhooks arrive by stripe_customer_id, so this lookup needs to be fast.
create index profiles_stripe_customer_id_idx on public.profiles (stripe_customer_id);

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
-- Line items live in a jsonb column rather than their own table. An invoice is
-- always read and written as a whole document, never queried by line item, so
-- a separate table would only add joins.

create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,

  invoice_number text not null,
  issue_date     date not null default current_date,
  due_date       date,
  currency       text not null default 'EUR',

  business_name    text not null,
  business_email   text,
  business_address text,

  client_name    text not null,
  client_email   text,
  client_address text,

  -- [{ "description": string, "quantity": number, "unit_price": number }]
  line_items jsonb not null default '[]'::jsonb,

  tax_rate   numeric(5, 2) not null default 0,
  -- Totals are computed on the server when the invoice is saved and stored
  -- here, so a PDF re-downloaded a year later shows the same numbers even if
  -- the rounding rules in the app change.
  subtotal   numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total      numeric(12, 2) not null default 0,

  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_user_id_created_at_idx
  on public.invoices (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- stripe_events
-- ---------------------------------------------------------------------------
-- Stripe guarantees at-least-once delivery, so the same event id can arrive
-- more than once (retries, or the CLI replaying an event). We insert the id
-- before doing any work; a duplicate insert fails on the primary key and we
-- skip the event instead of applying it twice.

create table public.stripe_events (
  id           text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Create a profile whenever a user signs up
-- ---------------------------------------------------------------------------
-- Doing this in a trigger means the profile exists no matter how the user was
-- created (sign up form, dashboard, seed script), so the rest of the app can
-- assume a profile row is always there.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Keep updated_at honest
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.invoices      enable row level security;
alter table public.stripe_events enable row level security;

-- A user can read their own profile, and that is all. There is deliberately no
-- update policy: if the browser could write to profiles it could set its own
-- plan to 'pro' and skip paying. The plan column is only ever written by the
-- webhook handler, which uses the service role key and bypasses RLS.
create policy "Users can read their own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "Users can read their own invoices"
  on public.invoices for select
  using ((select auth.uid()) = user_id);

create policy "Users can create their own invoices"
  on public.invoices for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own invoices"
  on public.invoices for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own invoices"
  on public.invoices for delete
  using ((select auth.uid()) = user_id);

-- stripe_events has RLS on and no policies at all, so it is unreachable with
-- the anon key. Only the service role touches it.
