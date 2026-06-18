// garmin/kerbrise-tides/source/KerbriseTidesApp.mc
//
// Point d'entrée du widget. getGlanceView() est annoté (:glance) : c'est ce
// qui fait apparaître la vue compacte dans la boucle de widgets du FR255.

using Toybox.Application;
using Toybox.WatchUi;

class KerbriseTidesApp extends Application.AppBase {

    function initialize() {
        AppBase.initialize();
    }

    // Vue plein écran (ouverture du widget).
    function getInitialView() {
        return [ new KerbriseTidesView() ];
    }

    // Vue compacte dans la boucle de widgets.
    (:glance)
    function getGlanceView() {
        return [ new KerbriseTidesGlanceView() ];
    }
}
