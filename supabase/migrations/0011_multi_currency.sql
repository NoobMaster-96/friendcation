-- ============================================================
-- Friendcation — Migration 0011: multi-currency expenses
--
-- Every expense stores its own ISO 4217 currency code next to its amount.
-- Balances are calculated and settled per currency and never converted, so
-- settlements carry a currency too.
--  * expenses.currency (in the schema since 0001, nullable) is now required
--    and must look like an ISO code.
--  * Amount columns widen from numeric(10,2) to numeric(14,2): high-denomination
--    currencies (IDR, KRW, PYG, UGX…) easily pass 99,999,999.
--  * user_profiles.home_currency: the default for a trip's first expense.
--  * save_expense() gains p_currency. When it's null (older app builds), a new
--    expense is INR and an edited one keeps its currency.
-- Apply after 0009. Re-runnable.
-- ============================================================

-- ============ EXPENSES ============
update public.expenses set currency = 'INR' where currency is null;
alter table public.expenses alter column currency set default 'INR';
alter table public.expenses alter column currency set not null;
alter table public.expenses drop constraint if exists expenses_currency_iso;
alter table public.expenses
  add constraint expenses_currency_iso check (currency ~ '^[A-Z]{3}$');

alter table public.expenses alter column amount type numeric(14,2);
alter table public.expense_splits alter column share_amount type numeric(14,2);

revoke update on public.expenses from anon, authenticated;
grant update (description, amount, currency, paid_by, category, expense_date)
  on public.expenses to authenticated;

-- ============ SETTLEMENTS ============
alter table public.settlements add column if not exists currency text not null default 'INR';
alter table public.settlements drop constraint if exists settlements_currency_iso;
alter table public.settlements
  add constraint settlements_currency_iso check (currency ~ '^[A-Z]{3}$');
alter table public.settlements alter column amount type numeric(14,2);

-- ============ USER_PROFILES ============
alter table public.user_profiles
  add column if not exists home_currency text not null default 'INR';
alter table public.user_profiles drop constraint if exists user_profiles_home_currency_iso;
alter table public.user_profiles
  add constraint user_profiles_home_currency_iso check (home_currency ~ '^[A-Z]{3}$');
-- Adds to the 0008 column grant (first_name, last_name, avatar_url).
grant update (home_currency) on public.user_profiles to authenticated;

-- ============ save_expense ============
-- Same as 0009 plus p_currency. The old six-argument version is dropped so
-- PostgREST has exactly one candidate; calls without p_currency still match.
drop function if exists public.save_expense(uuid, uuid, text, numeric, uuid, jsonb);

create or replace function public.save_expense(
  p_trip_id uuid,
  p_expense_id uuid,
  p_description text,
  p_amount numeric,
  p_paid_by uuid,
  p_splits jsonb,
  p_currency text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_expense_id;
  v_total numeric;
  v_currency text := upper(nullif(trim(p_currency), ''));
begin
  if coalesce(trim(p_description), '') = '' then
    raise exception 'Add a description.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than 0.';
  end if;
  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Choose a valid currency.';
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
    insert into public.expenses (trip_id, created_by, paid_by, description, amount, currency)
    values (p_trip_id, auth.uid(), p_paid_by, trim(p_description), p_amount, coalesce(v_currency, 'INR'))
    returning id into v_id;
  else
    update public.expenses
    set description = trim(p_description),
        amount = p_amount,
        paid_by = p_paid_by,
        currency = coalesce(v_currency, currency)
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

revoke all on function public.save_expense(uuid, uuid, text, numeric, uuid, jsonb, text) from public, anon;
grant execute on function public.save_expense(uuid, uuid, text, numeric, uuid, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
