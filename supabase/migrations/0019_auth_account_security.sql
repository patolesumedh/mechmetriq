-- =====================================================================
-- MECHmetrIQ — E1 Authentication & Account Security
--
-- F1.2  email + mobile verification flags kept in sync from auth.users
-- F1.3  sign-up rules (role, mobile, GSTIN, Terms consent) enforced in the
--       signup trigger, not just in the form
-- F1.4  admin powers (is_admin) require an MFA-verified session (aal2)
-- F1.5  account_status (active / suspended) for status-based routing
-- F1.6  list / revoke my own sessions; admins suspending a user ends theirs
--
-- Also closes a privilege-escalation hole: profiles_update_own let any user
-- set their own role to 'admin' (and sign-up metadata accepted role=admin).
--
-- NOT additive: deploy together with the matching app version. The old
-- register form does not send `terms_accepted`, and old admin pages do not
-- ask for MFA, so both stop working against this schema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New profile columns
-- ---------------------------------------------------------------------
do $$ begin
  create type public.account_status as enum ('active', 'suspended');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists account_status public.account_status not null default 'active',
  add column if not exists suspended_reason text,
  add column if not exists terms_accepted_at timestamptz,
  -- Accounts created before this migration are not forced through mobile
  -- verification on their next login; every new account is.
  add column if not exists verification_required boolean not null default false;

-- Backfill email_verified from Supabase Auth for existing accounts.
update public.profiles p
   set email_verified = true
  from auth.users u
 where u.id = p.id and u.email_confirmed_at is not null and not p.email_verified;

-- ---------------------------------------------------------------------
-- 2. Validation helpers (mirrored in src/lib/auth/validation.ts)
-- ---------------------------------------------------------------------
create or replace function public.normalize_in_mobile(p text)
returns text
language sql
immutable
set search_path = public
as $$
  -- Accepts "9876543210", "+91 98765 43210", "09876543210", "919876543210".
  select case
    when d ~ '^[6-9][0-9]{9}$' then d
    when d ~ '^(91|0)[6-9][0-9]{9}$' then right(d, 10)
    else null
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) s;
$$;

