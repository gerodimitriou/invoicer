/**
 * Row types for the tables in supabase/migrations.
 *
 * These are written by hand rather than generated, because the schema is small
 * and this keeps the repo free of a codegen step. If the schema grows, swap
 * this file for `supabase gen types typescript`.
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

/** Shape passed to `createClient<Database>()` so queries are typed. */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Pick<Profile, "id" | "email"> & Partial<Profile>;
        Update: Partial<Profile>;
      };
      invoices: {
        Row: Invoice;
        Insert: Omit<Invoice, "id" | "created_at" | "updated_at"> &
          Partial<Pick<Invoice, "id">>;
        Update: Partial<Invoice>;
      };
      stripe_events: {
        Row: { id: string; type: string; processed_at: string };
        Insert: { id: string; type: string };
        Update: never;
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: { plan: Plan };
    CompositeTypes: Record<never, never>;
  };
};
