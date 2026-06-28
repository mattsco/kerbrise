"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireCalendarAdmin } from "@/lib/data/profile";
import { friendlyDbError } from "@/lib/db-errors";
import { getPendingBookingsAwaitingFamily } from "@/lib/data/bookings";

// Toggle chef de famille
export async function toggleFamilyHead() {
  try {
    const user = await requireAdmin();
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
    revalidatePath("/dashboard/admin/lab");

    const message = newValue
      ? "Tu es maintenant chef de famille"
      : "Tu es repassé en simple membre";
    redirect(`/dashboard/admin/lab?status=success&message=${encodeURIComponent(message)}`);
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    const msg = e?.message ?? "Erreur inconnue";
    redirect(`/dashboard/admin/lab?status=error&message=${encodeURIComponent(msg)}`);
  }
}

// Toggle mode admin calendrier
export async function toggleCalendarAdmin() {
  try {
    const user = await requireAdmin();
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
    revalidatePath("/dashboard/admin/lab");
    revalidatePath("/dashboard/calendrier");
    revalidatePath("/dashboard/demandes");

    const message = newValue
      ? "🛡️ Mode Admin Calendrier ACTIVÉ"
      : "Mode Admin Calendrier désactivé";
    redirect(`/dashboard/admin/lab?status=success&message=${encodeURIComponent(message)}`);
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    const msg = e?.message ?? "Erreur inconnue";
    redirect(`/dashboard/admin/lab?status=error&message=${encodeURIComponent(msg)}`);
  }
}

// Simuler l'approbation d'une famille pour toutes les demandes pending
export async function simulateApprovals(familyName: "François" | "Vincent") {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data: family } = await supabase
      .from("families")
      .select("id")
      .eq("name", familyName)
      .single();
    if (!family) throw new Error(`Famille ${familyName} introuvable`);

    const { data: head } = await supabase
      .from("users")
      .select("id")
      .eq("family_id", family.id)
      .eq("is_family_head", true)
      .limit(1)
      .single();
    if (!head) throw new Error(`Aucun chef trouvé pour ${familyName}`);

    const pendingBookings = await getPendingBookingsAwaitingFamily(
      supabase,
      family.id
    );

    const bookingsToApprove = pendingBookings.filter(
      (b) => !b.approved_by_family_ids.includes(family.id)
    );

    if (bookingsToApprove.length === 0) {
      redirect(`/dashboard/admin/lab?status=info&message=${encodeURIComponent(`Aucune demande à approuver pour ${familyName}`)}`);
    }

    let inserted = 0;
    for (const b of bookingsToApprove) {
      const { error } = await supabase.from("approvals").insert({
        booking_id: b.id,
        family_id: family.id,
        decision: "approved",
        decided_by: head.id,
      });
      if (!error) inserted++;
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/admin/lab");
    revalidatePath("/dashboard/demandes");
    revalidatePath("/dashboard/calendrier");

    const message = `✅ ${inserted} demande${inserted > 1 ? "s" : ""} approuvée${inserted > 1 ? "s" : ""} pour ${familyName}`;
    redirect(`/dashboard/admin/lab?status=success&message=${encodeURIComponent(message)}`);
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    const msg = e?.message ?? "Erreur inconnue";
    redirect(`/dashboard/admin/lab?status=error&message=${encodeURIComponent(msg)}`);
  }
}

// ⚙️ Toutes les écritures admin passent désormais par des RPC Postgres
// (admin_create/update/cancel/delete_booking, migration 0012). Pourquoi :
//   - le bypass des triggers est un SIGNAL DE TRANSACTION (set_config local
//     dans la même tx que l'écriture), pas un drapeau persistant sur la ligne.
//     Plus de "is_admin_created collant" : une édition membre ultérieure
//     reprend un comportement normal.
//   - le RPC choisit d'envoyer les emails ou non (p_notify) et journalise
//     l'action dans admin_audit (qui/quand/quoi/avant-après).
// is_admin_created reste posé à la création comme marqueur de PROVENANCE pur
// (analytics), mais n'est plus lu par aucun trigger.

