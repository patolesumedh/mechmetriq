import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Reset password · MechOneHub" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <ForgotPasswordForm linkExpired={error === "link"} />;
}
