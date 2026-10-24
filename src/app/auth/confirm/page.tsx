import { AuthCard } from "@/components/auth/AuthCard";
import { ConfirmSession } from "./ConfirmSession";

export const metadata = { title: "Signing in · MECHmetrIQ" };

export default function ConfirmPage() {
  return (
    <AuthCard title="One moment">
      <ConfirmSession />
    </AuthCard>
  );
}
