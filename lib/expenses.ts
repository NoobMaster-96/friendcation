import { supabase } from './supabase';
import { fromMinor, toMinor } from './currencies';
import type { ExpenseListItem } from './types';

/** Newest first, so a just-added expense lands at the top of the list. */
export async function listExpenses(tripId: string): Promise<ExpenseListItem[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(
      'id,description,amount,currency,paid_by,expense_date,created_at,' +
        'payer:user_profiles!paid_by(first_name),' +
        'expense_splits(user_id, share_amount)'
    )
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
    .order('expense_date', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r: any) => {
    const payer = Array.isArray(r.payer) ? r.payer[0] : r.payer;
    const currency: string = r.currency ?? 'INR';
    return {
      id: r.id,
      description: r.description,
      amount: Number(r.amount),
      currency,
      paid_by: r.paid_by,
      payerName: payer?.first_name ?? null,
      expense_date: r.expense_date,
      splits: (r.expense_splits ?? []).map((s: any) => ({
        userId: s.user_id,
        shareMinor: toMinor(Number(s.share_amount), currency),
      })),
    };
  });
}

export type Settlement = {
  paidBy: string | null;
  paidTo: string | null;
  currency: string;
  amountMinor: number;
};

/** Settle-up payments recorded on the trip (each in its own currency). */
export async function listSettlements(tripId: string): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from('settlements')
    .select('paid_by,paid_to,amount,currency')
    .eq('trip_id', tripId);
  if (error) throw error;
  return (data ?? []).map((r: any) => {
    const currency: string = r.currency ?? 'INR';
    return {
      paidBy: r.paid_by,
      paidTo: r.paid_to,
      currency,
      amountMinor: toMinor(Number(r.amount), currency),
    };
  });
}

export type CurrencyBalance = { currency: string; netMinor: number };

/**
 * Your net position in each currency used on the trip (raw pairwise, per
 * handoff doc §2): positive = you are owed, negative = you owe. Currencies are
 * never mixed or converted, so an expense only moves its own currency's
 * balance. Settled (zero) currencies are left out; the currency of the newest
 * expense you're part of comes first.
 */
export function balancesByCurrency(
  expenses: ExpenseListItem[],
  settlements: Settlement[],
  userId: string
): CurrencyBalance[] {
  const net = new Map<string, number>();
  const add = (currency: string, minor: number) =>
    net.set(currency, (net.get(currency) ?? 0) + minor);

  for (const e of expenses) {
    for (const s of e.splits) {
      if (e.paid_by === userId && s.userId !== userId) add(e.currency, s.shareMinor); // others owe me
      else if (e.paid_by !== userId && s.userId === userId) add(e.currency, -s.shareMinor); // I owe
    }
  }
  for (const s of settlements) {
    if (s.paidBy === userId) add(s.currency, s.amountMinor); // I paid someone back
    if (s.paidTo === userId) add(s.currency, -s.amountMinor); // someone paid me back
  }
  return [...net]
    .filter(([, minor]) => minor !== 0)
    .map(([currency, netMinor]) => ({ currency, netMinor }));
}

// ============================================================
// Add / edit / delete — money is handled in integer minor units (paise, cents…)
// so splits add up exactly.
// ============================================================

/** Splits `totalMinor` over `count` people; the first `remainder` people get one minor unit more. */
export function splitEvenly(totalMinor: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalMinor / count);
  const remainder = totalMinor - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

export type ExpenseInput = {
  tripId: string;
  /** Omit to create a new expense. */
  expenseId?: string | null;
  paidBy: string;
  description: string;
  /** ISO 4217 code; amounts below are in its minor unit. */
  currency: string;
  amountMinor: number;
  splits: { userId: string; shareMinor: number }[];
};

/** Creates or updates an expense and its splits atomically (save_expense RPC, migrations 0009/0011). */
export async function saveExpense(input: ExpenseInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_expense', {
    p_trip_id: input.tripId,
    p_expense_id: input.expenseId ?? null,
    p_description: input.description.trim(),
    p_amount: fromMinor(input.amountMinor, input.currency),
    p_paid_by: input.paidBy,
    p_currency: input.currency,
    p_splits: input.splits
      .filter((s) => s.shareMinor > 0)
      .map((s) => ({ user_id: s.userId, share: fromMinor(s.shareMinor, input.currency) })),
  });
  if (error) throw error;
  return data as string;
}

/** Deletes an expense; its splits go with it (on delete cascade). */
export async function deleteExpense(expenseId: string): Promise<void> {
  const { data, error } = await supabase.from('expenses').delete().eq('id', expenseId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('This expense could not be deleted.');
}
