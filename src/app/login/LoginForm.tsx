"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { signIn, signUp, type AuthState } from "./actions";

type Mode = "signin" | "signup";

const inputClass =
  "border-line bg-surface focus:border-accent mt-1.5 w-full rounded-md border px-3 py-2 text-sm outline-none";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  // Held here rather than inside AuthFields so it survives the remount when
  // the mode changes. Retyping your email to switch tabs is annoying.
  const [email, setEmail] = useState("");

  return (
    <div className="w-full max-w-sm">
      <Link href="/" className="font-mono text-sm tracking-tight">
        invoicer
      </Link>

      <h1 className="mt-8 text-2xl font-medium tracking-tight">
        {mode === "signin" ? "Sign in" : "Create an account"}
      </h1>
      <p className="text-muted mt-2 text-sm">
        {mode === "signin"
          ? "Welcome back."
          : "You start on the free plan. No card needed."}
      </p>

      {/* A segmented control rather than a text link at the foot of the form.
          Switching mode only changes a heading and a button label, which is
          easy to miss, so make the current mode unmistakable. */}
      <div
        role="tablist"
        aria-label="Sign in or create an account"
        className="border-line bg-canvas mt-6 grid grid-cols-2 gap-1 rounded-lg border p-1"
      >
        {(["signin", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={
              mode === value
                ? "bg-surface text-ink rounded-md px-3 py-1.5 text-sm font-medium shadow-sm"
                : "text-muted hover:text-ink rounded-md px-3 py-1.5 text-sm"
            }
          >
            {value === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {/* Keyed on the mode so switching tabs remounts this and throws away the
          previous action result. Without it, the error from a failed sign in
          would still be sitting there under the sign up form. */}
      <AuthFields
        key={mode}
        mode={mode}
        next={next}
        email={email}
        onEmailChange={setEmail}
      />
    </div>
  );
}

function AuthFields({
  mode,
  next,
  email,
  onEmailChange,
}: {
  mode: Mode;
  next: string;
  email: string;
  onEmailChange: (value: string) => void;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    mode === "signin" ? signIn : signUp,
    null,
  );

  return (
    <form action={formAction} className="mt-8 space-y-4">
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
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          required
          className={inputClass}
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
          className={inputClass}
        />
      </div>

      {state && "error" in state && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state && "message" in state && (
        <p role="status" className="text-accent text-sm">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-ink w-full rounded-md px-4 py-2.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
