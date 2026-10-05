-- ============================================================
-- Friendcation — Migration 0009: expenses are editable by any trip member
--
-- Splitwise-style: any member of a trip can edit or delete any of its expenses
-- and their splits (0008 allowed only the person who logged it). created_by
-- still records who logged an expense and can't be rewritten; payers and split
-- members must belong to the trip.
--
-- save_expense() creates or updates an expense together with its splits in one
-- transaction. It's SECURITY INVOKER, so the RLS policies below still apply.
-- Apply after 0008. Re-runnable.
-- ============================================================

-- ============ EXPENSES ============
drop policy if exists "expenses: creator can edit" on public.expenses;
drop policy if exists "expenses: creator can delete" on public.expenses;

drop policy if exists "expenses: members edit, paid by a trip-mate" on public.expenses;
create policy "expenses: members edit, paid by a trip-mate"
  on public.expenses for update to authenticated
  using (public.is_trip_member(trip_id))
  with check (
    public.is_trip_member(trip_id)
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = expenses.trip_id and tm.user_id = expenses.paid_by
    )
  );

drop policy if exists "expenses: members delete" on public.expenses;
create policy "expenses: members delete"
  on public.expenses for delete to authenticated
  using (public.is_trip_member(trip_id));

revoke update on public.expenses from anon, authenticated;
grant update (description, amount, paid_by, category, expense_date)
  on public.expenses to authenticated;

-- ============ EXPENSE_SPLITS ============
drop policy if exists "splits: expense creator adds trip-mates" on public.expense_splits;
drop policy if exists "splits: expense creator edits" on public.expense_splits;
drop policy if exists "splits: expense creator deletes" on public.expense_splits;

drop policy if exists "splits: members add trip-mates" on public.expense_splits;
create policy "splits: members add trip-mates"
  on public.expense_splits for insert to authenticated
  with check (
    exists (
      select 1 from public.expenses e
      join public.trip_members tm
        on tm.trip_id = e.trip_id and tm.user_id = expense_splits.user_id
      where e.id = expense_splits.expense_id and public.is_trip_member(e.trip_id)
    )
  );

drop policy if exists "splits: members edit" on public.expense_splits;
create policy "splits: members edit"
  on public.expense_splits for update to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and public.is_trip_member(e.trip_id)
    )
  )
  with check (
    exists (
      select 1 from public.expenses e
      join public.trip_members tm
        on tm.trip_id = e.trip_id and tm.user_id = expense_splits.user_id
      where e.id = expense_splits.expense_id and public.is_trip_member(e.trip_id)
    )
  );

drop policy if exists "splits: members delete" on public.expense_splits;
create policy "splits: members delete"
  on public.expense_splits for delete to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and public.is_trip_member(e.trip_id)
    )
  );

-- ============ save_expense ============
-- p_expense_id null = create; otherwise update that expense and replace its splits.
-- p_splits: [{ "user_id": uuid, "share": number }, …] — shares must sum to p_amount.
create or replace function public.save_expense(
  p_trip_id uuid,
  p_expense_id uuid,
  p_description text,
  p_amount numeric,
  p_paid_by uuid,
  p_splits jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_expense_id;
  v_total numeric;
begin
  if coalesce(trim(p_description), '') = '' then
    raise exception 'Add a description.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than 0.';
  end if;
  if p_splits is null or jsonb_array_length(p_splits) = 0 then
    raise exception 'Split with at least one person.';
  end if;
  select coalesce(sum((s ->> 'share')::numeric), 0) into v_total
  from jsonb_array_elements(p_splits) s;
  if v_total <> p_amount then
    raise exception 'Shares must add up to the amount.';
  end if;

  if v_id is null then
    insert into public.expenses (trip_id, created_by, paid_by, description, amount)
    values (p_trip_id, auth.uid(), p_paid_by, trim(p_description), p_amount)
    returning id into v_id;
  else
    update public.expenses
    set description = trim(p_description), amount = p_amount, paid_by = p_paid_by
    where id = v_id and trip_id = p_trip_id;
    if not found then
      raise exception 'Expense not found.' using errcode = '42501';
    end if;
    delete from public.expense_splits where expense_id = v_id;
  end if;

  insert into public.expense_splits (expense_id, user_id, share_amount)
  select v_id, (s ->> 'user_id')::uuid, (s ->> 'share')::numeric
  from jsonb_array_elements(p_splits) s
  where (s ->> 'share')::numeric > 0;

  return v_id;
end;
$$;

revoke all on function public.save_expense(uuid, uuid, text, numeric, uuid, jsonb) from public, anon;
grant execute on function public.save_expense(uuid, uuid, text, numeric, uuid, jsonb) to authenticated;
