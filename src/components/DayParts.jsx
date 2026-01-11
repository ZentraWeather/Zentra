import React, { useMemo } from "react";

function mode(arr) {
  if (!arr?.length) return null;
  const m = new Map();
  for (const v of arr) m.set(v, (m.get(v) || 0) + 1);
  let best = arr[0], bestC = 0;
  for (const [k, c] of m.entries()) {
    if (c > bestC) { best = k; bestC = c; }
  }
  return best;
}

function labels(language, t) {
  const fallback = {
    fr: { title: "Résumé de la journée", sub: "Matin · Après-midi · Soir", morning: "Matin", afternoon: "Après-midi", evening: "Soir", next: "Prochaines 24h", rain: "Pluie", wind: "Vent" },
    nl: { title: "Dagoverzicht", sub: "Ochtend · Namiddag · Avond", morning: "Ochtend", afternoon: "Namiddag", evening: "Avond", next: "Volgende 24u", rain: "Regen", wind: "Wind" },
    de: { title: "Tagesüberblick", sub: "Morgen · Nachmittag · Abend", morning: "Morgen", afternoon: "Nachmittag", evening: "Abend", next: "Nächste 24h", rain: "Regen", wind: "Wind" },
    en: { title: "Day summary", sub: "Morning · Afternoon · Evening", morning: "Morning", afternoon: "Afternoon", evening: "Evening", next: "Next 24h", rain: "Rain", wind: "Wind" },
  };

  const f = fallback[language] || fallback.fr;
  return {
    title: t?.daypartsTitle || f.title,
    sub: t?.daypartsSub || f.sub,
    morning: t?.morning || f.morning,
    afternoon: t?.afternoon || f.afternoon,
    evening: t?.evening || f.evening,
    next: t?.next24h || f.next,
    rain: t?.rain || f.rain,
    wind: t?.windLabel || f.wind,
  };
}

export default function DayParts({ hourly, language, t, darkMode, theme, getWeatherIcon }) {
  const L = labels(language, t);

  const parts = useMemo(() => {
    const times = (hourly?.time || []).slice(0, 48);
    const temp = (hourly?.temperature_2m || []).slice(0, 48);
    const prob = (hourly?.precipitation_probability || []).slice(0, 48);
    const wind = (hourly?.wind_speed_10m || []).slice(0, 48);
    const code = (hourly?.weather_code || []).slice(0, 48);

    const rows = times.map((ts, i) => {
      const d = new Date(ts);
      const h = d.getHours();
      return {
        h,
        t: Number(temp[i] ?? 0),
        p: Number(prob[i] ?? 0),
        w: Number(wind[i] ?? 0),
        c: Number(code[i] ?? 3),
      };
    });

    const buckets = [
      { key: "morning", label: L.morning, from: 6, to: 12 },
      { key: "afternoon", label: L.afternoon, from: 12, to: 18 },
      { key: "evening", label: L.evening, from: 18, to: 24 },
    ];

    return buckets.map((b) => {
      const r = rows.filter((x) => x.h >= b.from && x.h < b.to);
      const temps = r.map((x) => x.t);
      const probs = r.map((x) => x.p);
      const winds = r.map((x) => x.w);
      const codes = r.map((x) => x.c);

      const avg = temps.length ? temps.reduce((a, v) => a + v, 0) / temps.length : null;
      const tmin = temps.length ? Math.min(...temps) : null;
      const tmax = temps.length ? Math.max(...temps) : null;

      return {
        ...b,
        tAvg: avg,
        tMin: tmin,
        tMax: tmax,
        pMax: probs.length ? Math.max(...probs) : 0,
        wMax: winds.length ? Math.max(...winds) : 0,
        wCode: mode(codes) ?? 3,
      };
    });
  }, [hourly, L.morning, L.afternoon, L.evening]);

  return (
    <div className={`rounded-2xl p-4 sm:p-8 mb-6 ${theme.card}`}>
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <div className={`text-xl sm:text-2xl font-extrabold ${theme.text}`}>{L.title}</div>
          <div className={`text-sm ${theme.muted2}`}>{L.sub}</div>
        </div>
        <span className={`text-xs font-extrabold rounded-full px-3 py-1.5 ${theme.btnGhost}`}>
          {L.next}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {parts.map((p) => (
          <div
            key={p.key}
            className={`rounded-2xl p-4 border ${darkMode ? "border-white/10 bg-white/5" : "border-slate-100 bg-slate-50"} transition`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-sm font-extrabold ${theme.muted2}`}>{p.label}</div>
                <div className={`text-2xl font-extrabold ${theme.text}`}>
                  {p.tAvg === null ? "—" : `${Math.round(p.tAvg)}°`}
                  <span className={`ml-2 text-sm font-bold ${theme.muted2}`}>
                    {p.tMin === null ? "" : `${Math.round(p.tMin)}° / ${Math.round(p.tMax)}°`}
                  </span>
                </div>
              </div>
              <div className="shrink-0">{getWeatherIcon(p.wCode, "w-12 h-12")}</div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-extrabold">
              <div className={`${theme.muted2}`}>{L.rain}</div>
              <div className="text-sky-500">{Math.round(p.pMax)}%</div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-extrabold">
              <div className={`${theme.muted2}`}>{L.wind}</div>
              <div className="text-emerald-500">{Math.round(p.wMax)} km/h</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
