import { createClient } from "@supabase/supabase-js";

import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client using the service role key, which bypasses row level
 * security.
 *
 * This exists for one caller: the Stripe webhook handler. A webhook is an
 * anonymous POST from Stripe, so there is no user session to act on behalf of,
 * and the row it needs to update (profiles.plan) is intentionally not
 * writable by users. Do not import this anywhere a request can reach it with
 * user supplied input.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
