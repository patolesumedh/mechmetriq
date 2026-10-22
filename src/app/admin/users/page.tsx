import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Th, Td, EmptyRow } from "../_components/table";
import { FilterTabs } from "../_components/FilterTabs";
import { formatDate, roleTone } from "../_lib/format";
import type { Database } from "@/lib/types/database";
import { setAccountStatusAction } from "./actions";

type Role = Database["public"]["Enums"]["user_role"];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; msg?: string }>;
}) {
  const { role, msg } = await searchParams;
  const roleFilter = role as Role | undefined;

  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, phone, phone_verified, role, created_at, account_status, suspended_reason")
    .order("created_at", { ascending: false });

  if (roleFilter === "buyer" || roleFilter === "vendor" || roleFilter === "admin") {
    query = query.eq("role", roleFilter);
  }

  const { data: users } = await query;

  return (
    <div>
      <Topbar title="Users" pill={{ label: `${users?.length ?? 0} total` }} />

      <div className="mt-6">
        {msg && (
          <div
            className={
              "mb-4 rounded-lg px-3.5 py-3 text-[13px] font-medium " +
              (msg === "error" ? "bg-crit-bg text-[#a12525]" : "bg-good-bg text-[#0a6b0a]")
            }
          >
            {msg === "suspended" && "User suspended and signed out everywhere."}
            {msg === "active" && "User reactivated."}
            {msg === "error" && "Couldn't change that account's status."}
          </div>
        )}
        <FilterTabs
          basePath="/admin/users"
          paramName="role"
          active={roleFilter}
          tabs={[
            { label: "All", value: undefined },
            { label: "Buyers", value: "buyer" },
            { label: "Vendors", value: "vendor" },
            { label: "Admins", value: "admin" },
          ]}
        />

        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Full name</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Role</Th>
                <Th>Joined</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).length === 0 && (
                <EmptyRow colSpan={6}>No users match this filter.</EmptyRow>
              )}
              {(users ?? []).map((u) => (
                <tr key={u.id}>
                  <Td strong>{u.full_name}</Td>
                  <Td>{u.email}</Td>
                  <Td>
                    {u.phone ?? "—"}
                    {u.phone && u.phone_verified && <span className="ml-1 text-[#0a6b0a]" title="Verified">✓</span>}
                  </Td>
                  <Td>
                    <Badge tone={roleTone(u.role)}>
                      {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </Badge>
                  </Td>
                  <Td>{formatDate(u.created_at)}</Td>
                  <Td>
                    {u.account_status === "suspended" ? (
                      <div className="flex items-center gap-2">
                        <span title={u.suspended_reason ?? undefined}>
                          <Badge tone="rejected">Suspended</Badge>
                        </span>
                        <form action={setAccountStatusAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="status" value="active" />
                          <button type="submit" className="text-[12px] font-semibold text-brand">
                            Reactivate
                          </button>
                        </form>
                      </div>
                    ) : u.id === me?.id ? (
                      <Badge tone="active">Active</Badge>
                    ) : (
                      <form action={setAccountStatusAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="status" value="suspended" />
                        <input
                          name="reason"
                          placeholder="Reason (shown to user)"
                          className="w-40 rounded-md border border-grid px-2 py-1 text-[12px] outline-none focus:border-brand"
                        />
                        <button type="submit" className="text-[12px] font-semibold text-[#a12525]">
                          Suspend
                        </button>
                      </form>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
