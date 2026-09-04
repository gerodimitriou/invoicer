import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

// Next.js 16 renamed the middleware convention to proxy. Same behaviour: this
// runs before the request is handled.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the Stripe webhook. The webhook is
     * excluded on purpose: it is authenticated by its signature, not by a
     * session cookie, and refreshing a session on it would be wasted work on
     * every Stripe delivery.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
