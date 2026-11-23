-- =====================================================================
-- 0020 · Admin user management (add / update; suspend already exists)
-- =====================================================================
-- 1. admin_user_invites + admin_create_user_invite(): before creating an
--    account through the service-role Auth API, the admin's server action
--    records the email + role and gets back a one-time token. The token
--    travels in the new user's metadata, so handle_new_user() can tell an
--    admin-created account from a self sign-up. (app_metadata can't be
--    used: the Auth API writes it after the insert that fires the trigger.)
-- 2. handle_new_user(): admin-created accounts may be any role, including
--    admin, and skip the checks that only apply to the person signing up
--    (terms; mobile and GSTIN become optional — vendors add GSTIN in KYC).
--    Self sign-up is unchanged: buyer or vendor only.
-- 3. admin_update_user(): edit name, phone and role. An admin can't change
--    their own role, the last active admin can't be demoted, and vendor <->
--    non-vendor switches are refused (vendors carry KYC, payouts, orders).
-- 4. admin_set_account_status(): also refuses to suspend the last admin.
-- =====================================================================

create table if not exists public.admin_user_invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  role        public.user_role not null,
  token       uuid not null default gen_random_uuid(),
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);
create index if not exists admin_user_invites_email_idx
  on public.admin_user_invites (lower(email));
alter table public.admin_user_invites enable row level security;
-- No policies: only reachable through the SECURITY DEFINER functions below.

create or replace function public.admin_create_user_invite(p_email text, p_role public.user_role)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if coalesce(trim(p_email), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.';
  end if;
  if exists (select 1 from profiles where lower(email) = lower(trim(p_email))) then
    raise exception 'An account with this email already exists.';
  end if;
  insert into admin_user_invites (email, role, created_by)
  values (lower(trim(p_email)), p_role, auth.uid())
  returning token into v_token;
  return v_token;
end;
$$;
revoke all on function public.admin_create_user_invite(text, public.user_role) from public, anon;
grant execute on function public.admin_create_user_invite(text, public.user_role) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  inv         public.admin_user_invites;
  by_admin    boolean := false;
  role_text   text := coalesce(meta ->> 'role', 'buyer');
  new_role    user_role;
  mobile      text := public.normalize_in_mobile(meta ->> 'phone');
  gst         text := nullif(upper(trim(coalesce(meta ->> 'gstin', ''))), '');
begin
  if meta ? 'admin_invite_token' then
    select * into inv from admin_user_invites
     where lower(email) = lower(new.email)
       and token::text = meta ->> 'admin_invite_token'
       and used_at is null
       and created_at > now() - interval '1 hour'
     for update;
    if found then
      by_admin := true;
      role_text := inv.role::text;
      update admin_user_invites set used_at = now() where id = inv.id;
    end if;
  end if;

  if role_text not in ('buyer', 'vendor') and not (by_admin and role_text = 'admin') then
    raise exception 'Invalid account type.' using errcode = '22023';
  end if;
  new_role := role_text::user_role;

  if coalesce(trim(meta ->> 'full_name'), '') = '' then
    raise exception 'Full name is required.' using errcode = '22023';
  end if;
  if mobile is null and (not by_admin or nullif(trim(coalesce(meta ->> 'phone', '')), '') is not null) then
    raise exception 'Enter a valid 10-digit Indian mobile number.' using errcode = '22023';
  end if;
  if not by_admin and coalesce(meta ->> 'terms_accepted', 'false') <> 'true' then
    raise exception 'You must agree to the Terms of Service and Privacy Policy.' using errcode = '22023';
  end if;
  if new_role = 'vendor' then
    if coalesce(trim(meta ->> 'company_name'), '') = '' then
      raise exception 'Company name is required for vendor accounts.' using errcode = '22023';
    end if;
    if (gst is null and not by_admin) or (gst is not null and not public.is_valid_gstin(gst)) then
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
          new.email_confirmed_at is not null,
          case when by_admin then null else now() end,
          true);

  if new_role = 'vendor' then
    insert into vendor_profiles (id, vendor_type, company_name, gstin)
    values (new.id, (meta ->> 'vendor_type')::vendor_type, trim(meta ->> 'company_name'), gst);
  end if;

  perform set_config('mmq.trusted_profile_write', 'off', true);
  return new;
end;
$$;

create or replace function public.admin_update_user(
  p_user_id   uuid,
  p_full_name text,
  p_phone     text,
  p_role      public.user_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p      public.profiles;
  mobile text := public.normalize_in_mobile(p_phone);
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select * into p from profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found';
  end if;

  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Full name is required.';
  end if;
  if nullif(trim(coalesce(p_phone, '')), '') is not null and mobile is null then
    raise exception 'Enter a valid 10-digit Indian mobile number.';
  end if;

  if p_role is distinct from p.role then
    if p_user_id = auth.uid() then
      raise exception 'You cannot change your own role.';
    end if;
    if p.role = 'vendor' or p_role = 'vendor' then
      raise exception 'Vendor accounts carry KYC, payouts and orders, so they cannot switch role. Create a new account instead.';
    end if;
    if p.role = 'admin' and not exists (
      select 1 from profiles
       where role = 'admin' and account_status = 'active' and id <> p_user_id
    ) then
      raise exception 'This is the only active admin. Add another admin first.';
    end if;
  end if;

  update profiles
     set full_name      = trim(p_full_name),
         phone          = mobile,
         phone_verified = case when mobile is distinct from p.phone then false else p.phone_verified end,
         role           = p_role
   where id = p_user_id;

  -- A role change takes effect at the next sign-in; end open sessions so
  -- it can't linger in an old session.
  if p_role is distinct from p.role then
    delete from auth.sessions where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.admin_update_user(uuid, text, text, public.user_role) from public, anon;
grant execute on function public.admin_update_user(uuid, text, text, public.user_role) to authenticated;

-- Suspending the last active admin would lock everyone out.
create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status  public.account_status,
  p_reason  text default null
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
  if p_status = 'suspended'
     and exists (select 1 from profiles where id = p_user_id and role = 'admin')
     and not exists (
       select 1 from profiles
        where role = 'admin' and account_status = 'active' and id <> p_user_id
     ) then
    raise exception 'This is the only active admin.';
  end if;

  update profiles
     set account_status = p_status,
         suspended_reason = case when p_status = 'suspended' then nullif(trim(p_reason), '') end
   where id = p_user_id;

  if p_status = 'suspended' then
    delete from auth.sessions where user_id = p_user_id;
  end if;
end;
$$;
