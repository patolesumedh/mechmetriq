import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Notice } from "../_components/fields";
import { NewUserForm } from "./NewUserForm";

export default async function AdminNewUserPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div>
      <Topbar
        title="Add user"
        right={
          <Link href="/admin/users" className="text-[13px] font-semibold text-brand">
            &larr; Back to users
          </Link>
        }
      />
      <div className="mt-6 max-w-[760px]">
        {error && <Notice tone="bad">{error}</Notice>}
        <Card>
          <CardHeader title="New account" />
          <NewUserForm />
        </Card>
      </div>
    </div>
  );
}
