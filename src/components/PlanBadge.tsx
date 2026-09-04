import type { Plan } from "@/types/database";

export function PlanBadge({ plan }: { plan: Plan }) {
  const isPro = plan === "pro";

  return (
    <span
      className={
        isPro
          ? "rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
          : "rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-muted"
      }
    >
      {isPro ? "Pro" : "Free"}
    </span>
  );
}