// Création admin d'une réservation
export async function adminCreateBooking(formData: FormData) {
  try {
    await requireCalendarAdmin();
    const supabase = await createClient();

    const startDate = formData.get("start_date") as string;
    const endDate = formData.get("end_date") as string;
    const familyId = formData.get("family_id") as string;
    const createdBy = formData.get("author_id") as string;
    const statusInput = formData.get("status") as string;
    const status = statusInput === "approved" ? "approved" : "pending";
    const notify = formData.get("notify") === "on";
    const note = (formData.get("note") as string)?.trim() || null;

    if (!startDate || !endDate || !familyId || !createdBy) {
      return { success: false, error: "Tous les champs sont requis" };
    }

    const { error } = await supabase.rpc("admin_create_booking", {
      p_start: startDate,
      p_end: endDate,
      p_family_id: familyId,
      p_created_by: createdBy,
      p_status: status,
      p_note: note,
      p_reason: null,
      p_notify: notify,
    });

    if (error) {
      // Création d'un séjour "approved" chevauchant un autre approved → 23P01.
      return { success: false, error: friendlyDbError(error, "booking") };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/admin/data");
    revalidatePath("/dashboard/calendrier");
    revalidatePath("/dashboard/demandes");

    return {
      success: true,
      message: `✅ Réservation créée du ${startDate} au ${endDate}${
        notify ? " (email envoyé)" : ""
      }`,
    };
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    return { success: false, error: e?.message ?? "Erreur inconnue" };
  }
}

type AdminUpdateOptions = {
  status?: string | null;
  familyId?: string | null;
  createdBy?: string | null;
  reason?: string | null;
  notify?: boolean;
};

// Modification admin d'une réservation (dates, statut, famille, créateur)
export async function adminUpdateBooking(
  bookingId: string,
  newStart: string,
  newEnd: string,
  opts: AdminUpdateOptions = {}
) {
  try {
    await requireCalendarAdmin();
    const supabase = await createClient();

    if (!bookingId || !newStart || !newEnd) {
      return { success: false, error: "Paramètres manquants" };
    }

    if (new Date(newEnd) < new Date(newStart)) {
      return {
        success: false,
        error: "La date de fin doit être après la date de début.",
      };
    }

    const { error } = await supabase.rpc("admin_update_booking", {
      p_id: bookingId,
      p_start: newStart,
      p_end: newEnd,
      p_status: opts.status ?? null,
      p_family_id: opts.familyId ?? null,
      p_created_by: opts.createdBy ?? null,
      p_reason: opts.reason?.trim() || null,
      p_notify: opts.notify ?? false,
    });

    if (error) {
      // Déplacement de dates d'un séjour approved sur un créneau déjà pris → 23P01.
      return { success: false, error: friendlyDbError(error, "booking") };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/calendrier");
    revalidatePath("/dashboard/demandes");

    return { success: true };
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    return { success: false, error: e?.message ?? "Erreur inconnue" };
  }
}

// Annulation admin (soft cancel)
export async function adminCancelBooking(
  bookingId: string,
  comment: string,
  notify = false
) {
  try {
    await requireCalendarAdmin();
    const supabase = await createClient();

    if (!bookingId) {
      return { success: false, error: "Paramètres manquants" };
    }

    const { error } = await supabase.rpc("admin_cancel_booking", {
      p_id: bookingId,
      p_reason: comment?.trim() || null,
      p_notify: notify,
    });

    if (error) {
      return { success: false, error: friendlyDbError(error, "booking") };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/calendrier");
    revalidatePath("/dashboard/demandes");

    return { success: true };
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    return { success: false, error: e?.message ?? "Erreur inconnue" };
  }
}

// Suppression admin (hard delete) — jamais d'email, toujours audité
export async function adminDeleteBooking(bookingId: string, reason?: string) {
  try {
    await requireCalendarAdmin();
    const supabase = await createClient();

    const { error } = await supabase.rpc("admin_delete_booking", {
      p_id: bookingId,
      p_reason: reason?.trim() || null,
    });
    if (error) {
      return { success: false, error: friendlyDbError(error, "booking") };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/calendrier");
    revalidatePath("/dashboard/demandes");

    return { success: true };
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    return { success: false, error: e?.message ?? "Erreur inconnue" };
  }
}
