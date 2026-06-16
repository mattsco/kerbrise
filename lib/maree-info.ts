import * as cheerio from "cheerio";

export interface TideEvent {
  type: "PM" | "BM";
  time: string;
  height: number;
  coefficient?: number;
}

export interface TideDay {
  date: string;
  events: TideEvent[];
}


export interface TideResponse {
  port: string;
  waterTemperature?: number;
  source: string;
  generatedAt: string;
  days: TideDay[];
}


export async function fetchSaintMaloTides(): Promise<TideResponse> {
  const response = await fetch("https://maree.info/52", {
    headers: {
      "User-Agent": "Kerbrise/1.0 (+https://kerbrise.fr)",
    },
    // Cache 3h : protège maree.info du martèlement (sinon re-scrape à chaque
    // chargement du dashboard pendant un séjour) et accélère le rendu.
    next: { revalidate: 10800 },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`maree.info returned ${response.status}`);
  }

  const html = await response.text();

  const $ = cheerio.load(html);


  const tempText = $("#TempEau")
  .text()
  .trim();

  const parsedTemp = tempText
    ? parseFloat(tempText.replace("°C", "").replace(",", "."))
    : NaN;
  const waterTemperature: number | undefined = Number.isFinite(parsedTemp)
    ? parsedTemp
    : undefined;


  const days: TideDay[] = [];

  $("#MareeJours tr[id^='MareeJours_']").each((_, row) => {
    const dateCell = $(row).find("th").first();

    const date = dateCell
      .text()
      .replace(/\s+/g, " ")
      .trim();

    const times: string[] = [];
    const heights: number[] = [];
    const coefs: (number | undefined)[] = [];

    const timesCell = $(row).find("td").eq(0);

    timesCell.contents().each((_, node) => {
      const text = $(node).text().trim();

      if (/^\d{2}h\d{2}$/.test(text)) {
        times.push(text);
      }
    });

    const heightsCell = $(row).find("td").eq(1);

    heightsCell.contents().each((_, node) => {
      const text = $(node)
        .text()
        .trim()
        .replace(",", ".");

      if (text.endsWith("m")) {
        heights.push(
          parseFloat(text.replace("m", ""))
        );
      }
    });

    const coefCell = $(row).find("td").eq(2);

    coefCell.find("b").each((_, el) => {
      const coef = parseInt(
        $(el).text().trim(),
        10
      );

      if (!isNaN(coef)) {
        coefs.push(coef);
      }
    });

    const events: TideEvent[] = [];

    times.forEach((time, idx) => {
      const isPM = idx % 2 === 1;

      events.push({
        type: isPM ? "PM" : "BM",
        time,
        height: heights[idx],
        coefficient: isPM
          ? coefs[Math.floor(idx / 2)]
          : undefined,
      });
    });

    days.push({
      date,
      events,
    });
  });

return {
  port: "Saint-Malo",
  waterTemperature,
  source: "https://maree.info/52",
  generatedAt: new Date().toISOString(),
  days,
};
}

/**
 * Variante non-throwing pour la consommation côté UI : renvoie `null` plutôt
 * que de lever (timeout, 5xx, HTML changé, parsing cassé). C'est ce que le
 * dashboard appelle — la carte masque les lignes marée/mer si c'est `null`.
 */
export async function getSaintMaloTidesSafe(): Promise<TideResponse | null> {
  try {
    return await fetchSaintMaloTides();
  } catch {
    return null;
  }
}
