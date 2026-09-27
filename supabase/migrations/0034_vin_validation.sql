-- MOVA — real VIN validation, in the database as well as the form.
--
-- The listing that triggered this carried 1HGCM82633A004352: Honda's widely
-- published sample VIN, which was also the placeholder text in the seller
-- listing form's own VIN input. The only validation in place was a shape
-- check (/^[A-HJ-NPR-Z0-9]{17}$/), which that VIN passes — as does any
-- other published sample VIN, since they are real, structurally valid VINs.
--
-- This is the SQL port of lib/vin.ts. The two MUST agree; lib/vin.ts is the
-- canonical statement of the rules and carries the commentary explaining
-- each one. Anything added to BLOCKED_SAMPLE_VINS there needs adding to
-- public.blocked_vins here (and vice versa) — hence the blocklist living in
-- a table rather than inline in the function, so extending it in production
-- is an INSERT and not a migration.

-- 1. Blocklist -----------------------------------------------------------
--
-- Sample/demo/placeholder VINs, which no structural rule can catch: they are
-- genuine VINs with correct check digits, published in manufacturer and API
-- documentation. Must mirror BLOCKED_SAMPLE_VINS in lib/vin.ts.
create table public.blocked_vins (
  vin text primary key,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.blocked_vins is
  'Sample/demo VINs that must never be listed. Mirrors BLOCKED_SAMPLE_VINS in lib/vin.ts; keep both in sync.';

insert into public.blocked_vins (vin, note) values
  ('1HGCM82633A004352', '2003 Honda Accord — NHTSA vPIC''s own sample VIN; was also this app''s form placeholder'),
  ('1HGBH41JXMN109186', 'Honda sample VIN used across API docs and test data'),
  ('JH4TB2H26CC000000', 'Acura sample VIN (NHTSA decoder examples)'),
  ('WBA3A5C55CF256691', 'BMW sample VIN in common circulation'),
  ('3VWFE21C04M000123', 'VW sample VIN in common circulation'),
  ('WVWZZZ3BZWE689725', 'VW Passat sample VIN (European docs)'),
  ('1M8GDM9AXKP042788', 'NHTSA check-digit worked example'),
  ('11111111111111111', 'placeholder'),
  ('12345678901234567', 'placeholder');

-- Readable by anyone (so a client could surface the list), writable only by
-- admins / the service role. RLS on, since it lives in the exposed schema.
alter table public.blocked_vins enable row level security;

create policy "blocked vins public read" on public.blocked_vins
  for select using (true);

create policy "blocked vins admin write" on public.blocked_vins
  for all using (public.is_admin()) with check (public.is_admin());

-- 2. ISO 3779 check digit ------------------------------------------------
create or replace function public.vin_check_digit(vin text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  weights int[] := array[8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
  total int := 0;
  ch text;
  val int;
  i int;
  remainder int;
begin
  if vin is null or length(vin) <> 17 then
    return null;
  end if;

  for i in 1..17 loop
    ch := substr(vin, i, 1);
    val := case
      when ch between '0' and '9' then ch::int
      when ch in ('A','J') then 1
      when ch in ('B','K','S') then 2
      when ch in ('C','L','T') then 3
      when ch in ('D','M','U') then 4
      when ch in ('E','N','V') then 5
      when ch in ('F','W') then 6
      when ch in ('G','P','X') then 7
      when ch in ('H','Y') then 8
      when ch in ('R','Z') then 9
      else 0
    end;
    total := total + val * weights[i];
  end loop;

  remainder := total % 11;
  return case when remainder = 10 then 'X' else remainder::text end;
end;
$$;

-- 3. Placeholder-pattern detection --------------------------------------
--
-- Longest run of consecutive characters over the VIN alphabet (which skips
-- I/O/Q, so the gaps don't break a run). 12 of 17 in one run is placeholder
-- data; real VINs do contain short consecutive runs. Mirrors isSequential()
-- in lib/vin.ts, wrap-around included.
create or replace function public.vin_is_sequential(vin text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  alphabet text := '0123456789ABCDEFGHJKLMNPRSTUVWXYZ';
  n int := 33;
  asc_run int := 1;
  desc_run int := 1;
  longest_asc int := 1;
  longest_desc int := 1;
  prev int;
  cur int;
  step int;
  i int;
begin
  if vin is null or length(vin) <> 17 then
    return false;
  end if;

  prev := position(substr(vin, 1, 1) in alphabet) - 1;
  if prev < 0 then
    return false;
  end if;

  for i in 2..17 loop
    cur := position(substr(vin, i, 1) in alphabet) - 1;
    if cur < 0 then
      return false;
    end if;
    step := ((cur - prev) % n + n) % n;
    asc_run := case when step = 1 then asc_run + 1 else 1 end;
    desc_run := case when step = n - 1 then desc_run + 1 else 1 end;
    longest_asc := greatest(longest_asc, asc_run);
    longest_desc := greatest(longest_desc, desc_run);
    prev := cur;
  end loop;

  return greatest(longest_asc, longest_desc) >= 12;
end;
$$;

-- 4. The validator itself ------------------------------------------------
--
-- STABLE, not IMMUTABLE: it reads public.blocked_vins, so it cannot be used
-- in an index — but a CHECK constraint only needs it evaluated per row at
-- write time, which is fine. (This is why the constraint calls a function
-- rather than inlining the blocklist: extending the list in production is
-- then an INSERT, with no ALTER TABLE and no table rewrite.)
create or replace function public.vin_is_valid(vin text)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v text;
begin
  if vin is null then
    return false;
  end if;

  v := upper(btrim(vin));

  -- Exactly 17 characters, no I/O/Q.
  if v !~ '^[A-HJ-NPR-Z0-9]{17}$' then
    return false;
  end if;

  -- Published sample/demo VINs.
  if exists (select 1 from public.blocked_vins b where upper(b.vin) = v) then
    return false;
  end if;

  -- Every character the same.
  if length(regexp_replace(v, '(.)\1*', '\1', 'g')) = 1 then
    return false;
  end if;

  -- One long consecutive run.
  if public.vin_is_sequential(v) then
    return false;
  end if;

  -- ISO 3779 check digit, for North American WMIs only (first char 1-5).
  -- Elsewhere the digit is optional and plenty of legitimately imported
  -- vehicles fail it.
  if v ~ '^[1-5]' and public.vin_check_digit(v) is distinct from substr(v, 9, 1) then
    return false;
  end if;

  return true;
end;
$$;

grant execute on function public.vin_check_digit(text) to anon, authenticated;
grant execute on function public.vin_is_sequential(text) to anon, authenticated;
grant execute on function public.vin_is_valid(text) to anon, authenticated;

-- 5. The constraint ------------------------------------------------------
--
-- NOT VALID: enforced on every INSERT and on any UPDATE that touches the
-- row, but NOT retroactively verified against rows already in the table, so
-- adding it cannot fail on — or lock out — existing listings. Same
-- grandfathering posture as 0023/0031. Deliberately never VALIDATEd: the
-- pre-existing rows that would fail are real listings whose history we
-- aren't rewriting.
alter table public.vehicles
  add constraint vehicles_vin_valid
  check (public.vin_is_valid(vin)) not valid;
