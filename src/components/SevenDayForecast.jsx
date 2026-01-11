import React from "react";
import { Droplets } from "lucide-react";

export default function SevenDayForecast({
  daily,
  language,
  t,
  darkMode,
  theme,
  getWeatherIcon,
  getWeatherDescription,
}) {
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

  return (
    <div className={`rounded-2xl border shadow-xl p-4 sm:p-8 ${theme.card}`}>
      <h3 className={`text-xl sm:text-2xl font-extrabold mb-4 sm:mb-6 ${theme.text}`}>
        {t.forecast7days}
      </h3>

      <div className="space-y-2 sm:space-y-3">
        {(daily?.time || []).slice(0, 7).map((date, index) => {
          const dayName = getDayName(date, index);

          const wcode = (daily.weather_code || [])[index] ?? 3;
          const rainProb = Math.round((daily.precipitation_probability_max || [])[index] ?? 0);

          const tmax = Math.round((daily.temperature_2m_max || [])[index] ?? 0);
          const tmin = Math.round((daily.temperature_2m_min || [])[index] ?? 0);

          return (
            <div
              key={date}
              className={`flex items-center justify-between p-3 sm:p-4 rounded-xl transition ${
                darkMode ? "bg-slate-900/40 hover:bg-slate-900/60" : "bg-slate-50 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <div className={`w-20 sm:w-28 font-semibold capitalize text-sm sm:text-base flex-shrink-0 ${theme.text}`}>
                  {dayName}
                </div>

                <div className="scale-75 sm:scale-90 flex-shrink-0">
                  {getWeatherIcon(wcode, "w-10 h-10")}
                </div>

                <div className={`text-xs sm:text-sm flex-1 min-w-0 truncate ${theme.muted}`}>
                  {getWeatherDescription(wcode)}
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
                <div className="text-xs sm:text-sm text-sky-500 font-bold flex items-center gap-1">
                  <Droplets className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{rainProb}%</span>
                </div>

                <div className="text-right min-w-[54px] sm:min-w-[64px]">
                  <div className={`text-lg sm:text-xl font-extrabold ${theme.text}`}>{tmax}°</div>
                  <div className={`text-xs sm:text-sm ${theme.muted2}`}>{tmin}°</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
