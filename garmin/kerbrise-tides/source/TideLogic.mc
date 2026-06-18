// garmin/kerbrise-tides/source/TideLogic.mc
//
// Logique partagée glance + widget : conversion date -> jour de l'année,
// marées du jour, calcul de la prochaine marée vs heure locale.
// Aucune dépendance réseau ; lit uniquement TideData (embarqué).

using Toybox.Lang;
using Toybox.Time;
using Toybox.Time.Gregorian;

module TideLogic {

    const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    function isLeap(y as Lang.Number) as Lang.Boolean {
        return (y % 4 == 0) && (y % 100 != 0 || y % 400 == 0);
    }

    // 1-based : 1er janvier = 1.
    function dayOfYear(year as Lang.Number, month as Lang.Number, day as Lang.Number) as Lang.Number {
        var doy = day;
        for (var m = 1; m < month; m++) {
            doy += MONTH_DAYS[m - 1];
            if (m == 2 && isLeap(year)) { doy += 1; }
        }
        return doy;
    }

    function fmtTime(hh as Lang.Number, mm as Lang.Number) as Lang.String {
        return hh.format("%02d") + "h" + mm.format("%02d");
    }

    // "H"/"L" -> libellé court.
    function shortLabel(type as Lang.String) as Lang.String {
        return type.equals("H") ? "PM" : "BM";
    }

    // "H"/"L" -> libellé long.
    function longLabel(type as Lang.String) as Lang.String {
        return type.equals("H") ? "Pleine" : "Basse";
    }

    // Composantes de l'instant courant (Europe/Paris = fuseau de la montre).
    function nowParts() as Lang.Dictionary {
        var info = Gregorian.info(Time.now(), Time.FORMAT_SHORT);
        return {
            :year => info.year, :month => info.month, :day => info.day,
            :hour => info.hour, :min => info.min
        };
    }

    // Marées du jour courant (tableau de [type, hh, mm]).
    function todayEvents() as Lang.Array {
        var n = nowParts();
        return TideData.dayEvents(n[:year], dayOfYear(n[:year], n[:month], n[:day]));
    }

    // Les `count` prochaines marées (aujourd'hui puis demain si besoin).
    // Chaque entrée : {:type, :hh, :mm, :coef, :today}. Tableau vide si pas de données.
    function nextTides(count as Lang.Number) as Lang.Array {
        var result = [];
        var n = nowParts();
        var nowMin = n[:hour] * 60 + n[:min];

        var today = TideData.dayEvents(n[:year], dayOfYear(n[:year], n[:month], n[:day]));
        for (var i = 0; i < today.size() && result.size() < count; i++) {
            var e = today[i];
            if (e[1] * 60 + e[2] > nowMin) {
                result.add({ :type => e[0], :hh => e[1], :mm => e[2], :coef => e[3], :today => true });
            }
        }

        if (result.size() < count) {
            var tInfo = Gregorian.info(Time.now().add(new Time.Duration(86400)), Time.FORMAT_SHORT);
            var tEvents = TideData.dayEvents(tInfo.year, dayOfYear(tInfo.year, tInfo.month, tInfo.day));
            for (var j = 0; j < tEvents.size() && result.size() < count; j++) {
                var e = tEvents[j];
                result.add({ :type => e[0], :hh => e[1], :mm => e[2], :coef => e[3], :today => false });
            }
        }
        return result;
    }

    // Prochaine marée seule : {:type, :hh, :mm, :coef, :today}. null si rien.
    function nextTide() as Lang.Dictionary or Null {
        var t = nextTides(1);
        return t.size() > 0 ? t[0] : null;
    }
}
