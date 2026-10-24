import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime, kycTone, roleTone, titleCase } from "../../_lib/format";
import { setAccountStatusAction, updateUserAction } from "../actions";
import { Field, Notice, inputClass } from "../_components/fields";

const MESSAGES: Record<string, string> = {
  created: "Account created. A link to set their password has been emailed to them.",
  created_nomail:
    "Account created, but the set-password email couldn't be sent. They can use “Forgot password” on the sign-in page.",
  saved: "Changes saved.",
  suspended: "User suspended and signed out everywhere. They can't sign in until reactivated.",
  active: "User reactivated.",
};

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; error?: string; detail?: string }>;
}) {
  const { id } = await params;
  const { msg, error, detail } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  const { data: u } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, email_verified, phone, phone_verified, role, created_at, updated_at, account_status, suspended_reason, organization_name"
    )
    .eq("id", id)
    .single();
  if (!u) notFound();

  const { data: vendor } =
    u.role === "vendor"
      ? await supabase
          .from("vendor_profiles")
          .select("company_name, vendor_type, kyc_status")
          .eq("id", id)
          .single()
      : { data: null };

  const isMe = u.id === me?.id;
  const suspended = u.account_status === "suspended";
  const roleLocked = isMe || u.role === "vendor";

  return (
    <div>
      <Topbar
        title={u.full_name}
        pill={{ label: suspended ? "Suspended" : titleCase(u.role), tone: suspended ? "orange" : "brand" }}
        right={
          <Link href="/admin/users" className="text-[13px] font-semibold text-brand">
            &larr; Back to users
          </Link>
        }
      />

      <div className="mt-6">
        {error && <Notice tone="bad">{error}</Notice>}
        {msg === "error" && <Notice tone="bad">{detail ?? "Couldn't change that account's status."}</Notice>}
        {msg && MESSAGES[msg] && <Notice tone="good">{MESSAGES[msg]}</Notice>}
      </div>

      <div className="grid grid-cols-3 gap-4.5">
        <div className="col-span-2">
          <Card>
            <CardHeader title="Profile" />
            <form action={updateUserAction} className="space-y-4 p-5 text-[13px]">
              <input type="hidden" name="userId" value={u.id} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full name" htmlFor="full_name">
                  <input id="full_name" name="full_name" required maxLength={120} defaultValue={u.full_name} className={inputClass} />
                </Field>
                <Field
                  label="Email"
                  htmlFor="email"
                  hint="Changing it moves their sign-in to the new address straight away."
                >
                  <input id="email" name="email" type="email" required maxLength={200} defaultValue={u.email} className={inputClass} />
                </Field>
                <Field
                  label="Mobile"
                  htmlFor="phone"
                  hint={u.phone && u.phone_verified ? "Verified. Changing it clears verification." : "10-digit Indian mobile number."}
                >
                  <input id="phone" name="phone" inputMode="tel" maxLength={20} defaultValue={u.phone ?? ""} className={inputClass} />
                </Field>
                <Field
                  label="Role"
                  htmlFor="role"
                  hint={
                    isMe
                      ? "You can't change your own role."
                      : u.role === "vendor"
                        ? "Vendor accounts can't switch role (KYC, payouts and orders are tied to them)."
                        : "Changing role signs them out everywhere."
                  }
                >
                  {roleLocked && <input type="hidden" name="role" value={u.role} />}
                  <select
                    id="role"
                    name={roleLocked ? undefined : "role"}
                    defaultValue={u.role}
                    disabled={roleLocked}
                    className={inputClass}
                  >
                    {u.role === "vendor" ? (
                      <option value="vendor">Vendor</option>
                    ) : (
                      <>
                        <option value="buyer">Buyer</option>
                        <option value="admin">Admin</option>
                      </>
                    )}
                  </select>
                </Field>
              </div>
              <button type="submit" className="rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-bold text-white">
                Save changes
              </button>
            </form>
          </Card>
        </div>

        <div className="space-y-4.5">
          <Card>
            <CardHeader title="Account" />
            <div className="space-y-3 p-5 text-[13px]">
              <Row label="Role">
                <Badge tone={roleTone(u.role)}>{titleCase(u.role)}</Badge>
              </Row>
              <Row label="Status">
                <Badge tone={suspended ? "rejected" : "active"}>{suspended ? "Suspended" : "Active"}</Badge>
              </Row>
              <Row label="Email verified">{u.email_verified ? "Yes" : "No"}</Row>
              <Row label="Joined">{formatDateTime(u.created_at)}</Row>
              <Row label="Last updated">{formatDateTime(u.updated_at)}</Row>
              {u.organization_name && <Row label="Organisation">{u.organization_name}</Row>}
            </div>
          </Card>

          {vendor && (
            <Card>
              <CardHeader title="Vendor" />
              <div className="space-y-3 p-5 text-[13px]">
                <Row label="Company">{vendor.company_name || "—"}</Row>
                <Row label="Type">{titleCase(vendor.vendor_type)}</Row>
                <Row label="KYC">
                  <Badge tone={kycTone(vendor.kyc_status)}>{titleCase(vendor.kyc_status)}</Badge>
                </Row>
                <Link href={`/admin/vendors/${u.id}`} className="block text-[12.5px] font-semibold text-brand">
                  Open vendor profile &amp; KYC &rarr;
                </Link>
              </div>
            </Card>
          )}

          {!isMe && (
            <Card className={suspended ? undefined : "border-[#f3c4c4]"}>
              <CardHeader title={suspended ? "Reactivate account" : "Suspend account"} />
              <form action={setAccountStatusAction} className="space-y-3 p-5 text-[13px]">
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="back" value="detail" />
                {suspended ? (
                  <>
                    <input type="hidden" name="status" value="active" />
                    {u.suspended_reason && (
                      <p className="text-ink-2">Reason given: {u.suspended_reason}</p>
                    )}
                    <button type="submit" className="w-full rounded-lg bg-brand py-2.5 text-[13.5px] font-bold text-white">
                      Reactivate
                    </button>
                  </>
                ) : (
                  <>
                    <input type="hidden" name="status" value="suspended" />
                    <p className="text-ink-2">
                      Soft delete: signs them out everywhere and blocks sign-in. Their orders, quotes and
                      history are kept, and you can reactivate them any time.
                    </p>
                    <Field label="Reason (shown to the user)" htmlFor="reason">
                      <input id="reason" name="reason" maxLength={300} className={inputClass} />
                    </Field>
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-[#f3c4c4] py-2 text-[13px] font-semibold text-[#a12525] hover:bg-crit-bg"
                    >
                      Suspend user
                    </button>
                  </>
                )}
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-2">{label}</span>
      <span className="text-right font-semibold text-ink">{children}</span>
    </div>
  );
}
