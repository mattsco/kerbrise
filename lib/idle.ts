/**
 * Exécute une tâche d'arrière-plan sans jamais concurrencer le chargement de
 * la page.
 *
 * Deux conditions cumulées, dans l'ordre :
 *   1. la page a fini de charger (`load`) — donc tout ce que l'utilisateur
 *      attend est arrivé ;
 *   2. le navigateur est inactif (`requestIdleCallback`) — donc on ne vole pas
 *      de temps CPU à l'hydratation ou à un rendu en cours.
 *
 * Sans le point 1, un `setTimeout` de quelques secondes se déclenche pendant
 * le chargement sur une connexion lente : exactement le moment où il ne faut
 * pas lancer de téléchargement d'arrière-plan.
 *
 * `requestIdleCallback` n'existe pas sur Safari < 17 (donc sur une partie des
 * iPhone de la famille) : repli sur un `setTimeout` après `load`.
 *
 * Renvoie une fonction d'annulation, à appeler au démontage.
 */
export function runWhenIdle(task: () => void, fallbackDelayMs = 2000): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let idleId: number | undefined;

  function schedule() {
    if (cancelled) return;

    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;

    if (ric) {
      // `timeout` garantit l'exécution même si le navigateur n'est jamais
      // vraiment inactif (onglet occupé, animation en boucle).
      idleId = ric(() => {
        if (!cancelled) task();
      }, { timeout: 10000 });
    } else {
      timer = setTimeout(() => {
        if (!cancelled) task();
      }, fallbackDelayMs);
    }
  }

  if (document.readyState === "complete") {
    schedule();
  } else {
    window.addEventListener("load", schedule, { once: true });
  }

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    const cic = (
      window as unknown as { cancelIdleCallback?: (id: number) => void }
    ).cancelIdleCallback;
    if (idleId !== undefined && cic) cic(idleId);
    window.removeEventListener("load", schedule);
  };
}
