import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";

/**
 * Turns a Supabase auth error into something worth showing a user.
 *
 * Supabase messages are written for developers. "fetch failed" and "Invalid
 * login credentials" are accurate but they either say nothing useful or read
 * like a stack trace, so map the cases we expect and keep the raw message out
 * of the UI entirely.
 */
export function authErrorMessage(error: AuthError): string {
  // status 0 means the request never reached Supabase: no network, wrong
  // project URL, or a paused project. Free tier projects pause themselves
  // after about a week of inactivity, which is easy to mistake for a bug in
  // the app, so say so.
  if (isAuthRetryableFetchError(error) || error.status === 0) {
    return "Could not reach the authentication server. Check your connection, and if you are running this locally, check the Supabase project is not paused.";
  }

  switch (error.code) {
    case "invalid_credentials":
      return "That email and password do not match an account.";
    case "email_not_confirmed":
      return "Confirm your email address first. Check your inbox for the link.";
    case "user_already_exists":
    case "email_exists":
      return "An account with that email already exists. Sign in instead.";
    case "weak_password":
      return "That password is too easy to guess. Try a longer one.";
    case "email_address_invalid":
      return "That email address does not look valid.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    case "signup_disabled":
      return "New sign ups are currently disabled.";
    case "user_banned":
      return "That account has been suspended.";
    default:
      break;
  }

  // 5xx is Supabase having a bad day rather than anything the user did.
  if (error.status && error.status >= 500) {
    return "The authentication server is having trouble. Please try again in a moment.";
  }

  return "Could not sign you in. Please try again.";
}
