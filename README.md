# Invoicer

A small invoicing app with a paid tier. You fill in your business details, the
client, and some line items, and it gives you back an A4 PDF. On the free plan
that PDF carries a watermark; on Pro it does not.

The app itself is deliberately plain. I built it to work through a Stripe
subscription properly end to end, so most of the thinking went into the
checkout and webhook side rather than into invoicing features.

## Tech stack

- Next.js 16 (App Router) and TypeScript
- Supabase for Postgres and auth
- Stripe for Checkout, subscriptions and webhooks, in test mode
- Tailwind CSS
- pdf-lib for the PDF export

I picked pdf-lib over the alternatives because it is pure JavaScript with no
native dependencies and no headless browser, so the export behaves the same on
my machine as it does on a serverless host. The tradeoff is that the invoice
layout is written by hand in points, which you can see in
`src/lib/invoices/pdf.ts`.

## How the subscription works

The short version: the browser never decides whether you are on Pro.

1. You click upgrade. The browser posts to `/api/stripe/checkout`, which
   creates a Stripe Checkout session on the server and returns its URL. Your
   Supabase user id goes along as `client_reference_id`.
2. You pay on Stripe's page and get redirected back to `/dashboard/billing`.
3. Separately, Stripe sends `checkout.session.completed` to
   `/api/stripe/webhook`. That handler verifies the signature, fetches the
   subscription, and writes `plan = 'pro'` onto your row in `profiles`.
4. The PDF route reads `profiles.plan` on every download and decides from that
   whether to stamp the watermark.

The redirect back from Stripe is not what unlocks anything. It is just a URL,
and anyone can visit it — so acting on it would mean handing out Pro to anyone
who typed the success URL into their address bar. The webhook is signed with a
secret only the server has, and it arrives after Stripe has actually confirmed
the payment.

It is also the only way to hear about things that happen with no browser in
the picture. If you cancel from the billing portal, or a renewal fails next
month, there is no page load to react to. Stripe sends
`customer.subscription.updated` or `.deleted`, and the same handler moves you
back to free.

Two details in `src/app/api/stripe/webhook/route.ts` that took me a while to
get right:

- Stripe delivers each event **at least once**, so the same event id can turn
  up twice. Every event id is inserted into a `stripe_events` table before any
  work happens, and a duplicate insert fails on the primary key, which is the
  signal to skip it. If the handler then throws, that row is deleted again,
  otherwise Stripe's retry would be mistaken for a duplicate and silently
  dropped.
- Webhook deliveries are **not ordered**. An `updated` event can land after a
  `deleted` one for the same subscription. So the handler re-fetches the
  subscription from Stripe instead of trusting the object in the payload, and
  writes whatever the current state is.

Signature verification needs the exact bytes Stripe sent, which is why the
handler reads `await request.text()` rather than `request.json()`. Parsing and
re-serialising changes the whitespace and the signature stops matching.

## Data model

Three tables, in `supabase/migrations/0001_init.sql`:

- `profiles` — one row per auth user, created by a trigger on signup. Holds
  `plan`, `stripe_customer_id` and `stripe_subscription_id`.
- `invoices` — belongs to a profile. Line items live in a `jsonb` column,
  because an invoice is always read and written whole and never queried by
  individual line.
- `stripe_events` — just processed event ids, used for the idempotency check
  described above.

Row level security is on for all three. `profiles` has a select policy and
deliberately **no** update policy: if the browser could write to that table it
could set its own plan to `pro` and skip paying. The only thing that writes
`plan` is the webhook handler, which uses the service role key.

## Running it locally

You need a Supabase project and a Stripe account. Both are free and everything
below stays in Stripe's test mode.

```bash
git clone <this repo>
cd invoicer
npm install
cp .env.example .env.local
```

**Supabase.** Create a project, then paste
`supabase/migrations/0001_init.sql` into the SQL editor and run it. From
Project Settings > API copy the project URL, the anon key and the service role
key. While you are in the dashboard, find the email provider settings under
Authentication and turn off "Confirm email" — otherwise every signup needs a
working inbox.

