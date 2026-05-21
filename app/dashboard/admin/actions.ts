"use server";

import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  try {
    const user = await checkAdmin();
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("users")
      .select("is_family_head")
      .eq("id", user.id)
      .single();

    const newValue = !profile?.is_family_head;
    const { error } = await supabase
      .from("users")
      .update({ is_family_head: newValue })
      .eq("id", user.id);

    if (error) throw error;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin");

    const message = newValue
      ? "Tu es maintenant chef de famille"
      : "Tu es repassé en simple membre";
    redirect(`/dashboard/admin?status=success&message=${encodeURIComponent(message)}`);
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    const msg = e?.message ?? "Erreur inconnue";
    redirect(`/dashboard/admin?status=error&message=${encodeURIComponent(msg)}`);
  }
}

// Simule l'approbation par une famille de toutes les demandes pending qu'elle n'a pas encore validées
export async function simulateApprovals(familyName: "François" | "Vincent") {
  try {
    await checkAdmin();
    const supabase = await createClient();

    // Récupère l'ID de la famille
    const { data: family } = await supabase
      .from("families")
      .select("id")
      .eq("name", familyName)
      .single();
    if (!family) throw new Error(`Famille ${familyName} introuvable`);

    // Récupère un chef de cette famille pour décider en son nom
    const { data: head } = await supabase
      .from("users")
      .select("id")
      .eq("family_id", family.id)
      .eq("is_family_head", true)
      .limit(1)
      .single();
    if (!head) throw new Error(`Aucun chef trouvé pour la famille ${familyName}`);

    // Récupère toutes les demandes pending d'autres familles non encore validées
    const { data: pendingBookings } = await supabase
      .from("bookings")
      .select("id, family_id, approvals(family_id)")
      .eq("status", "pending")
      .neq("family_id", family.id);

    const bookingsToApprove = (pendingBookings ?? []).filter(
      (b: any) => !b.approvals?.some((a: any) => a.family_id === family.id)
    );

    if (bookingsToApprove.length === 0) {
      redirect(`/dashboard/admin?status=info&message=${encodeURIComponent(`Aucune demande à approuver pour ${familyName}`)}`);
    }

    // Insère une approbation pour chaque
    let inserted = 0;
    for (const b of bookingsToApprove) {
      const { error } = await supabase.from("approvals").insert({
        booking_id: b.id,
        family_id: family.id,
        decision: "approved",
        decided_by: head.id,
      });
      if (error) {
        // Log mais continue
        console.error(`Erreur sur booking ${b.id}:`, error);
      } else {
        inserted++;
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/demandes");
    revalidatePath("/dashboard/calendrier");

    const message = `✅ ${inserted} demande${inserted > 1 ? "s" : ""} approuvée${inserted > 1 ? "s" : ""} pour ${familyName}`;
    redirect(`/dashboard/admin?status=success&message=${encodeURIComponent(message)}`);
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    const msg = e?.message ?? "Erreur inconnue";
    redirect(`/dashboard/admin?status=error&message=${encodeURIComponent(msg)}`);
  }

// Toggle calendar admin
export async function toggleCalendarAdmin() {
  try {
    const user = await checkAdmin();
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("users")
      .select("is_calendar_admin")
      .eq("id", user.id)
      .single();

    const newValue = !profile?.is_calendar_admin;
    const { error } = await supabase
      .from("users")
      .update({ is_calendar_admin: newValue })
      .eq("id", user.id);

    if (error) throw error;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/calendrier");

    const message = newValue
      ? "🛡️ Mode Admin Calendrier activé"
      : "Mode Admin Calendrier désactivé";
    redirect(`/dashboard/admin?status=success&message=${encodeURIComponent(message)}`);
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    const msg = e?.message ?? "Erreur inconnue";
    redirect(`/dashboard/admin?status=error&message=${encodeURIComponent(msg)}`);
  }
}

// Création d'une réservation admin (sans déclencher emails)
export async function adminCreateBooking(formData: FormData) {
  try {
    await checkAdmin();
    const supabase = await createClient();

    const startDate = formData.get("start_date") as string;
    const endDate = formData.get("end_date") as string;
    const familyId = formData.get("family_id") as string;
    const authorId = formData.get("author_id") as string;
    const statusInput = formData.get("status") as string;
    const status = statusInput === "approved" ? "approved" : "pending";

    if (!startDate || !endDate || !familyId || !authorId) {
      throw new Error("Tous les champs sont requis");
    }

    // Désactive temporairement les triggers d'emails (le temps de l'insert)
    // Note : on ne peut pas DISABLE TRIGGER via supabase client, on utilise donc un flag
    // dans le booking pour indiquer "no_email"
    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        family_id: familyId,
        author_id: authorId,
        start_date: startDate,
        end_date: endDate,
        status: status,
        is_admin_created: true,  // flag pour les triggers
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/calendrier");
    revalidatePath("/dashboard/demandes");

    redirect(`/dashboard/admin?status=success&message=${encodeURIComponent(`✅ Réservation créée du ${startDate} au ${endDate}`)}`);
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    const msg = e?.message ?? "Erreur inconnue";
    redirect(`/dashboard/admin?status=error&message=${encodeURIComponent(msg)}`);
  }
}

// Suppression admin
export async function adminDeleteBooking(bookingId: string) {
  try {
    await checkAdmin();
    const supabase = await createClient();

    // D'abord supprime les approvals
    await supabase.from("approvals").delete().eq("booking_id", bookingId);
    
    // Puis le booking
    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId);
    if (error) throw error;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/calendrier");
    revalidatePath("/dashboard/demandes");

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message };
  }
}

}