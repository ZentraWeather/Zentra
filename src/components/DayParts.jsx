import React, { useMemo } from "react";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pickLabel(language, key) {
  const dict = {
    morning: { fr: "Matin", nl: "Ochtend", de: "Morgen", en: "Morning" },
    afternoon: { fr: "Après-midi", nl: "Namiddag", de: "Nachmittag", en: "Afternoon" },
    evening: { fr: "Soir", nl: "Avond", de: "Abend", en: "Evening" },
  };
  return dict[key]?.[language] || dict[key]?.fr || key;
}

function mostFrequent(arr) {
  const m = new Map();
  for (const v of arr) m.set(v, (m.get(v) || 0) + 1);
  let best = null;
  let bestN = -1;
  for (const [k, n] of m.entries()) {
    if (n > bestN) { bestN = n; best = k; }
  }
  return best;
}

export default function DayParts({ hourly, language = "fr", t, darkMode, theme, getWeatherIcon }) {
  const parts = useMemo(() => {
    const times = (hourly?.time || []).slice(0, 48);
    const temps = (hourly?.temperature_2m || []).slice(0, 48).map(Number);
    const pp = (hourly?.precipitation_probability || []).slice(0, 48).map(Number);
    const pr = (hourly?.precipitation || []).slice(0, 48).map(Number);
    const wc = (hourly?.weather_code || []).slice(0, 48).map(Number);

    const rows = times.map((time, i) => {
      const d = new Date(time);
      return {
        d,
        hour: d.getHours(),
        temp: Number.isFinite(temps[i]) ? temps[i] : 0,
        pp: Number.isFinite(pp[i]) ? pp[i] : 0,
        pr: Number.isFinite(pr[i]) ? pr[i] : 0,
        wc: Number.isFinite(wc[i]) ? wc[i] : 3,
      };
    });

    // parts : 06-12 / 12-18 / 18-24
    const ranges = [
      { key: "morning", from: 6, to: 12 },
      { key: "afternoon", from: 12, to: 18 },
      { key: "evening", from: 18, to: 24 },
    ];

    return ranges.map((r) => {
      const seg = rows.filter((x) => x.hour >= r.from && x.hour < r.to);
      if (!seg.length) return { ...r, ok: false };

      const minT = Math.min(...seg.map((x) => x.temp));
      const maxT = Math.max(...seg.map((x) => x.temp));
      const maxPP = Math.max(...seg.map((x) => x.pp));
      const sumPr = seg.reduce((a, x) => a + x.pr, 0);
      const iconCode = mostFrequent(seg.map((x) => x.wc)) ?? 3;

      return {
        ...r,
        ok: true,
        minT,
        maxT,
        maxPP,
        sumPr,
        iconCode,
      };
    });
  }, [hourly]);

  const cards = parts.filter((p) => p.ok);
  if (!cards.length) return null;

  return (
    <div className={`rounded-2xl p-4 mb-6 ${theme?.card || ""}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className={`text-sm font-extrabold ${theme?.text || ""}`}>
          {t?.daypartsTitle || (language === "fr" ? "Résumé par moment de la journée" : "Day summary")}
        </div>
        <div className={`text-xs font-bold ${theme?.muted2 || ""}`}>
          {t?.daypartsHint || (language === "fr" ? "Temp min/max + risque pluie" : "Min/Max + rain risk")}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((p) => {
          const label = t?.[`dayparts_${p.key}`] || pickLabel(language, p.key);
          const risk = clamp(Math.round(p.maxPP), 0, 100);

          return (
            <div
              key={p.key}
              className={`rounded-2xl p-4 border transition ${darkMode ? "border-white/10 bg-white/4 hover:bg-white/6" : "border-slate-200 bg-white/60 hover:bg-white/80"} backdrop-blur-xl`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={`text-sm font-extrabold ${theme?.text || ""}`}>{label}</div>
                  <div className={`mt-1 text-xs ${theme?.muted2 || ""}`}>
                    {t?.daypartsTemps || (language === "fr" ? "Températures" : "Temps")} :{" "}
                    <span className="font-extrabold">{Math.round(p.minT)}°</span>{" "}
                    → <span className="font-extrabold">{Math.round(p.maxT)}°</span>
                  </div>
                </div>

                <div className="shrink-0">
                  {typeof getWeatherIcon === "function" ? getWeatherIcon(p.iconCode, "w-10 h-10") : null}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className={`text-xs font-extrabold ${darkMode ? "text-sky-300" : "text-sky-600"}`}>
                  {t?.daypartsRainRisk || (language === "fr" ? "Risque pluie" : "Rain risk")} : {risk}%
                </div>

                <div className={`text-xs font-bold ${theme?.muted2 || ""}`}>
                  {t?.daypartsRainSum || (language === "fr" ? "Cumul" : "Total")} :{" "}
                  <span className="font-extrabold">{p.sumPr.toFixed(1)} mm</span>
                </div>
              </div>

              <div className="mt-3 h-2 rounded-full overflow-hidden bg-black/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${risk}%`,
                    background: darkMode
                      ? "linear-gradient(90deg, rgba(56,189,248,.9), rgba(217,70,239,.9))"
                      : "linear-gradient(90deg, rgba(59,130,246,.85), rgba(168,85,247,.85))",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
