// garmin/kerbrise-tides/source/KerbriseTidesView.mc
//
// Vue plein écran : les 2 prochaines marées avec coefficient (sur les PM).
// ▲ = pleine mer (montante), ▼ = basse mer (descendante).

using Toybox.WatchUi;
using Toybox.Graphics;

class KerbriseTidesView extends WatchUi.View {

    function initialize() {
        View.initialize();
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        // Titre
        dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.06, Graphics.FONT_TINY, "Marées · St-Malo",
            Graphics.TEXT_JUSTIFY_CENTER);

        var tides = TideLogic.nextTides(2);
        if (tides.size() == 0) {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h / 2, Graphics.FONT_SMALL, "Données indisponibles",
                Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        var centers = [ h * 0.42, h * 0.78 ];
        for (var i = 0; i < tides.size(); i++) {
            drawTide(dc, cx, centers[i], tides[i], i == 0);
        }
    }

    // Triangle plein. up=true -> pointe en haut (PM), sinon vers le bas (BM).
    function drawArrow(dc, x, y, up, s) {
        var pts;
        if (up) {
            pts = [ [x, y - s], [x - s, y + s], [x + s, y + s] ];
        } else {
            pts = [ [x, y + s], [x - s, y - s], [x + s, y - s] ];
        }
        dc.fillPolygon(pts);
    }

    // Un bloc : [flèche] HH hMM (+ "demain"), et dessous "coef 74" si PM.
    function drawTide(dc, cx, y, t, highlight) {
        var up = t[:type].equals("H");
        var prefix = t[:today] ? "" : "demain ";
        var time = prefix + TideLogic.fmtTime(t[:hh], t[:mm]);

        var color;
        if (highlight) {
            color = Graphics.COLOR_YELLOW;
        } else if (up) {
            color = Graphics.COLOR_BLUE;
        } else {
            color = Graphics.COLOR_LT_GRAY;
        }

        var s = 9;            // demi-taille de la flèche
        var gap = 14;
        var tw = dc.getTextWidthInPixels(time, Graphics.FONT_MEDIUM);
        var total = (2 * s) + gap + tw;
        var startX = cx - total / 2;
        var ax = startX + s;

        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        drawArrow(dc, ax, y, up, s);
        dc.drawText(startX + (2 * s) + gap, y, Graphics.FONT_MEDIUM, time,
            Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);

        if (t[:coef] != null) {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, y + 26, Graphics.FONT_XTINY, "coef " + t[:coef].toString(),
                Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
        }
    }
}
