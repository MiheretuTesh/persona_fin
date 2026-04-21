/**
 * Supabase-generated-style row types for Equilibrium.
 *
 * Mirrors the schema in `supabase/migrations/`. If you regenerate types from
 * `supabase gen types typescript`, overwrite this file — the shape is compatible.
 */

export type TransactionKind = 'income' | 'expense' | 'transfer';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  currency: string;
  biometric_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  starting_balance: number;
  currency: string;
  is_archived: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string | null; // null = system default category
  name: string;
  icon: string; // Material Symbols name
  color_token: 'primary' | 'secondary' | 'tertiary' | 'onSurfaceVariant';
  kind: TransactionKind;
  sort_order: number;
}

export interface Transaction {
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
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number; // spending limit (positive value)
  period: 'monthly' | 'weekly';
  start_on: string; // ISO date (month/week anchor)
  created_at: string;
}

/** Shape consumed by Supabase's typed client. */
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string }; Update: Partial<Profile> };
      wallets: { Row: Wallet; Insert: Omit<Wallet, 'id' | 'created_at'>; Update: Partial<Wallet> };
      categories: { Row: Category; Insert: Omit<Category, 'id'>; Update: Partial<Category> };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, 'id' | 'created_at'>;
        Update: Partial<Transaction>;
      };
      budgets: { Row: Budget; Insert: Omit<Budget, 'id' | 'created_at'>; Update: Partial<Budget> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { transaction_kind: TransactionKind };
    CompositeTypes: Record<string, never>;
  };
};
