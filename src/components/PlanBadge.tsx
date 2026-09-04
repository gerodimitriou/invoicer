import type { Plan } from "@/types/database";

export function PlanBadge({ plan }: { plan: Plan }) {
  const isPro = plan === "pro";

  return (
    <span
      className={
        isPro
          ? "bg-accent-soft text-accent rounded-full px-2.5 py-1 text-xs font-medium"
          : "bg-canvas text-muted rounded-full px-2.5 py-1 text-xs font-medium"
      }
    >
      {isPro ? "Pro" : "Free"}
    </span>
  );
}
