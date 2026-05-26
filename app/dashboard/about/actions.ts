"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/supabase/auth";
import { revalidatePath } from "next/cache";

type Result =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Server Action : enregistre une suggestion d'amélioration envoyée par un user.
 *
 * Validation côté serveur (autorité, ne pas faire confiance au client) :
 * - Auth requise (RLS Supabase double-checke aussi)
 * - Titre 3-100 chars (matche le CHECK constraint SQL)
 * - Description 10-2000 chars (matche le CHECK constraint SQL)
 */
export async function submitFeatureRequest(
  title: string,
  description: string
): Promise<Result> {
  const user = await requireAuthUser();

  const cleanTitle = title.trim();
  const cleanDescription = description.trim();

  if (cleanTitle.length < 3 || cleanTitle.length > 100) {
    return {
      ok: false,
      error: "Le titre doit faire entre 3 et 100 caractères.",
    };
  }

  if (cleanDescription.length < 10 || cleanDescription.length > 2000) {
    return {
      ok: false,
      error: "La description doit faire entre 10 et 2000 caractères.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("feature_requests").insert({
    user_id: user.id,
    title: cleanTitle,
    description: cleanDescription,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/admin");
  return { ok: true };
}

/**
 * Server Action : met à jour le status d'une feature request (admin only).
 * RLS enforce que seul un admin peut updater.
 */
export async function updateFeatureRequestStatus(
  id: string,
  status: "pending" | "in_progress" | "done" | "rejected",
  adminNote?: string
): Promise<Result> {
  await requireAuthUser(); // auth check de base
  const supabase = await createClient();

  const { error } = await supabase
    .from("feature_requests")
    .update({
      status,
      admin_note: adminNote?.trim() || null,
    })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/admin");
  return { ok: true };
}