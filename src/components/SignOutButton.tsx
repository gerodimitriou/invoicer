import { signOut } from "@/app/login/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="text-sm text-muted hover:text-ink">
        Sign out
      </button>
    </form>
  );
}
