import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HealthDisplay from "./HealthDisplay";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/dashboard");

  return <HealthDisplay />;
}