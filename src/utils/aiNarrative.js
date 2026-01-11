// src/utils/aiNarrative.js

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function dayPartLabel(lang, key) {
  const map = {
    fr: { morning: "Matin", afternoon: "Après-midi", evening: "Soir" },
    nl: { morning: "Ochtend", afternoon: "Namiddag", evening: "Avond" },
    de: { morning: "Morgen", afternoon: "Nachmittag", evening: "Abend" },
    en: { morning: "Morning", afternoon: "Afternoon", evening: "Evening" },
  };
  return (map[lang] || map.fr)[key] || key;
}

function summarizePart({ temps, pops }) {
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const pop = Math.max(...pops);
  return { min, max, pop };
}

// Renvoie un objet “prêt à afficher” façon IRM : title + headline + paragraphs + bullets
export function buildAiNarrative({
  t,
  language,
  locationLabel,
  current,
  hourly,
  daily,
  getWeatherDescription,
}) {
  const tempNow = Math.round(safeNum(current?.temperature_2m, 0));
  const windNow = Math.round(safeNum(current?.wind_speed_10m, 0));
  const codeNow = safeNum(current?.weather_code, 3);
  const descNow =
    typeof getWeatherDescription === "function"
      ? getWeatherDescription(language, codeNow)
      : "";

  const popToday = Math.round(
    safeNum((daily?.precipitation_probability_max || [0])[0], 0)
  );
  const tMax = Math.round(safeNum((daily?.temperature_2m_max || [tempNow])[0], tempNow));
  const tMin = Math.round(safeNum((daily?.temperature_2m_min || [tempNow])[0], tempNow));
  const uv = Math.round(safeNum((daily?.uv_index_max || [0])[0], 0));

  // Découpe “matin / après-midi / soir” sur les 24 prochaines heures (grossier mais très lisible)
  const times = hourly?.time || [];
  const temps = hourly?.temperature_2m || [];
  const pops = hourly?.precipitation_probability || [];

  const buckets = { morning: [], afternoon: [], evening: [] };
  const bucketsPop = { morning: [], afternoon: [], evening: [] };

  for (let i = 0; i < Math.min(24, times.length); i++) {
    const d = new Date(times[i]);
    const h = d.getHours();

    let key = "evening";
    if (h >= 6 && h < 12) key = "morning";
    else if (h >= 12 && h < 18) key = "afternoon";
    else key = "evening";

    buckets[key].push(safeNum(temps[i], tempNow));
    bucketsPop[key].push(safeNum(pops[i], 0));
  }

  const parts = ["morning", "afternoon", "evening"].map((key) => {
    const vals = buckets[key].length ? buckets[key] : [tempNow];
    const pps = bucketsPop[key].length ? bucketsPop[key] : [popToday];
    const s = summarizePart({ temps: vals, pops: pps });
    return {
      key,
      label: dayPartLabel(language, key),
      min: Math.round(s.min),
      max: Math.round(s.max),
      pop: Math.round(s.pop),
    };
  });

  // Titre + headline (style IRM)
  const title =
    language === "fr"
      ? `Bulletin pour ${locationLabel}`
      : language === "nl"
      ? `Weerbericht voor ${locationLabel}`
      : language === "de"
      ? `Wetterbericht für ${locationLabel}`
      : `Weather report for ${locationLabel}`;

  const headline =
    language === "fr"
      ? `Actuellement : ${tempNow}°C, ${descNow.toLowerCase()} • Vent ${windNow} km/h • Pluie max aujourd’hui : ${popToday}%`
      : language === "nl"
      ? `Nu: ${tempNow}°C, ${descNow.toLowerCase()} • Wind ${windNow} km/u • Max. neerslagkans vandaag: ${popToday}%`
      : language === "de"
      ? `Aktuell: ${tempNow}°C, ${descNow.toLowerCase()} • Wind ${windNow} km/h • Max. Regenrisiko heute: ${popToday}%`
      : `Now: ${tempNow}°C, ${descNow.toLowerCase()} • Wind ${windNow} km/h • Max rain chance today: ${popToday}%`;

  // Paragraphes “rich”
  const paragraphs = [
    language === "fr"
      ? `Températures : ${tMin}°C à ${tMax}°C aujourd’hui.`
      : language === "nl"
      ? `Temperaturen: vandaag van ${tMin}°C tot ${tMax}°C.`
      : language === "de"
      ? `Temperaturen: heute zwischen ${tMin}°C und ${tMax}°C.`
      : `Temperatures: ${tMin}°C to ${tMax}°C today.`,
    language === "fr"
      ? `Lecture par moments : ${parts
          .map((p) => `${p.label} ${p.min}–${p.max}°C (pluie ${p.pop}%)`)
          .join(" • ")}.`
      : language === "nl"
      ? `Per dagdeel: ${parts
          .map((p) => `${p.label} ${p.min}–${p.max}°C (regen ${p.pop}%)`)
          .join(" • ")}.`
      : language === "de"
      ? `Nach Tagesabschnitt: ${parts
          .map((p) => `${p.label} ${p.min}–${p.max}°C (Regen ${p.pop}%)`)
          .join(" • ")}.`
      : `By part of day: ${parts
          .map((p) => `${p.label} ${p.min}–${p.max}°C (rain ${p.pop}%)`)
          .join(" • ")}.`,
    language === "fr"
      ? `Indice UV max : ${uv}.`
      : language === "nl"
      ? `Max UV-index: ${uv}.`
      : language === "de"
      ? `Max UV-Index: ${uv}.`
      : `Max UV index: ${uv}.`,
  ];

  // “Conseils” (petits chips)
  const bullets = [];
  if (popToday >= 60) bullets.push(language === "fr" ? "Parapluie recommandé" : language === "nl" ? "Paraplu aanbevolen" : language === "de" ? "Regenschirm empfohlen" : "Bring an umbrella");
  if (windNow >= 35) bullets.push(language === "fr" ? "Vent soutenu" : language === "nl" ? "Flinke wind" : language === "de" ? "Starker Wind" : "Breezy");
  if (tMin <= 0) bullets.push(language === "fr" ? "Risque de gel" : language === "nl" ? "Kans op vorst" : language === "de" ? "Frost möglich" : "Frost possible");
  if (uv >= 3) bullets.push(language === "fr" ? "Protection UV" : language === "nl" ? "UV-bescherming" : language === "de" ? "UV-Schutz" : "UV protection");
  if (!bullets.length) bullets.push(language === "fr" ? "Rien à signaler" : language === "nl" ? "Geen bijzonderheden" : language === "de" ? "Keine Besonderheiten" : "Nothing notable");

  return { title, headline, paragraphs, bullets };
}