**Stripe.** In the dashboard, with test mode on:

- Developers > API keys, copy the secret key (`sk_test_...`).
- Products > add a product with a recurring monthly price. Copy the price id
  (`price_...`), not the product id.

Fill in `.env.local`:

| Variable                        | What it is                             |
| ------------------------------- | -------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key                      |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role key, server only |
| `STRIPE_SECRET_KEY`             | Stripe test secret key                 |
| `STRIPE_PRO_PRICE_ID`           | Price id of the monthly Pro plan       |
| `STRIPE_WEBHOOK_SECRET`         | Printed by `stripe listen`, see below  |
| `NEXT_PUBLIC_SITE_URL`          | `http://localhost:3000` in development |

Then:

```bash
npm run dev
```

### Webhooks in development

Stripe cannot reach `localhost`, so the CLI forwards events to it. Install it
(`brew install stripe/stripe-cli/stripe` on macOS), then in a second terminal:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

It prints a signing secret starting with `whsec_`. Put that in
`STRIPE_WEBHOOK_SECRET` and restart `npm run dev`. This secret is specific to
the `stripe listen` session and is different from the one you get for a
deployed endpoint.

Leave `stripe listen` running while you test. To replay an event without going
through checkout again:

```bash
stripe trigger customer.subscription.deleted
```

### Test cards

Any future expiry date, any CVC, any postcode.

| Card                  | What happens                                      |
| --------------------- | ------------------------------------------------- |
| `4242 4242 4242 4242` | Payment succeeds, subscription goes active        |
| `4000 0000 0000 9995` | Declined, insufficient funds                      |
| `4000 0025 0000 3155` | Requires 3D Secure, shows the authentication step |

With the first card you should see `checkout.session.completed` and
`customer.subscription.created` arrive in the `stripe listen` terminal, and the
badge in the header flip to Pro after a refresh. Download the same invoice
before and after to see the watermark disappear.

The declined card is worth trying too. Checkout does not complete, no
subscription becomes active, and the plan stays free — the plan is derived from
the subscription status, not from whether someone reached the success URL.

To test a cancellation, subscribe with `4242`, then use "Manage subscription"
on the billing page to cancel in Stripe's portal, and watch `stripe listen`
deliver `customer.subscription.deleted`. The badge goes back to Free.

## Project layout

```
src/
  app/
    api/
      invoices/[id]/pdf/   PDF generation, reads the plan and applies the gate
      stripe/checkout/     creates the Checkout session
      stripe/portal/       billing portal for cancelling
      stripe/webhook/      signature check, idempotency, plan updates
    dashboard/             invoice list, form, billing page
    login/                 sign in and sign up
  components/              form and billing UI
  lib/
    invoices/              validation, totals, PDF rendering
    stripe/                SDK instance and status to plan mapping
    supabase/              browser, server and service role clients
  types/database.ts        row types matching the migration
supabase/migrations/       the SQL to run against your project
```

## Limitations and things I would do next

This is a portfolio project, so a few things are knowingly left out:

- **Test mode only.** It has never processed a real payment. Going live means
  swapping the keys, creating a production webhook endpoint, and handling the
  cases below properly.
- **One product, two states.** Free and Pro, nothing else. There is no
  upgrade/downgrade between paid tiers, no annual option, no proration.
- **No refunds or dunning.** If a renewal fails the user drops to free and
  that is the end of it. A real product would email them and give them a grace
  period before cutting access off.
- **The database types are written by hand** rather than generated with
  `supabase gen types`. Fine for three tables, would not scale.
- **Auth is email and password only,** with no password reset flow and no rate
  limiting beyond what Supabase does by default.
- **No automated tests.** I verified the webhook by signing payloads against a
  local server and checking that missing, wrong, expired and tampered
  signatures are all rejected, but that is a script I ran rather than a suite
  in the repo. That is the first thing I would add.
- **The invoice PDF only handles Latin-1 text.** The standard PDF fonts cannot
  encode anything else, so characters outside that range are replaced. Fixing
  it properly means embedding a real font file.
