import { supabase } from './supabase';
import type { ExpenseListItem } from './types';

export async function listExpenses(tripId: string): Promise<ExpenseListItem[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(
      'id,description,amount,currency,paid_by,expense_date,created_at,' +
        'payer:user_profiles!paid_by(first_name)'
    )
    .eq('trip_id', tripId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });
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

export function formatMoney(amount: number, currency = 'INR'): string {
  const prefix = currency === 'INR' ? 'Rs. ' : `${currency} `;
  return prefix + Math.round(Math.abs(amount)).toLocaleString('en-IN');
}
