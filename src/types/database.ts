/**
 * Supabase-generated-style row types for Equilibrium.
 *
 * Mirrors the schema in `supabase/migrations/`. If you regenerate types from
 * `supabase gen types typescript`, overwrite this file — the shape is compatible.
 */

export type TransactionKind = 'income' | 'expense' | 'transfer';

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  currency: string;
  biometric_enabled: boolean;
  /** 'gregorian' | 'ethiopian' — drives period boundaries and date rendering. */
  calendar_system: 'gregorian' | 'ethiopian';
  /** 'amharic' | 'latin' — how Ethiopian month names render. */
  calendar_script: 'amharic' | 'latin';
  push_enabled: boolean;
  inapp_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type Wallet = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  starting_balance: number;
  currency: string;
  is_archived: boolean;
  created_at: string;
};

export type Category = {
  id: string;
  user_id: string | null; // null = system default category
  name: string;
  icon: string; // Material Symbols name
  color_token: 'primary' | 'secondary' | 'tertiary' | 'onSurfaceVariant';
  kind: TransactionKind;
  sort_order: number;
};

export type Transaction = {
  id: string;
  user_id: string;
  wallet_id: string;
  category_id: string;
  kind: TransactionKind;
  amount: number; // signed: negative for expense, positive for income
  merchant: string | null;
  note: string | null;
  occurred_at: string; // ISO
  created_at: string;
};

export type Budget = {
  id: string;
  user_id: string;
  category_id: string;
  amount: number; // spending limit (positive value)
  period: 'monthly' | 'weekly';
  start_on: string; // ISO date (month/week anchor)
  created_at: string;
};

/**
 * Shape consumed by Supabase's typed client.
 *
 * Two details are load-bearing and easy to lose when hand-editing this file:
 *
 *   1. **Every table needs `Relationships`.** postgrest-js constrains each
 *      table to `{ Row; Insert; Update; Relationships }`. Omit it and the
 *      table fails the `GenericSchema` check, `Schema` resolves to `never`,
 *      and *every* `.from(...)` call in the app silently degrades to `never` —
 *      losing all type safety on reads and writes while still compiling in
 *      most positions. An empty tuple is correct here: we never traverse
 *      foreign keys via embedded selects, we join client-side.
 *
 *   2. **`__InternalSupabase.PostgrestVersion`** tells the client which
 *      PostgREST dialect to type against. Without it the client defaults to
 *      '12', which happens to be right for current Supabase — declaring it
 *      makes that explicit rather than incidental.
 *
 * If you regenerate from `supabase gen types typescript`, overwrite this file;
 * the generated output includes both of the above.
 */
type NoRelationships = { Relationships: [] };

export type Database = {
  __InternalSupabase: { PostgrestVersion: '12' };
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
      } & NoRelationships;
      wallets: {
        Row: Wallet;
        Insert: Omit<Wallet, 'id' | 'created_at'>;
        Update: Partial<Wallet>;
      } & NoRelationships;
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id'>;
        Update: Partial<Category>;
      } & NoRelationships;
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, 'id' | 'created_at'>;
        Update: Partial<Transaction>;
      } & NoRelationships;
      budgets: {
        Row: Budget;
        Insert: Omit<Budget, 'id' | 'created_at'>;
        Update: Partial<Budget>;
      } & NoRelationships;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { transaction_kind: TransactionKind };
    CompositeTypes: Record<string, never>;
  };
};
