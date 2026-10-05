import { supabase } from './supabase';
import type { ExpenseListItem } from './types';

/** Newest first, so a just-added expense lands at the top of the list. */
export async function listExpenses(tripId: string): Promise<ExpenseListItem[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(
      'id,description,amount,currency,paid_by,expense_date,created_at,' +
        'payer:user_profiles!paid_by(first_name)'
    )
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
    .order('expense_date', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r: any) => {
    const payer = Array.isArray(r.payer) ? r.payer[0] : r.payer;
    return {
      id: r.id,
      description: r.description,
      amount: Number(r.amount),
      currency: r.currency ?? 'INR',
      paid_by: r.paid_by,
      payerName: payer?.first_name ?? null,
      expense_date: r.expense_date,
    };
  });
}

/**
 * Net balance for the user across the trip (raw pairwise, per handoff doc §2):
 * positive = you are owed, negative = you owe.
 */
export async function computeNetBalance(tripId: string, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('expense_splits')
    .select('user_id, share_amount, expenses!inner(trip_id, paid_by)')
    .eq('expenses.trip_id', tripId);
  if (error) throw error;

  let net = 0;
  for (const row of (data ?? []) as any[]) {
    const expense = Array.isArray(row.expenses) ? row.expenses[0] : row.expenses;
    const share = Number(row.share_amount);
    const payer = expense?.paid_by;
    const ower = row.user_id;
    if (payer === userId && ower !== userId) net += share; // others owe me
    else if (payer !== userId && ower === userId) net -= share; // I owe others
  }
  return net;
}

/** "1,400" or "466.67" — Indian digit grouping, paise only when present. */
export function formatAmount(amount: number): string {
  const abs = Math.round(Math.abs(amount) * 100) / 100;
  const hasPaise = abs % 1 !== 0;
  return abs.toLocaleString('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export function formatMoney(amount: number, currency = 'INR'): string {
  const prefix = currency === 'INR' ? 'Rs. ' : `${currency} `;
  return prefix + formatAmount(amount);
}

// ============================================================
// Add expense — money is handled in integer paise so splits add up exactly.
// ============================================================

export function toPaise(value: string | number): number {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Splits `totalPaise` over `count` people; the first `remainder` people get one paisa more. */
export function splitEvenly(totalPaise: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalPaise / count);
  const remainder = totalPaise - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

export type NewExpense = {
  tripId: string;
  createdBy: string;
  paidBy: string;
  description: string;
  amountPaise: number;
  splits: { userId: string; sharePaise: number }[];
};

export async function createExpense(input: NewExpense): Promise<void> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      trip_id: input.tripId,
      created_by: input.createdBy,
      paid_by: input.paidBy,
      description: input.description.trim(),
      amount: input.amountPaise / 100,
    })
    .select('id')
    .single();
  if (error) throw error;
  const expenseId = data.id as string;

  const rows = input.splits
    .filter((s) => s.sharePaise > 0)
    .map((s) => ({ expense_id: expenseId, user_id: s.userId, share_amount: s.sharePaise / 100 }));
  const { error: splitError } = await supabase.from('expense_splits').insert(rows);
  if (splitError) {
    // PostgREST has no multi-table transaction: don't leave an expense without its splits.
    await supabase.from('expenses').delete().eq('id', expenseId);
    throw splitError;
  }
}
