import { signOut } from "@/app/login/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="text-muted hover:text-ink text-sm">
        Sign out
      </button>
    </form>
  );
}
