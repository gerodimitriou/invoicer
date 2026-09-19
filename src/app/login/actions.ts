"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/auth-errors";
import { publicEnv } from "@/lib/env";

export type AuthState = { error: string } | { message: string } | null;

const credentials = (formData: FormData) => ({
  email: String(formData.get("email") ?? "").trim(),
  password: String(formData.get("password") ?? ""),
});

/** Only allow relative paths, so ?next= cannot be used as an open redirect. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = credentials(formData);
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: authErrorMessage(error) };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = credentials(formData);
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback` },
  });

  if (error) {
    return { error: authErrorMessage(error) };
  }

  // With email confirmation switched off in Supabase, sign up returns a
  // session and we can go straight in. With it on, there is no session yet and
  // the user has to click the link in their inbox first.
  if (!data.session) {
    return { message: "Check your inbox for a confirmation link." };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
