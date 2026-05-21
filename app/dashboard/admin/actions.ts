"use server";

import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

// Helper : récupère un client Supabase admin (service_role)
async function getAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}

// Helper : vérifie qu'on est admin
async function checkAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) throw new Error("Not admin");
  return user;
}

// Toggle le statut chef de famille de l'utilisateur courant
export async function toggleFamilyHead() {
  const user = await checkAdmin();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("is_family_head")
    .eq("id", user.id)
    .single();

  await supabase
    .from("users")
    .update({ is_family_head: !profile?.is_family_head })
    .eq("id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/admin");
}

// Simule l'approbation par une famille de toutes les demandes pending qu'elle n'a pas encore validées
export async function simulateApprovals(familyName: "François" | "Vincent") {
  await checkAdmin();
  const supabase = await createClient();

  // Récupère l'ID de la famille
  const { data: family } = await supabase
    .from("families")
    .select("id")
    .eq("name", familyName)
    .single();
  if (!family) throw new Error("Family not found");

  // Récupère un chef de cette famille pour décider en son nom
  const { data: head } = await supabase
    .from("users")
    .select("id")
    .eq("family_id", family.id)
    .eq("is_family_head", true)
    .limit(1)
    .single();
  if (!head) throw new Error("No head found for this family");

  // Récupère toutes les demandes pending d'autres familles non encore validées par celle-ci
  const { data: pendingBookings } = await supabase
    .from("bookings")
    .select("id, family_id, approvals(family_id)")
    .eq("status", "pending")
    .neq("family_id", family.id);

  const bookingsToApprove = (pendingBookings ?? []).filter(
    (b: any) => !b.approvals?.some((a: any) => a.family_id === family.id)
  );

  // Insère une approbation pour chaque
  for (const b of bookingsToApprove) {
    await supabase.from("approvals").insert({
      booking_id: b.id,
      family_id: family.id,
      decision: "approved",
      decided_by: head.id,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/demandes");

  return bookingsToApprove.length;
}

// Toggle le mode test
export async function toggleTestMode(currentValue: string) {
  await checkAdmin();
  
  const newValue = currentValue === "true" ? "false" : "true";

  // Note: les secrets Supabase ne peuvent pas être modifiés via API REST sans 
  // la Management API. On va donc juste afficher l'instruction.
  // Cette fonction sert de placeholder
  return { 
    currentValue, 
    newValue, 
    instruction: "Pour changer le mode, va sur Supabase → Edge Functions → Secrets → EMAIL_TEST_MODE : https://supabase.com/dashboard/project/keufvhftoedgxclzecyp/functions/secrets?edit=EMAIL_TEST_MODE " 
  };
}