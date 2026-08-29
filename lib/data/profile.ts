// lib/data/profile.ts
//
// One place to fetch the current user's profile + the admin guards.
// Today the profile select is copy-pasted into every dashboard page and both
// server-action files, and the admin/calendar-admin checks are duplicated.
//
// `cache()` dedupes within a single render path, so multiple components in one
// page can call getCurrentProfile() without extra round-trips.

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/supabase/auth";
import {
  UNKNOWN_FAMILY_COLOR,
  UNKNOWN_FAMILY_NAME,
  type Profile,
} from "./types";

const PROFILE_SELECT = `
  id, display_name, family_id, is_family_head, is_admin, is_calendar_admin,
  password_changed, families(name, color)
`;

/**
 * Current user's full profile, or null if the row is missing.
 * Assumes requireAuthUser() (and therefore the middleware JWT check) has run
 * or will run; pass the user id explicitly to avoid a second auth read.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("users")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .single();

  if (!data) return null;

  const families = (data as any).families;
  return {
    id: data.id,
    display_name: data.display_name ?? null,
    family_id: data.family_id,
    family_name: families?.name ?? UNKNOWN_FAMILY_NAME,
    family_color: families?.color ?? UNKNOWN_FAMILY_COLOR,
    is_family_head: data.is_family_head ?? false,
    is_admin: data.is_admin ?? false,
    is_calendar_admin: data.is_calendar_admin ?? false,
    password_changed: data.password_changed ?? false,
  };
});

/**
 * Le profil du visiteur, ou une redirection vers /compte-incomplet.
 *
 * ⚠️ Être authentifié ne suffit PAS à pouvoir utiliser l'app : le JWT prouve
 * l'identité, la ligne `public.users` prouve le rattachement à une famille.
 * Les deux peuvent diverger — `handle_new_user` ne crée la ligne que si
 * l'e-mail est déjà dans `family_members` au moment de la création du compte,
 * et ne dit rien quand ce n'est pas le cas.
 *
 * Historiquement chaque page réglait ce cas à sa façon : `redirect("/login")`
 * (dashboard, profil, nouvelle-demande), `redirect("/dashboard")` (demandes)
 * ou `return null` (calendrier). Les trois premiers formaient une BOUCLE — la
 * connexion réussissait, le dashboard renvoyait au login, et l'utilisateur
 * voyait un formulaire de connexion sans le moindre message d'erreur. C'est
 * arrivé pour de vrai (un compte le 22 mai 2026, jamais revenu).
 *
 * D'où une seule sortie, explicite, pour toutes les pages.
 */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/compte-incomplet");
  return profile;
}

/** Throws "Not admin" unless the current user is a global admin. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) throw new Error("Not admin");
  return profile;
}

/** Throws "Not calendar admin" unless the current user is a calendar admin. */
export async function requireCalendarAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile?.is_calendar_admin) throw new Error("Not calendar admin");
  return profile;
}
