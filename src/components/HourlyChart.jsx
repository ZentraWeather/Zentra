import React, { useMemo, useState } from "react";

function safeNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function labels(language, t) {
  const fallback = {
    fr: { title: "Graphique 48h", temp: "Température", rain: "Prob. pluie" },
    nl: { title: "Grafiek 48u", temp: "Temperatuur", rain: "Regenkans" },
    de: { title: "48h-Grafik", temp: "Temperatur", rain: "Regenwahrsch." },
    en: { title: "48h chart", temp: "Temperature", rain: "Rain chance" },
  };
  const f = fallback[language] || fallback.fr;
  return {
    title: t?.hourlyChartTitle || f.title,
    temp: t?.temperatureLabel || f.temp,
    rain: t?.rainChanceLabel || f.rain,
  };
}

export default function HourlyChart({ hourly, language, t, darkMode, theme }) {
  const L = labels(language, t);
  const [hoverIdx, setHoverIdx] = useState(null);

  const data = useMemo(() => {
    const n = Math.min(48, (hourly?.time || []).length);
    const points = Array.from({ length: n }).map((_, i) => {
      const ts = hourly.time[i];
      const d = new Date(ts);
      return {
        i,
        ts,
        hour: d.getHours(),
        temp: safeNum(hourly?.temperature_2m?.[i], 0),
        prob: safeNum(hourly?.precipitation_probability?.[i], 0),
      };
    });

    const temps = points.map((p) => p.temp);
    const tMin = temps.length ? Math.min(...temps) : 0;
    const tMax = temps.length ? Math.max(...temps) : 1;

    return { points, tMin, tMax };
  }, [hourly]);

  const W = 760;
  const H = 220;
  const pad = 24;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;

  const scaleX = (i) => pad + (innerW * i) / Math.max(1, data.points.length - 1);
  const scaleY = (temp) => {
    const denom = Math.max(1e-6, data.tMax - data.tMin);
    return pad + ((data.tMax - temp) / denom) * innerH;
  };

  const poly = data.points
    .map((p) => `${scaleX(p.i).toFixed(2)},${scaleY(p.temp).toFixed(2)}`)
    .join(" ");

  const area = `${pad},${H - pad} ${poly} ${pad + innerW},${H - pad}`;

  const hover = hoverIdx == null ? null : data.points[hoverIdx];

  return (
    <div className={`rounded-2xl p-4 sm:p-8 mb-6 ${theme.card}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className={`text-xl sm:text-2xl font-extrabold ${theme.text}`}>{L.title}</div>
        <div className="flex items-center gap-3 text-xs font-extrabold">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${theme.btnGhost}`}>
            <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
            {L.temp}
          </span>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${theme.btnGhost}`}>
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            {L.rain}
          </span>
        </div>
      </div>

      <div className="relative">
        {hover && (
          <div
            className={`absolute -top-2 right-0 rounded-2xl px-3 py-2 text-xs font-extrabold border ${
              darkMode ? "bg-black/40 border-white/10 text-white" : "bg-white/80 border-slate-200 text-slate-900"
            } backdrop-blur-xl`}
          >
            <div className="flex gap-2 items-center justify-end">
              <span className="text-fuchsia-500">{Math.round(hover.temp)}°C</span>
              <span className={`${theme.muted2}`}>·</span>
              <span className="text-sky-500">{Math.round(hover.prob)}%</span>
              <span className={`${theme.muted2}`}>·</span>
              <span className={`${theme.muted2}`}>{hover.hour}h</span>
            </div>
          </div>
        )}

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[220px]">
          <defs>
            <linearGradient id="tempArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(217,70,239,0.30)" />
              <stop offset="100%" stopColor="rgba(217,70,239,0.02)" />
            </linearGradient>
            <linearGradient id="grid" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={darkMode ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)"} />
              <stop offset="100%" stopColor={darkMode ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)"} />
            </linearGradient>
          </defs>

          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((k) => {
            const y = pad + innerH * k;
            return <line key={k} x1={pad} x2={W - pad} y1={y} y2={y} stroke="url(#grid)" strokeWidth="1" />;
          })}

          {/* Rain bars (every 2 hours) */}
          {data.points.map((p) => {
            if (p.i % 2 !== 0) return null;
            const x = scaleX(p.i);
            const barW = innerW / Math.max(1, data.points.length - 1);
            const h = (clamp(p.prob, 0, 100) / 100) * innerH;
            const y = H - pad - h;
            return (
              <rect
                key={`b-${p.i}`}
                x={x - barW * 0.35}
                y={y}
                width={barW * 0.7}
                height={h}
                rx="6"
                fill={darkMode ? "rgba(14,165,233,0.22)" : "rgba(14,165,233,0.18)"}
              />
            );
          })}

          {/* Temp area + line */}
          <polygon points={area} fill="url(#tempArea)" />
          <polyline points={poly} fill="none" stroke="rgba(217,70,239,0.95)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

          {/* Points hitboxes */}
          {data.points.map((p) => {
            const cx = scaleX(p.i);
            const cy = scaleY(p.temp);
            return (
              <circle
                key={`pt-${p.i}`}
                cx={cx}
                cy={cy}
                r="10"
                fill="transparent"
                onMouseEnter={() => setHoverIdx(p.i)}
                onMouseLeave={() => setHoverIdx(null)}
              />
            );
          })}

          {/* X labels every 6 hours */}
          {data.points.map((p) => {
            if (p.i % 6 !== 0) return null;
            const x = scaleX(p.i);
            return (
              <text key={`x-${p.i}`} x={x} y={H - 6} textAnchor="middle" fontSize="11" fill={darkMode ? "rgba(226,232,240,0.65)" : "rgba(71,85,105,0.75)"}>
                {p.hour}h
              </text>
            );
          })}

          {/* min/max labels */}
          <text x={pad} y={14} fontSize="11" fill={darkMode ? "rgba(226,232,240,0.65)" : "rgba(71,85,105,0.75)"}>{Math.round(data.tMax)}°</text>
          <text x={pad} y={H - 12} fontSize="11" fill={darkMode ? "rgba(226,232,240,0.65)" : "rgba(71,85,105,0.75)"}>{Math.round(data.tMin)}°</text>
        </svg>
      </div>
    </div>
  );
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
