// src/utils/aiNarrative.js

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function fmtTemp(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${Math.round(n)}°C`;
}

function pickPart(hour) {
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function summarizeHours(hours) {
  if (!hours.length) return null;

  let minT = Infinity, maxT = -Infinity;
  let ppMax = 0;
  let precipSum = 0;
  let windMax = 0;

  // “dominant” weather code (approx) via mode
  const codeCount = new Map();

  for (const h of hours) {
    minT = Math.min(minT, h.temp);
    maxT = Math.max(maxT, h.temp);
    ppMax = Math.max(ppMax, h.pp);
    precipSum += h.precip;
    windMax = Math.max(windMax, h.wind);

    codeCount.set(h.code, (codeCount.get(h.code) || 0) + 1);
  }

  let domCode = hours[0].code;
  let best = -1;
  for (const [code, c] of codeCount.entries()) {
    if (c > best) { best = c; domCode = code; }
  }

  return { minT, maxT, ppMax, precipSum, windMax, domCode };
}

function confidenceLabel(t, confKey) {
  // confKey: "high"|"medium"|"low"
  if (confKey === "high") return t.highConfidence;
  if (confKey === "medium") return t.mediumConfidence;
  return t.lowConfidence;
}

// même logique que ton estimateConfidence, mais local ici (simple et stable)
function estimateConfidence({ rainProb, windSpeed }) {
  const midUncertainty = 1 - Math.abs((rainProb ?? 50) - 50) / 50;
  const windPenalty = clamp((windSpeed ?? 0) / 60, 0, 1);
  const score = clamp(0.85 - 0.35 * midUncertainty - 0.25 * windPenalty, 0.25, 0.95);
  if (score >= 0.72) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

export function buildAiNarrative({
  t,
  language,
  locationLabel,
  current,
  hourly,
  daily,
  getWeatherDescription, // (lang, code) => string
}) {
  if (!current || !hourly || !daily) return { title: "", headline: "", paragraphs: [], bullets: [] };

  const now = new Date();

  // Construire les heures (48h)
  const H = (hourly.time || []).slice(0, 48).map((time, i) => ({
    dt: new Date(time),
    temp: Number((hourly.temperature_2m || [])[i] ?? NaN),
    pp: Number((hourly.precipitation_probability || [])[i] ?? 0),
    precip: Number((hourly.precipitation || [])[i] ?? 0),
    wind: Number((hourly.wind_speed_10m || [])[i] ?? 0),
    code: Number((hourly.weather_code || [])[i] ?? 3),
  })).filter((h) => Number.isFinite(h.temp) && h.dt instanceof Date && !Number.isNaN(h.dt.getTime()));

  const future = H.filter((h) => h.dt >= now);

  // Segments “proches” : next 6h, puis par parties de journée “reste d’aujourd’hui”
  const next6h = future.slice(0, 6);

  const todayKey = now.toDateString();
  const todayFuture = future.filter((h) => h.dt.toDateString() === todayKey);

  const byPartToday = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };

  for (const h of todayFuture) {
    byPartToday[pickPart(h.dt.getHours())].push(h);
  }

  const segMorning = summarizeHours(byPartToday.morning);
  const segAfternoon = summarizeHours(byPartToday.afternoon);
  const segEvening = summarizeHours(byPartToday.evening);

  // “cette nuit” = heures jusqu’à demain 06:00
  const nightHours = future.filter((h) => {
    const isToday = h.dt.toDateString() === todayKey;
    const isTomorrowEarly = (!isToday) && h.dt.getHours() < 6;
    return pickPart(h.dt.getHours()) === "night" && (isToday || isTomorrowEarly);
  });
  const segNight = summarizeHours(nightHours);

  // demain via daily[1]
  const tomorrowMax = Number((daily.temperature_2m_max || [])[1] ?? NaN);
  const tomorrowMin = Number((daily.temperature_2m_min || [])[1] ?? NaN);
  const tomorrowPP = Number((daily.precipitation_probability_max || [])[1] ?? 0);
  const tomorrowWind = Number((daily.wind_speed_10m_max || [])[1] ?? 0);
  const tomorrowCode = Number((daily.weather_code || [])[1] ?? 3);

  // headline: basé sur next6h
  const next6 = summarizeHours(next6h) || segMorning || segAfternoon || segEvening || segNight;
  const headDesc = next6 ? getWeatherDescription(language, next6.domCode).toLowerCase() : getWeatherDescription(language, current.weather_code).toLowerCase();
  const headPP = next6 ? Math.round(next6.ppMax) : Math.round((daily.precipitation_probability_max || [0])[0] ?? 0);
  const headWind = next6 ? Math.round(next6.windMax) : Math.round(current.wind_speed_10m ?? 0);

  // risques
  const freezingRisk =
    (next6 && next6.ppMax >= 50 && next6.minT <= 1) ||
    (segNight && segNight.ppMax >= 50 && segNight.minT <= 1);

  const strongWindRisk = headWind >= 45 || tomorrowWind >= 50;
  const heavyRainRisk = (next6 && next6.ppMax >= 80) || headPP >= 80;

  const conf = estimateConfidence({ rainProb: headPP, windSpeed: headWind });
  const confLabel = confidenceLabel(t, conf);

  // Paragraphes (texte original)
  const paragraphs = [];

  paragraphs.push(
    `${t.aiP1Intro} ${locationLabel}. ${t.aiP1Now}: ${fmtTemp(current.temperature_2m)} (${t.feelsLike.toLowerCase()} ${fmtTemp(current.apparent_temperature)}), ${getWeatherDescription(language, current.weather_code).toLowerCase()}. ` +
    `${t.aiP1Wind}: ${Math.round(current.wind_speed_10m ?? 0)} km/h. ${t.aiP1Confidence} ${confLabel}.`
  );

  // Aujourd’hui (reste)
  const todayBits = [];
  const pushPart = (seg, labelKey) => {
    if (!seg) return;
    const desc = getWeatherDescription(language, seg.domCode).toLowerCase();
    todayBits.push(
      `${t[labelKey]}: ${fmtTemp(seg.minT)} → ${fmtTemp(seg.maxT)}, ${desc}${seg.ppMax ? `, ${Math.round(seg.ppMax)}% ${t.aiRainRisk}` : ""}${seg.windMax ? `, ${t.aiWindLabel} ${Math.round(seg.windMax)} km/h` : ""}.`
    );
  };

  pushPart(segMorning, "aiMorning");
  pushPart(segAfternoon, "aiAfternoon");
  pushPart(segEvening, "aiEvening");

  if (todayBits.length) {
    paragraphs.push(`${t.aiTodayTitle} ${todayBits.join(" ")}`);
  }

  // Nuit
  if (segNight) {
    const desc = getWeatherDescription(language, segNight.domCode).toLowerCase();
    paragraphs.push(
      `${t.aiTonightTitle} ${desc}. ${t.aiTempsRange} ${fmtTemp(segNight.minT)} → ${fmtTemp(segNight.maxT)}. ` +
      `${t.aiRainMax} ${Math.round(segNight.ppMax)}%. ${t.aiWindLabel} ${Math.round(segNight.windMax)} km/h.`
    );
  }

  // Demain
  if (Number.isFinite(tomorrowMax) && Number.isFinite(tomorrowMin)) {
    const desc = getWeatherDescription(language, tomorrowCode).toLowerCase();
    paragraphs.push(
      `${t.aiTomorrowTitle} ${desc}. ${t.aiTempsRange} ${fmtTemp(tomorrowMin)} → ${fmtTemp(tomorrowMax)}. ` +
      `${t.aiRainMax} ${Math.round(tomorrowPP)}%. ${t.aiWindLabel} ${Math.round(tomorrowWind)} km/h.`
    );
  }

  const bullets = [];
  if (heavyRainRisk) bullets.push(t.aiBulletUmbrella);
  if (strongWindRisk) bullets.push(t.aiBulletWind);
  if (freezingRisk) bullets.push(t.aiBulletFreeze);

  return {
    title: t.aiLongTitle,
    headline: `${fmtTemp(current.temperature_2m)} • ${headDesc} • ${headPP}% ${t.aiRainRisk} • ${confLabel}`,
    paragraphs,
    bullets,
  };
}
