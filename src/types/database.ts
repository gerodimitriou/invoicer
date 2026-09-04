/**
 * Row types for the tables in supabase/migrations.
 *
 * Written by hand rather than generated, because the schema is small and this
 * keeps the repo free of a codegen step. If it grows, swap this file for the
 * output of `supabase gen types typescript`.
 */

export type Plan = "free" | "pro";

export type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
};

export type Profile = {
  id: string;
  email: string;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type Invoice = {
  id: string;
  user_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  currency: string;
  business_name: string;
  business_email: string | null;
  business_address: string | null;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  line_items: LineItem[];
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type StripeEvent = {
  id: string;
  type: string;
  processed_at: string;
};

/** Columns the database fills in for us on insert. */
type Generated = "id" | "created_at" | "updated_at";

/** Passed to `createClient<Database>()` so every query is typed. */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Pick<Profile, "id" | "email"> & Partial<Omit<Profile, "id" | "email">>;
        Update: Partial<Omit<Profile, "id">>;
        Relationships: [];
      };
      invoices: {
        Row: Invoice;
        Insert: Omit<Invoice, Generated> & Partial<Pick<Invoice, Generated>>;
        Update: Partial<Omit<Invoice, "id" | "user_id">>;
        Relationships: [];
      };
      stripe_events: {
        Row: StripeEvent;
        Insert: Pick<StripeEvent, "id" | "type"> &
          Partial<Pick<StripeEvent, "processed_at">>;
        Update: Partial<StripeEvent>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: { plan: Plan };
    CompositeTypes: Record<never, never>;
  };
};
