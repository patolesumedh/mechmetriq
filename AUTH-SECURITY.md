# E1 — Authentication & Account Security (MechOneHub v3.1.0)

| ID | Feature | Where |
|---|---|---|
| F1.1 | Forgot / reset password | `/forgot-password`, `/reset-password`, `/auth/callback` |
| F1.2 | Email verification by 6-digit code (delivered via Resend Custom SMTP) | `/verify/email`, `sync_auth_verification` trigger |
| F1.3 | Server-side sign-up validation | `src/app/register/actions.ts`, `handle_new_user` trigger, `src/lib/auth/validation.ts` |
| F1.4 | Leaked-password check + authenticator-app (QR) two-factor login: required for admins, optional for buyers/vendors | `src/lib/auth/pwned.ts`, `/mfa/setup`, `/mfa/verify`, `/account/security`, `is_admin()` requires `aal2` |
| F1.5 | Status-based login routing | `src/lib/auth/getDashboardPath.ts`, `requireAccountFor` in `src/lib/auth/guard.ts`, `/account/suspended`, `/account/under-review`, Suspend on `/admin/users` |
| F1.6 | Session timeout + active sessions | `src/proxy.ts` (30 min idle; 30 days with "Remember me"), `/account/security` |
| F1.7 | Cloudflare Turnstile CAPTCHA & Upstash Sliding-Window Rate Limiting | `src/components/auth/TurnstileField.tsx`, `src/lib/security/rateLimit.ts` (5/min & 20/hr per IP, 10/hr per email) |
| F1.8 | Edge Origin Lock (`X-Origin-Verify`) & Browser Security Headers | `src/lib/security/originVerify.ts`, `src/proxy.ts`, `next.config.ts`, `cloudflare-worker/src/index.js` |

Migration `supabase/migrations/0019_auth_account_security.sql` also closes a
privilege-escalation hole: the old `profiles_update_own` policy let any user
set their own `role` to `admin`, and sign-up metadata accepted `role: admin`.

## Supabase Auth & Cloudflare Configuration (Per Environment)

Separate Supabase Free projects in Mumbai (`ap-south-1`) are used for **`mechonehub-prod`** and **`mechonehub-staging`**:

1. **Supabase → Authentication → Sign In / Providers → Email:** Turn on *Confirm email*. Disable unused Phone and OAuth providers.
2. **Supabase → Authentication → URL Configuration:**
   - **Production (`mechonehub-prod`):**
     - **Site URL:** `https://mechonehub.com`
     - **Redirect URLs:** `https://mechonehub.com/auth/callback` **ONLY** (never include wildcards, staging, or localhost in production).
   - **Staging (`mechonehub-staging`):**
     - **Site URL:** `https://staging.mechonehub.com`
     - **Redirect URLs:** `https://staging.mechonehub.com/auth/callback` and `http://localhost:3000/auth/callback`.
3. **Supabase → Authentication → Bot and Abuse Protection:**
   - Enable **Cloudflare Turnstile** CAPTCHA protection using separate Turnstile widgets per environment (`mechonehub.com` for prod; `staging.mechonehub.com` + `localhost` for staging).
   - Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in the corresponding GitHub Environment (`production` / `staging`).
4. **Supabase → Authentication → SMTP Settings & Emails → Templates:**
   - Connect **Resend Free** (`smtp.resend.com`, port `465`, sender `no-reply@mechonehub.com` in prod and `staging-no-reply@mechonehub.com` in staging with separate sending-only API keys).
   - Customise the email templates so links verify on our server via `/auth/callback?token_hash=...`:
     - **Confirm signup:**
       `<p>Your MechOneHub verification code is <b>{{ .Token }}</b></p>`
       `<p>Or <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">verify your email</a></p>`
     - **Reset password:** `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
     - **Change email address:** `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change`
5. **Supabase → Authentication → Multi-Factor:** TOTP enabled. Each admin logs in once and scans the QR code at `/mfa/setup`.
