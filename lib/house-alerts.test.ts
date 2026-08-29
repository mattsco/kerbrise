import { describe, it, expect } from "vitest";
import {
  occupantOn,
  recyclablesCollectionTomorrow,
  parisHour,
  SEND_HOUR_PARIS,
  type StayRow,
} from "./house-alerts";

// Famille Vincent, réellement en base : 31 août → 14 septembre 2026.
const VINCENT: StayRow = {
  start_date: "2026-08-31",
  end_date: "2026-09-14",
  family_id: "vincent",
};

describe("occupantOn — qui dort à Kerbrise cette nuit-là", () => {
  it("trouve l'occupant en plein milieu du séjour", () => {
    expect(occupantOn([VINCENT], "2026-09-08")?.family_id).toBe("vincent");
  });

  it("compte le jour d'ARRIVÉE : on est là le soir même", () => {
    expect(occupantOn([VINCENT], "2026-08-31")?.family_id).toBe("vincent");
  });

  it("ne compte PAS le jour de DÉPART : end_date est le jour où on s'en va", () => {
    expect(occupantOn([VINCENT], "2026-09-14")).toBeNull();
  });

  it("compte la dernière nuit, la veille du départ", () => {
    expect(occupantOn([VINCENT], "2026-09-13")?.family_id).toBe("vincent");
  });

  it("jour de relais : c'est l'ARRIVANTE qui est retenue, pas la partante", () => {
    const partante: StayRow = {
      start_date: "2026-09-01",
      end_date: "2026-09-08",
      family_id: "francois",
    };
    const arrivante: StayRow = {
      start_date: "2026-09-08",
      end_date: "2026-09-15",
      family_id: "antoine",
    };
    // Ordre volontairement défavorable : la partante est en tête de liste.
    expect(occupantOn([partante, arrivante], "2026-09-08")?.family_id).toBe(
      "antoine"
    );
  });

  it("renvoie null quand la maison est vide", () => {
    expect(occupantOn([VINCENT], "2026-09-22")).toBeNull();
    expect(occupantOn([], "2026-09-08")).toBeNull();
  });
});

describe("recyclablesCollectionTomorrow — y a-t-il collecte demain ?", () => {
  it("mardi 8 sept → oui, collecte le mercredi 9 (cas réel demandé par Antoine)", () => {
    const c = recyclablesCollectionTomorrow("2026-09-08");
    expect(c).not.toBeNull();
    expect(c!.type).toBe("recyclables");
    expect(c!.date.getDate()).toBe(9);
    expect(c!.date.getMonth()).toBe(8); // septembre
  });

  it("mardi 15 sept → non : les recyclables passent un mercredi sur DEUX", () => {
    expect(recyclablesCollectionTomorrow("2026-09-15")).toBeNull();
  });

  it("mardi 22 sept → oui, la quinzaine suivante", () => {
    expect(recyclablesCollectionTomorrow("2026-09-22")?.date.getDate()).toBe(23);
  });

  it("un lundi ne déclenche rien, même en semaine de collecte", () => {
    expect(recyclablesCollectionTomorrow("2026-09-07")).toBeNull();
  });

  it("dernière collecte connue : mardi 26 janvier 2027", () => {
    expect(recyclablesCollectionTomorrow("2027-01-26")?.date.getDate()).toBe(26 + 1);
  });

  it("⚠️ après le 31/01/2027 le calendrier est épuisé — null, pas une exception", () => {
    // Ce test documente l'échéance dure de la spec §7 : le rappel s'éteint
    // ici, en silence. Il doit rester VERT — c'est le comportement voulu.
    // Ce qui doit changer, c'est le calendrier (cf. check santé #33).
    expect(recyclablesCollectionTomorrow("2027-02-09")).toBeNull();
    expect(recyclablesCollectionTomorrow("2027-06-01")).toBeNull();
  });
});

describe("parisHour — 18h à Paris toute l'année, malgré un cron en UTC", () => {
  it("été (CEST, UTC+2) : c'est 16h UTC qui vaut 18h à Paris", () => {
    expect(parisHour(new Date("2026-09-08T16:00:00Z"))).toBe(SEND_HOUR_PARIS);
    expect(parisHour(new Date("2026-09-08T17:00:00Z"))).toBe(19);
  });

  it("hiver (CET, UTC+1) : c'est 17h UTC qui vaut 18h à Paris", () => {
    expect(parisHour(new Date("2026-11-03T17:00:00Z"))).toBe(SEND_HOUR_PARIS);
    expect(parisHour(new Date("2026-11-03T16:00:00Z"))).toBe(17);
  });

  it("exactement une des deux exécutions du cron passe le garde, chaque mardi", () => {
    // Le job tourne à 16h ET 17h UTC ; sans ce garde, deux e-mails partiraient.
    for (const jour of ["2026-09-08", "2026-10-20", "2026-11-03", "2027-01-26"]) {
      const passages = [16, 17].filter(
        (h) => parisHour(new Date(`${jour}T${h}:00:00Z`)) === SEND_HOUR_PARIS
      );
      expect(passages).toHaveLength(1);
    }
  });
});
