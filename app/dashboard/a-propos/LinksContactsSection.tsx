import { ExternalLink, Phone } from "lucide-react";

type Link = {
  title: string;
  url: string;
  icon: string;
};

type Contact = {
  label: string;
  name: string | null;
  phone: string | null;
  icon: string;
};

// Entrées figées : modifiables uniquement par le code (plus d'édition en ligne).
const LINKS: Link[] = [
  {
    icon: "📊",
    title: "Compta de la maison",
    url: "https://docs.google.com/spreadsheets/d/19jKLYZXHXAsqdKzW-dgQrmDkgbLXQQP8/edit?usp=drive_web&ouid=108568639907859465345&rtpof=true",
  },
  {
    icon: "📅",
    title: "Ancien calendrier",
    url: "https://docs.google.com/spreadsheets/d/1-05ga6mutfyR8dFNna5UlURWLG7yksem/edit?usp=drivesdk&ouid=108568639907859465345&rtpof=true&sd=true",
  },
];

const CONTACTS: Contact[] = [
  {
    icon: "🚕",
    label: "Taxi ABC Mobilité",
    name: null,
    phone: "06 10 03 18 86",
  },
  {
    icon: "💆🏻",
    label: "Phytomer Roth",
    name: null,
    phone: "02 23 18 31 99",
  },
];

export default function LinksContactsSection() {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
      <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
        🔗 Liens & contacts utiles
      </h2>

      {LINKS.length > 0 && (
        <div className="space-y-2">
          {LINKS.map((link) => (
            <a
              key={link.title}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 p-3 transition min-w-0"
            >
              <span className="text-2xl flex-shrink-0">{link.icon}</span>
              <span className="font-medium text-slate-900 text-sm flex-1 truncate">
                {link.title}
              </span>
              <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0" />
            </a>
          ))}
        </div>
      )}

      {CONTACTS.length > 0 && (
        <div className="space-y-2">
          {CONTACTS.map((c) => (
            <div
              key={c.label}
              className="flex items-center gap-3 bg-slate-50 rounded-xl border border-slate-100 p-3"
            >
              <span className="text-2xl flex-shrink-0">{c.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm">{c.label}</p>
                {c.name && (
                  <p className="text-xs text-slate-600 truncate">{c.name}</p>
                )}
              </div>
              {c.phone && (
                <a
                  href={`tel:${c.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 flex-shrink-0"
                >
                  <Phone className="w-3 h-3" />
                  <span className="hidden sm:inline">{c.phone}</span>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
