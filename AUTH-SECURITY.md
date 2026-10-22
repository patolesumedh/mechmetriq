# E1 — Authentication & Account Security

| ID | Feature | Where |
|---|---|---|
| F1.1 | Forgot / reset password | `/forgot-password`, `/reset-password`, `/auth/callback` |
| F1.2 | Email + mobile OTP verification | `/verify/email`, `/verify/phone`, `sync_auth_verification` trigger |
| F1.3 | Server-side sign-up validation | `src/app/register/actions.ts`, `handle_new_user` trigger, `src/lib/auth/validation.ts` |
| F1.4 | Leaked-password check + admin MFA | `src/lib/auth/pwned.ts`, `/mfa/setup`, `/mfa/verify`, `is_admin()` requires `aal2` |
| F1.5 | Status-based login routing | `src/lib/auth/getDashboardPath.ts`, `requireAccountFor` in `src/lib/auth/guard.ts`, `/account/suspended`, `/account/under-review`, Suspend on `/admin/users` |
| F1.6 | Session timeout + active sessions | `src/proxy.ts` (30 min idle; 30 days with "Remember me"), `/account/security` |

Migration `supabase/migrations/0019_auth_account_security.sql` also closes a
privilege-escalation hole: the old `profiles_update_own` policy let any user
set their own `role` to `admin`, and sign-up metadata accepted `role: admin`.

## Deploy order

The migration is **not** additive (the signup trigger now requires
`terms_accepted`, and admins need MFA). Apply it and ship the app together.

1. Supabase → Authentication → **Sign In / Providers → Email**: turn on
   *Confirm email*.
2. Supabase → Authentication → **Sign In / Providers → Phone**: enable it and
   connect an SMS provider (Twilio, MessageBird, Vonage or Textlocal). For
   testing without SMS, add *Test phone numbers* with fixed OTPs there.
3. Supabase → Authentication → **URL Configuration** → Redirect URLs: add
   `https://<your-domain>/auth/callback` and
   `https://*-<team>.vercel.app/auth/callback` for previews.
   Also set **Site URL** to the production origin
   (`https://mechmetriq.vercel.app`). Supabase sends users there whenever a
   redirect URL isn't allow-listed — if it's `http://localhost:3000`, email
   links break for real users.
4. Supabase → Authentication → **Emails** → Templates: make links verify on
   our server so they work on any device (the default PKCE links only work in
   the browser that signed up):
   - Confirm signup: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`
   - Reset password: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
   - Change email address: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change`
5. Supabase → Authentication → **Multi-Factor**: TOTP enabled (default).
6. Optional: set `NEXT_PUBLIC_SITE_URL` in Vercel to the production origin.
7. Apply the migration, then merge/deploy the app.
8. Each admin logs in once and scans the QR code at `/mfa/setup`.

Accounts created before the migration are not forced through mobile
verification (`profiles.verification_required = false`); every new one is.
