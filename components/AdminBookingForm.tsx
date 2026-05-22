"use client";

import { useState } from "react";
import { adminCreateBooking } from "@/app/dashboard/admin/actions";

type Family = {
  id: string;
  name: string;
  color: string;
};

type User = {
  id: string;
  display_name: string | null;
  family_id: string;
};

export default function AdminBookingForm({
  families,
  users,
}: {
  families: Family[];
  users: User[];
}) {
  const [familyId, setFamilyId] = useState(families[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  // Filtre les users selon la famille sélectionnée
  const filteredUsers = users.filter((u) => u.family_id === familyId);

  return (
    <form action={adminCreateBooking} className="space-y-4">
      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Date début
          </label>
          <input
            type="date"
            name="start_date"
            required
            disabled={submitting}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Date fin
          </label>
          <input
            type="date"
            name="end_date"
            required
            disabled={submitting}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
      </div>

      {/* Famille */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Famille
        </label>
        <select
          name="family_id"
          value={familyId}
          onChange={(e) => setFamilyId(e.target.value)}
          required
          disabled={submitting}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
        >
          {families.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* Auteur */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Créateur (au nom de qui)
        </label>
        <select
          name="author_id"
          required
          disabled={submitting || filteredUsers.length === 0}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
        >
          {filteredUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.display_name ?? "?"}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Liste filtrée selon la famille sélectionnée
        </p>
      </div>

      {/* Statut */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Statut
        </label>
        <select
          name="status"
          required
          disabled={submitting}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
          defaultValue="approved"
        >
          <option value="approved">Approuvé (validé directement)</option>
          <option value="pending">En attente (workflow normal)</option>
        </select>
      </div>

      <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-xs text-purple-900">
        🛡️ Création admin : aucun email ne sera envoyé.
      </div>

      <button
        type="submit"
        disabled={submitting}
        onClick={() => setSubmitting(true)}
        className="w-full rounded-lg bg-purple-700 text-white py-2.5 font-medium hover:bg-purple-800 disabled:opacity-50 transition"
      >
        {submitting ? "Création..." : "Créer la réservation"}
      </button>
    </form>
  );
}