// garmin/kerbrise-tides/source/KerbriseTidesGlanceView.mc
//
// Vue compacte (boucle de widgets) : titre + prochaine marée. C'est l'usage
// principal de Matt — un coup d'œil sans ouvrir l'app.

using Toybox.WatchUi;
using Toybox.Graphics;

(:glance)
class KerbriseTidesGlanceView extends WatchUi.GlanceView {

    function initialize() {
        GlanceView.initialize();
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_TRANSPARENT, Graphics.COLOR_BLACK);
        dc.clear();

        var h = dc.getHeight();

        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(0, 0, Graphics.FONT_GLANCE, "Marées St-Malo",
            Graphics.TEXT_JUSTIFY_LEFT);

        var next = TideLogic.nextTide();
        var y = h / 2;

        if (next == null) {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(0, y, Graphics.FONT_GLANCE, "Données indisponibles",
                Graphics.TEXT_JUSTIFY_LEFT);
            return;
        }

        var up = next[:type].equals("H");
        var color = up ? Graphics.COLOR_BLUE : Graphics.COLOR_WHITE;
        var when = next[:today] ? "" : "demain ";
        var line = when + TideLogic.fmtTime(next[:hh], next[:mm]);
        if (next[:coef] != null) {
            line += " · " + next[:coef].toString();
        }

        // Flèche (▲ PM / ▼ BM) puis l'heure.
        var s = 6;
        var ax = s;
        var cy = y + dc.getFontHeight(Graphics.FONT_GLANCE) / 2;
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        var pts = up
            ? [ [ax, cy - s], [ax - s, cy + s], [ax + s, cy + s] ]
            : [ [ax, cy + s], [ax - s, cy - s], [ax + s, cy - s] ];
        dc.fillPolygon(pts);
        dc.drawText((2 * s) + 8, y, Graphics.FONT_GLANCE, line, Graphics.TEXT_JUSTIFY_LEFT);
    }
}