create or replace function public.is_valid_gstin(p text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  chars constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  g text := upper(coalesce(p, ''));
  total int := 0;
  v int;
  prod int;
  i int;
begin
  if g !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    return false;
  end if;
  -- Mod-36 checksum on the 15th character.
  for i in 1..14 loop
    v := strpos(chars, substr(g, i, 1)) - 1;
    prod := v * (case when i % 2 = 0 then 2 else 1 end);
    total := total + (prod / 36) + (prod % 36);
  end loop;
  return substr(chars, ((36 - (total % 36)) % 36) + 1, 1) = substr(g, 15, 1);
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Sign-up trigger: server-side validation (F1.3)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  new_role user_role;
  mobile text := public.normalize_in_mobile(meta ->> 'phone');
  gst text := nullif(upper(trim(coalesce(meta ->> 'gstin', ''))), '');
begin
  -- Self sign-up can only create buyers and vendors. Admins are promoted
  -- by another admin, never chosen at sign-up.
  if coalesce(meta ->> 'role', 'buyer') not in ('buyer', 'vendor') then
    raise exception 'Invalid account type.' using errcode = '22023';
  end if;
  new_role := coalesce(meta ->> 'role', 'buyer')::user_role;

  if coalesce(trim(meta ->> 'full_name'), '') = '' then
    raise exception 'Full name is required.' using errcode = '22023';
  end if;
  if mobile is null then
    raise exception 'Enter a valid 10-digit Indian mobile number.' using errcode = '22023';
  end if;
  if coalesce(meta ->> 'terms_accepted', 'false') <> 'true' then
    raise exception 'You must agree to the Terms of Service and Privacy Policy.' using errcode = '22023';
  end if;
  if new_role = 'vendor' then
    if coalesce(trim(meta ->> 'company_name'), '') = '' then
      raise exception 'Company name is required for vendor accounts.' using errcode = '22023';
    end if;
    if gst is null or not public.is_valid_gstin(gst) then
      raise exception 'Enter a valid 15-character GSTIN.' using errcode = '22023';
    end if;
    if coalesce(meta ->> 'vendor_type', '') not in ('fabrication', 'raw_material') then
      raise exception 'Invalid vendor type.' using errcode = '22023';
    end if;
  end if;

  perform set_config('mmq.trusted_profile_write', 'on', true);

  insert into profiles (id, role, full_name, email, phone, email_verified,
                        terms_accepted_at, verification_required)
  values (new.id, new_role, trim(meta ->> 'full_name'), new.email, mobile,
          new.email_confirmed_at is not null, now(), true);

  if new_role = 'vendor' then
    insert into vendor_profiles (id, vendor_type, company_name, gstin)
    values (new.id, (meta ->> 'vendor_type')::vendor_type, trim(meta ->> 'company_name'), gst);
  end if;

  perform set_config('mmq.trusted_profile_write', 'off', true);
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Keep verification flags in sync with Supabase Auth (F1.2)
-- ---------------------------------------------------------------------
create or replace function public.sync_auth_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not distinct from old.email_confirmed_at
     and new.phone_confirmed_at is not distinct from old.phone_confirmed_at
     and new.phone is not distinct from old.phone
     and new.email is not distinct from old.email then
    return new;
  end if;

  perform set_config('mmq.trusted_profile_write', 'on', true);
  update profiles p
     set email_verified = new.email_confirmed_at is not null,
         email = coalesce(new.email, p.email),
         phone_verified = new.phone_confirmed_at is not null and new.phone is not null,
         phone = case
                   when new.phone_confirmed_at is not null and new.phone is not null
                     then coalesce(public.normalize_in_mobile(new.phone), p.phone)
                   else p.phone
                 end
   where p.id = new.id;
  perform set_config('mmq.trusted_profile_write', 'off', true);
  return new;
end;
$$;

drop trigger if exists trg_sync_auth_verification on auth.users;
create trigger trg_sync_auth_verification
  after update on auth.users
  for each row execute function public.sync_auth_verification();

-- ---------------------------------------------------------------------
-- 5. Users cannot change their own role, verification or suspension
-- ---------------------------------------------------------------------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Trusted writers: the auth triggers above, service-role calls (no user
  -- JWT), and MFA-verified admins.
  if current_setting('mmq.trusted_profile_write', true) = 'on'
     or auth.uid() is null
     or is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.email is distinct from old.email
     or new.email_verified is distinct from old.email_verified
     or new.account_status is distinct from old.account_status
     or new.suspended_reason is distinct from old.suspended_reason
     or new.terms_accepted_at is distinct from old.terms_accepted_at
     or new.verification_required is distinct from old.verification_required then
    raise exception 'these fields can only be changed by an admin';
  end if;

  -- Editing the mobile number on the profile form un-verifies it, unless it
  -- is the number already confirmed with Supabase Auth.
  if new.phone is distinct from old.phone then
    new.phone_verified := exists (
      select 1 from auth.users u
       where u.id = new.id
         and u.phone_confirmed_at is not null
         and public.normalize_in_mobile(u.phone) = public.normalize_in_mobile(new.phone)
    );
  elsif new.phone_verified is distinct from old.phone_verified then
    raise exception 'phone_verified can only be set by verifying the number';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_update on public.profiles;
create trigger trg_guard_profile_update before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Users never insert their own profile row (the signup trigger does).
drop policy if exists "profiles_insert_own" on public.profiles;

-- ---------------------------------------------------------------------
-- 6. Admin powers need an MFA-verified session (F1.4)
--    A stolen admin password alone (aal1) no longer passes any RLS check.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
     and exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- 7. Session management (F1.6)
-- ---------------------------------------------------------------------
create or replace function public.my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  user_agent text,
  ip text,
  aal text,
  is_current boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id,
         s.created_at,
         coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at),
         s.user_agent,
         host(s.ip),
         s.aal::text,
         s.id::text = (auth.jwt() ->> 'session_id')
    from auth.sessions s
   where s.user_id = auth.uid()
     and (s.not_after is null or s.not_after > now())
   order by coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) desc;
$$;

create or replace function public.revoke_my_session(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.sessions where id = p_session_id and user_id = auth.uid();
$$;

create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status public.account_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'you cannot change your own account status';
  end if;

  update profiles
     set account_status = p_status,
         suspended_reason = case when p_status = 'suspended' then nullif(trim(p_reason), '') end
   where id = p_user_id;

  -- Suspending ends every session that user has open.
  if p_status = 'suspended' then
    delete from auth.sessions where user_id = p_user_id;
  end if;
end;
$$;

revoke execute on function public.my_sessions() from public, anon;
revoke execute on function public.revoke_my_session(uuid) from public, anon;
revoke execute on function public.admin_set_account_status(uuid, public.account_status, text) from public, anon;
revoke execute on function public.sync_auth_verification() from public, anon, authenticated;
grant execute on function public.my_sessions() to authenticated;
grant execute on function public.revoke_my_session(uuid) to authenticated;
grant execute on function public.admin_set_account_status(uuid, public.account_status, text) to authenticated;
