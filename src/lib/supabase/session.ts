import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";

const PROTECTED_PREFIX = "/dashboard";

/**
 * Refreshes the Supabase session cookie on every request and keeps
 * unauthenticated visitors out of the dashboard. Called from src/proxy.ts.
 *
 * The cookie juggling below is required: tokens rotate, and the new cookies
 * have to be written onto the response that is actually returned, otherwise
 * the browser keeps sending the expired ones.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates the token with Supabase. getSession() only decodes
  // the cookie, which the client controls, so it is not enough on its own.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && pathname.startsWith(PROTECTED_PREFIX)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
