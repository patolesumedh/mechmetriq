import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Th, Td, EmptyRow } from "../_components/table";
import { formatDate, roleTone } from "../_lib/format";

export default async function AdminSettingsPage() {
  const supabase = await createClient();

  const { data: admins } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("role", "admin")
    .order("created_at", { ascending: true });

  return (
    <div>
      <Topbar title="Settings" />

      <div className="mt-6 grid grid-cols-2 gap-4.5">
        <Card>
          <CardHeader title="Platform Administrators" />
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Since</Th>
              </tr>
            </thead>
            <tbody>
              {(admins ?? []).length === 0 && (
                <EmptyRow colSpan={4}>No admin accounts found.</EmptyRow>
              )}
              {(admins ?? []).map((a) => (
                <tr key={a.id}>
                  <Td strong>{a.full_name}</Td>
                  <Td>{a.email}</Td>
                  <Td>
                    <Badge tone={roleTone("admin")}>Admin</Badge>
                  </Td>
                  <Td>{formatDate(a.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Commission Defaults" />
          <div className="space-y-2 p-5 text-[13px] text-ink-2">
            <p>
              The platform-wide default commission rate applies to every vendor unless a
              per-vendor override is set on their KYC profile.
            </p>
            <p>
              Per-vendor overrides can be set from{" "}
              <span className="font-semibold text-ink">Vendors &rarr; Vendor detail</span> using the
              &ldquo;Commission &amp; Internal Notes&rdquo; panel.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment Gateway" />
          <div className="space-y-2 p-5 text-[13px] text-ink-2">
            <p>
              Payment methods accepted on the platform are UPI, Card, Netbanking, and Wallet.
              Gateway credentials and webhook configuration are managed as environment
              configuration outside of this dashboard.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Notifications & Templates" />
          <div className="space-y-2 p-5 text-[13px] text-ink-2">
            <p>
              Email and SMS templates for RFQ status changes, quote submissions, order updates,
              and dispute notifications are configured at the infrastructure level.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Staff & Roles" />
          <div className="space-y-2 p-5 text-[13px] text-ink-2">
            <p>
              Internal staff accounts (Ops, Finance, Support, Content) with scoped module
              permissions can be provisioned against the <code>staff_roles</code> table. Staff
              management UI is planned for a future release.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
