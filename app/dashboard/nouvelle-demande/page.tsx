import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import NewBookingForm from "@/components/NewBookingForm";

export const dynamic = "force-dynamic";

type ApprovedBookingRow = {
  start_date: string;
  end_date: string;
  family_id: string;
  families: { name: string } | null;
};

export default async function NewBookingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Récupère le profil utilisateur + sa famille
  const { data: profile } = await supabase
    .from("users")
    .select("display_name, family_id, families(name, color)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/dashboard");
  }

  // @ts-expect-error nested type
  const familyName: string = profile.families?.name ?? "?";
  // @ts-expect-error
  const familyColor: string = profile.families?.color ?? "#888";

  // Récupère les dates déjà approuvées pour les bloquer
  const { data: approvedBookings } = await supabase
    .from("bookings")
    .select("start_date, end_date, family_id, families(name)")
    .eq("status", "approved")
    .gte("end_date", new Date().toISOString().split("T")[0])
    .order("start_date");

  // Cast pour contourner le typage strict de Supabase
  const safeApprovedBookings = (approvedBookings ??
    []) as unknown as ApprovedBookingRow[];

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <