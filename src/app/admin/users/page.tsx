import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Th, Td, EmptyRow } from "../_components/table";
import { FilterTabs } from "../_components/FilterTabs";
import { formatDate, roleTone } from "../_lib/format";
import type { Database } from "@/lib/types/database";

type Role = Database["public"]["Enums"]["user_role"];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  const roleFilter = role as Role | undefined;

  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, created_at")
    .order("created_at", { ascending: false });

  if (roleFilter === "buyer" || roleFilter === "vendor" || roleFilter === "admin") {
    query = query.eq("role", roleFilter);
  }

  const { data: users } = await query;

  return (
    <div>
      <Topbar title="Users" pill={{ label: `${users?.length ?? 0} total` }} />

      <div className="mt-6">
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
              </tr>
            </thead>
            <tbody>
              {(users ?? []).length === 0 && (
                <EmptyRow colSpan={5}>No users match this filter.</EmptyRow>
              )}
              {(users ?? []).map((u) => (
                <tr key={u.id}>
                  <Td strong>{u.full_name}</Td>
                  <Td>{u.email}</Td>
                  <Td>{u.phone ?? "—"}</Td>
                  <Td>
                    <Badge tone={roleTone(u.role)}>
                      {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </Badge>
                  </Td>
                  <Td>{formatDate(u.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
