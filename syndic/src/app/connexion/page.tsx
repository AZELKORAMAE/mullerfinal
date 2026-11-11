import { AuthForm } from "@/components/auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = /^\/rejoindre\/[0-9a-f-]{36}$/i.test(params.next ?? "")
    ? params.next
    : undefined;
  return <AuthForm message={params.message} next={next} />;
}
