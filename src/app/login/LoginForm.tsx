"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { signIn, signUp, type AuthState } from "./actions";

type Mode = "signin" | "signup";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, null);

  return (
    <div className="w-full max-w-sm">
      <Link href="/" className="font-mono text-sm tracking-tight">
        invoicer
      </Link>

      <h1 className="mt-8 text-2xl font-medium tracking-tight">
        {mode === "signin" ? "Sign in" : "Create an account"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {mode === "signin"
          ? "Welcome back."
          : "You start on the free plan. No card needed."}
      </p>

      {/* key resets the form state when switching between sign in and sign up */}
      <form key={mode} action={formAction} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next} />

        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
            className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {state && "error" in state && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        {state && "message" in state && (
          <p role="status" className="text-sm text-accent">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-ink px-4 py-2.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-ink underline underline-offset-4"
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
