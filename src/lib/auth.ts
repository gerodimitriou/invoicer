import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * Returns the signed in user's profile, or redirects to the login page.
 *
 * Every page and route handler behind the dashboard goes through this, so the
 * plan a feature checks is always the one stored in the database rather than
 * anything the browser sent us.
 */
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    // The profile row is created by a trigger on auth.users, so this only
    // happens if the migration has not been run against this project.
    throw new Error(
      "No profile row for the signed in user. Did you run supabase/migrations/0001_init.sql?",
    );
  }

  return profile;
}
