import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Th, Td, EmptyRow } from "../../_components/table";
import { formatDate } from "../../_lib/format";
import { VENDOR_TYPE_LABEL } from "@/lib/kyc/status";
import { NewInviteForm, ResendButton } from "./InviteForms";
import { revokeInviteAction } from "./actions";

export const metadata = { title: "Vendor invitations · MECHmetrIQ" };

async function loadInvites() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_invites")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const now = Date.now();
  return (data ?? []).map((i) => ({
    ...i,
    status: i.accepted_at
      ? "Accepted"
      : i.revoked_at
        ? "Revoked"
        : new Date(i.expires_at).getTime() <= now
          ? "Expired"
          : "Open",
  }));
}

/** Admin invite flow (F5.5): invite, resend (new link, old one stops working), revoke. */
export default async function VendorInvitesPage() {
  const invites = await loadInvites();

  return (
    <div>
      <Topbar
        title="Vendor Invitations"
        right={
          <Link href="/admin/vendors" className="text-[13px] font-semibold text-brand">
            &larr; Back to vendors
          </Link>
        }
      />
      <div className="mt-6 space-y-4.5">
        <Card>
          <CardHeader title="Invite a vendor" />
          <div className="p-5">
            <p className="mb-4 text-[12.5px] text-muted">
              The vendor gets a single-use link that works for 72 hours. Their details are prefilled; they set a
              password, verify their email and complete KYC as usual &mdash; an invitation doesn&rsquo;t skip
              verification or approval.
            </p>
            <NewInviteForm />
          </div>
        </Card>

        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Email</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Expires</Th>
                <Th>Sent</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {invites.length === 0 && <EmptyRow colSpan={7}>No invitations yet.</EmptyRow>}
              {invites.map((i) => {
                const status = i.status;
                const open = status === "Open" || status === "Expired";
                return (
                  <tr key={i.id}>
                    <Td strong>
                      {i.company_name}
                      <div className="text-[12px] font-normal text-muted">{i.contact_name}</div>
                    </Td>
                    <Td>{i.email}</Td>
                    <Td>{VENDOR_TYPE_LABEL[i.vendor_type]}</Td>
                    <Td>
                      <Badge
                        tone={
                          status === "Accepted"
                            ? "approved"
                            : status === "Open"
                              ? "pending"
                              : status === "Expired"
                                ? "review"
                                : "rejected"
                        }
                      >
                        {status}
                      </Badge>
                      {i.accepted_user_id && (
                        <Link href={`/admin/vendors/${i.accepted_user_id}`} className="ml-2 text-[12px] font-semibold text-brand">
                          View vendor
                        </Link>
                      )}
                    </Td>
                    <Td>{i.accepted_at ? "—" : formatDate(i.expires_at)}</Td>
                    <Td>
                      {i.send_count}× · last {formatDate(i.last_sent_at)}
                    </Td>
                    <Td>
                      {open && (
                        <div className="flex flex-col items-start gap-1.5">
                          <ResendButton id={i.id} />
                          <form action={revokeInviteAction}>
                            <input type="hidden" name="id" value={i.id} />
                            <button type="submit" className="text-[12.5px] font-semibold text-crit">
                              Revoke
                            </button>
                          </form>
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
