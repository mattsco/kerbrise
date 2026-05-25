import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HealthDisplay from "./HealthDisplay";
import { requireAuthUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  
const user = await requireAuthUser();
const supabase = await createClient(); 

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/dashboard");

  return <HealthDisplay />;
}