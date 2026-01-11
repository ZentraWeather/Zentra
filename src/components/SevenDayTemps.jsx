import React from "react";
import { Droplets } from "lucide-react";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default function SevenDayTemps({ daily, language, t, darkMode, theme, getWeatherIcon }) {
  const dayNames = {
    fr: ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."],
    nl: ["zo", "ma", "di", "wo", "do", "vr", "za"],
    de: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
    en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  };

  const getDayName = (dateStr, index) => {
    if (index === 0) return t.today;
    if (index === 1) return t.tomorrow;
    const d = new Date(dateStr);
    const arr = dayNames[language] || dayNames.fr;
    return arr[d.getDay()];
  };

  // Scale dynamique (plus fiable qu’un tempRange fixe)
  const mins = (daily?.temperature_2m_min || []).slice(0, 7).map(Number).filter(Number.isFinite);
  const maxs = (daily?.temperature_2m_max || []).slice(0, 7).map(Number).filter(Number.isFinite);

  const minAll = mins.length ? Math.min(...mins) : 0;
  const maxAll = maxs.length ? Math.max(...maxs) : 10;

  const pad = 3; // petite marge visuelle
  const lo = Math.floor(minAll - pad);
  const hi = Math.ceil(maxAll + pad);
  const range = Math.max(1, hi - lo);

  return (
    <div className={`rounded-2xl border shadow-xl p-4 sm:p-8 mb-6 ${theme.card}`}>
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <span className="text-2xl">🌡️</span>
        <h3 className={`text-xl sm:text-2xl font-extrabold ${theme.text}`}>{t.temperatures7days}</h3>
      </div>

      <div className="space-y-4">
        {(daily?.time || []).slice(0, 7).map((date, index) => {
          const dayName = getDayName(date, index);
          const maxTemp = Math.round((daily.temperature_2m_max || [])[index] ?? 0);
          const minTemp = Math.round((daily.temperature_2m_min || [])[index] ?? 0);

          const minOffset = ((minTemp - lo) / range) * 100;
          const maxOffset = ((maxTemp - lo) / range) * 100;

          const left = clamp(minOffset, 0, 100);
          const right = clamp(maxOffset, 0, 100);
          const width = clamp(right - left, 2, 100);

          const rainProb = Math.round((daily.precipitation_probability_max || [])[index] ?? 0);
          const wcode = (daily.weather_code || [])[index] ?? 3;

          return (
            <div key={date} className="flex items-center gap-3 sm:gap-4">
              <div className={`w-20 sm:w-24 font-semibold capitalize text-sm sm:text-base flex-shrink-0 ${theme.text}`}>
                {dayName}
              </div>

              <div className="scale-75 sm:scale-90 flex-shrink-0">
                {getWeatherIcon(wcode, "w-10 h-10")}
              </div>

              <div className="flex-1 relative h-10 flex items-center">
                <div className={`absolute inset-0 rounded-full ${darkMode ? "bg-slate-800/60" : "bg-slate-100"}`} />

                <div
                  className="absolute h-8 bg-gradient-to-r from-sky-400 via-amber-400 to-rose-400 rounded-full flex items-center justify-between px-2 transition-all"
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${minTemp}° → ${maxTemp}°`}
                >
                  <span className="text-xs font-extrabold text-white drop-shadow">{minTemp}°</span>
                  <span className="text-xs font-extrabold text-white drop-shadow">{maxTemp}°</span>
                </div>
              </div>

              <div className="text-xs text-sky-500 font-bold flex items-center gap-1 w-12 sm:w-14 flex-shrink-0 justify-end">
                <Droplets className="w-3 h-3" />
                <span>{rainProb}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`mt-6 flex items-center justify-center gap-4 text-xs ${theme.muted2}`}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-sky-400 rounded-full"></div>
          <span>{t.cold}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-400 rounded-full"></div>
          <span>{t.mild}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-rose-400 rounded-full"></div>
          <span>{t.hot}</span>
        </div>
      </div>
    </div>
  );
}
