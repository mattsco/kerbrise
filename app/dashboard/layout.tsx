import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

/**
 * Layout du dashboard.
 *
 * Créé pour #37 : c'est le point de montage du service worker, et c'est ce
 * qui garantit l'enregistrement post-login. Toutes les pages sous /dashboard
 * passent par requireAuthUser ; monter le registrar ici, plutôt que dans le
 * layout racine, suffit à ne jamais l'enregistrer avant authentification.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <ServiceWorkerRegistrar />
    </>
  );
}
