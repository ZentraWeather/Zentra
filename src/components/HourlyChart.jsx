import React, { useMemo } from "react";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fmtHourLabel(dateObj) {
  const h = dateObj.getHours();
  return `${h}h`;
}

export default function HourlyChart({ hourly, t, darkMode }) {
  const data = useMemo(() => {
    const times = (hourly?.time || []).slice(0, 48);
    const temps = (hourly?.temperature_2m || []).slice(0, 48).map((x) => Number(x));
    const prec = (hourly?.precipitation || []).slice(0, 48).map((x) => Number(x));
    const pp = (hourly?.precipitation_probability || []).slice(0, 48).map((x) => Number(x));

    const rows = times.map((time, i) => {
      const d = new Date(time);
      return {
        time,
        d,
        temp: Number.isFinite(temps[i]) ? temps[i] : 0,
        precip: Number.isFinite(prec[i]) ? prec[i] : 0,
        pp: Number.isFinite(pp[i]) ? pp[i] : 0,
      };
    });

    const minT = Math.min(...rows.map((r) => r.temp));
    const maxT = Math.max(...rows.map((r) => r.temp));
    const maxP = Math.max(0.5, ...rows.map((r) => r.precip)); // évite division par 0

    return { rows, minT, maxT, maxP };
  }, [hourly]);

  if (!data.rows.length) return null;

  // Taille SVG (scrollable sur mobile)
  const W = 980;
  const H = 170;
  const PAD_L = 44;
  const PAD_R = 18;
  const PAD_T = 20;
  const PAD_B = 36;

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const xFor = (i) => PAD_L + (i * innerW) / Math.max(1, data.rows.length - 1);

  // échelle temp
  const tMin = Math.floor(data.minT - 1);
  const tMax = Math.ceil(data.maxT + 1);
  const yTemp = (temp) => {
    const k = (temp - tMin) / Math.max(1e-6, (tMax - tMin));
    return PAD_T + (1 - k) * innerH;
  };

  // échelle pluie (barres bas)
  const barBaseY = PAD_T + innerH;
  const barMaxH = 52;
  const barH = (p) => (clamp(p / data.maxP, 0, 1) * barMaxH);

  const path = data.rows
    .map((r, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yTemp(r.temp).toFixed(2)}`)
    .join(" ");

  const gridLines = [0.25, 0.5, 0.75].map((k) => PAD_T + k * innerH);

  return (
    <div className={`rounded-2xl border p-4 mb-5 ${darkMode ? "border-white/10 bg-white/4" : "border-slate-200 bg-white/60"} backdrop-blur-xl`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className={`text-sm font-extrabold ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
          {t?.hourlyChartTitle || "Graphique 48h"}
        </div>
        <div className={`text-xs font-bold ${darkMode ? "text-slate-300/80" : "text-slate-500"}`}>
          {t?.hourlyChartHint || "Température (ligne) + pluie (barres)"}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width={W} height={H} className="block">
          {/* fond */}
          <rect x="0" y="0" width={W} height={H} rx="18" ry="18" fill="transparent" />

          {/* grille */}
          {gridLines.map((y, idx) => (
            <line
              key={idx}
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
              stroke={darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}
              strokeWidth="1"
            />
          ))}

          {/* barres pluie */}
          {data.rows.map((r, i) => {
            const x = xFor(i);
            const w = innerW / Math.max(1, data.rows.length - 1);
            const bw = clamp(w * 0.62, 6, 14);
            const h = barH(r.precip);
            return (
              <g key={r.time}>
                <rect
                  x={x - bw / 2}
                  y={barBaseY - h}
                  width={bw}
                  height={h}
                  rx="3"
                  fill={darkMode ? "rgba(56,189,248,0.35)" : "rgba(56,189,248,0.35)"}
                />
              </g>
            );
          })}

          {/* ligne température */}
          <path d={path} fill="none" stroke={darkMode ? "rgba(217,70,239,0.95)" : "rgba(124,58,237,0.95)"} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

          {/* points */}
          {data.rows.map((r, i) => (
            <circle
              key={r.time}
              cx={xFor(i)}
              cy={yTemp(r.temp)}
              r="3.2"
              fill={darkMode ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.9)"}
              stroke={darkMode ? "rgba(217,70,239,0.9)" : "rgba(124,58,237,0.9)"}
              strokeWidth="2"
            />
          ))}

          {/* labels Y temp */}
          <text x={10} y={PAD_T + 6} fontSize="11" fill={darkMode ? "rgba(226,232,240,0.75)" : "rgba(71,85,105,0.85)"} fontWeight="700">
            {tMax}°
          </text>
          <text x={10} y={PAD_T + innerH} fontSize="11" fill={darkMode ? "rgba(226,232,240,0.75)" : "rgba(71,85,105,0.85)"} fontWeight="700">
            {tMin}°
          </text>

          {/* labels X toutes les 6h */}
          {data.rows.map((r, i) => {
            if (i % 6 !== 0) return null;
            const x = xFor(i);
            const label = i === 0 ? (t?.now || "Maintenant") : fmtHourLabel(r.d);
            return (
              <text
                key={`x-${r.time}`}
                x={x}
                y={H - 12}
                textAnchor="middle"
                fontSize="11"
                fill={darkMode ? "rgba(226,232,240,0.75)" : "rgba(71,85,105,0.85)"}
                fontWeight="800"
              >
                {label}
              </text>
            );
          })}

          {/* légende pluie */}
          <text
            x={W - 16}
            y={PAD_T + innerH + 16}
            textAnchor="end"
            fontSize="11"
            fill={darkMode ? "rgba(226,232,240,0.70)" : "rgba(71,85,105,0.75)"}
            fontWeight="700"
          >
            {t?.rainMm || "Pluie (mm)"}
          </text>
        </svg>
      </div>

      {/* petite ligne “lecture” */}
      <div className={`mt-3 text-xs ${darkMode ? "text-slate-300/80" : "text-slate-600"}`}>
        {t?.hourlyChartNote || "Astuce : sur mobile, fais glisser horizontalement."}
      </div>
    </div>
  );
}
