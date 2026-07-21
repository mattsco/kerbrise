import Image from "next/image";
import {
  Calendar,
  Inbox,
  Plus,
  TrendingUp,
  Video,
  Home,
  User,
} from "lucide-react";
import { requireAuthUser } from "@/lib/supabase/auth";
import OfflineShell, {
  OfflineActionCard,
} from "@/components/offline/OfflineShell";
import OfflineTides from "@/components/offline/OfflineTides";
import OfflineExplainer from "@/components/offline/OfflineExplainer";
import houseImg from "@/public/house.jpg";

/**
 * Hub hors ligne — le dashboard sans réseau (spec #37, décision 12).
 *
 * Objectif de fidélité : même chrome, même hero, mêmes cartes dans le même
 * ordre que `/dashboard`. Les sections impossibles hors ligne restent à leur
 * place, grisées, plutôt que de disparaître — sinon l'app a l'air amputée.
 *
 * Protégée par l'auth comme le reste de l'app (décision 6) : le SW ne
 * l'installe qu'une fois l'utilisateur connecté, donc le fetch de précache
 * porte les cookies de session.
 *
 * ⚠️ Le hero n'affiche PAS de nom d'utilisateur, contrairement au dashboard :
 * ce HTML est mis en cache une fois et resservi tel quel. Personnalisé, il
 * accueillerait tout le monde par le prénom du dernier connecté.
 */
export const dynamic = "force-dynamic";

export default async function HorsLignePage() {
  await requireAuthUser();

  return (
    <OfflineShell
      title="Kerbrise"
      hero={
        <div className="relative rounded-3xl overflow-hidden shadow-sm">
          <Image
            src={houseImg}
            alt="Kerbrise"
            width={1024}
            height={683}
            unoptimized
            priority
            className="w-full h-48 sm:h-56 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <p className="text-sm font-medium text-white/90">Kerbrise 🏡</p>
            <h2 className="text-2xl font-bold mt-0.5">Mode hors ligne</h2>
          </div>
        </div>
      }
    >
      <OfflineExplainer />

      <OfflineTides />

      <div className="space-y-3">
        <OfflineActionCard
          href="/hors-ligne/calendrier"
          icon={<Calendar className="w-5 h-5" />}
          iconBg="bg-blue-50 text-blue-600"
          title="Calendrier"
          desc="Vue des réservations sur 3 mois"
        />
        <OfflineActionCard
          icon={<Inbox className="w-5 h-5" />}
          iconBg="bg-amber-50 text-amber-600"
          title="Demandes"
          desc="Mes demandes et celles à valider"
        />
        <OfflineActionCard
          icon={<Plus className="w-5 h-5" />}
          iconBg="bg-emerald-50 text-emerald-600"
          title="Nouvelle demande"
          desc="Demander un séjour à Kerbrise"
        />
        <OfflineActionCard
          icon={<TrendingUp className="w-5 h-5" />}
          iconBg="bg-purple-50 text-purple-600"
          title="Stats"
          desc="Quelques graphiques"
        />
        <OfflineActionCard
          icon={<Video className="w-5 h-5" />}
          iconBg="bg-cyan-50 text-cyan-600"
          title="Webcam live"
          desc="Voir le Val en direct"
        />
        <OfflineActionCard
          href="/hors-ligne/a-propos"
          icon={<Home className="w-5 h-5" />}
          iconBg="bg-orange-50 text-orange-600"
          title="À propos de la maison"
          desc="Liens, contacts et infos pratiques"
        />
        <OfflineActionCard
          href="/hors-ligne/profil"
          icon={<User className="w-5 h-5" />}
          iconBg="bg-slate-100 text-slate-600"
          title="Mon profil"
          desc="Mes infos, stats et mot de passe"
        />
      </div>
    </OfflineShell>
  );
}
