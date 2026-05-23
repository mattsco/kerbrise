"use client";

import { useEffect, useState } from "react";

type UserLocation = {
  id: string;
  name: string;
  email: string;
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
  family: string;
  color: string;
  last_seen_at: string | null;
};

export default function LocationsMap({ users }: { users: UserLocation[] }) {
  const [Map, setMap] = useState<any>(null);

  useEffect(() => {
    // Charger Leaflet uniquement côté client
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      setMap({ L });
    })();
  }, []);

  useEffect(() => {
    if (!Map || users.length === 0) return;

    const { L } = Map;
    const container = document.getElementById("locations-map");
    if (!container) return;

    // Cleanup au cas où le composant se re-render
    container.innerHTML = "";

    // Centrer sur la moyenne des positions
    const avgLat =
      users.reduce((s, u) => s + u.lat, 0) / users.length;
    const avgLng =
      users.reduce((s, u) => s + u.lng, 0) / users.length;

    const map = L.map(container).setView([avgLat, avgLng], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 18,
    }).addTo(map);

    // Ajouter un marker pour chaque user
    for (const u of users) {
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 24px; height: 24px;
          background-color: ${u.color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const lastSeen = u.last_seen_at
        ? new Date(u.last_seen_at).toLocaleString("fr-FR", {
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "?";

      L.marker([u.lat, u.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family: -apple-system, sans-serif;">
            <div style="font-weight: 600; color: #0f172a;">${u.name}</div>
            <div style="color: #64748b; font-size: 12px;">${u.city ?? "?"}, ${u.country ?? "?"}</div>
            <div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">Vu : ${lastSeen}</div>
          </div>`
        );
    }

    return () => {
      map.remove();
    };
  }, [Map, users]);

  if (users.length === 0) {
    return (
      <div className="h-[400px] bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 text-sm">
        Aucune position à afficher
      </div>
    );
  }

  return (
    <div
      id="locations-map"
      className="h-[400px] sm:h-[500px] rounded-xl overflow-hidden"
    />
  );
}