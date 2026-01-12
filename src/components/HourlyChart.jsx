import React, { useMemo, useState } from "react";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fmtHourLabel(dateObj) {
  const h = dateObj.getHours();
  return `${h}h`;
}

export default function HourlyChart({ hourly, t, darkMode }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  const data = useMemo(() => {
    const times = (hourly?.time || []).slice(0, 48);
    const temps = (hourly?.temperature_2m || []).slice(0, 48).map((x) => Number(x));
    const prec = (hourly?.precipitation || []).slice(0, 48).map((x) => Number(x));
    const pp = (hourly?.precipitation_probability || []).slice(0, 48).map((x) => Number(x));
    const wc = (hourly?.weather_code || []).slice(0, 48);

    const rows = times.map((time, i) => {
      const d = new Date(time);
      return {
        time,
        d,
        temp: Number.isFinite(temps[i]) ? temps[i] : 0,
        precip: Number.isFinite(prec[i]) ? prec[i] : 0,
        pp: Number.isFinite(pp[i]) ? pp[i] : 0,
        wc: wc[i] || 3,
      };
    });

    const minT = Math.min(...rows.map((r) => r.temp));
    const maxT = Math.max(...rows.map((r) => r.temp));
    const maxP = Math.max(0.5, ...rows.map((r) => r.precip));

    // Détecter les zones de pluie
    const rainZones = [];
    let startZone = null;
    for (let i = 0; i < rows.length; i++) {
      const isRainy = rows[i].pp >= 40 || rows[i].precip > 0.1;
      if (isRainy && startZone === null) {
        startZone = i;
      }
      if (!isRainy && startZone !== null) {
        rainZones.push({ start: startZone, end: i });
        startZone = null;
      }
    }
    if (startZone !== null) {
      rainZones.push({ start: startZone, end: rows.length });
    }

    return { rows, minT, maxT, maxP, rainZones };
  }, [hourly]);

  // Narrative summary
  const narrative = useMemo(() => {
    if (!data.rows.length) return "";
    
    const now = data.rows[0];
    const peak = data.rows.reduce((max, r) => r.temp > max.temp ? r : max, now);
    const lowest = data.rows.reduce((min, r) => r.temp < min.temp ? r : min, now);
    const maxRainProb = Math.max(...data.rows.map(r => r.pp));
    const rainPeriod = data.rainZones[0];

    let text = `🌡️ Température en `;
    if (peak.temp > now.temp) {
      text += `hausse progressive de ${Math.round(now.temp)}°C (maintenant) à ${Math.round(peak.temp)}°C vers ${fmtHourLabel(peak.d)}.`;
    } else if (lowest.temp < now.temp) {
      text += `baisse progressive de ${Math.round(now.temp)}°C (maintenant) à ${Math.round(lowest.temp)}°C vers ${fmtHourLabel(lowest.d)}.`;
    } else {
      text += `relativement stable autour de ${Math.round(now.temp)}°C.`;
    }

    if (maxRainProb >= 50) {
      if (rainPeriod) {
        text += ` ☔ Risques de précipitations entre ${fmtHourLabel(data.rows[rainPeriod.start].d)} et ${fmtHourLabel(data.rows[rainPeriod.end - 1].d)} (pic à ${Math.round(maxRainProb)}%).`;
      } else {
        text += ` ☔ Quelques précipitations possibles (jusqu'à ${Math.round(maxRainProb)}%).`;
      }
    } else {
      text += ` ☀️ Risque de pluie faible (max ${Math.round(maxRainProb)}%).`;
    }

    return text;
  }, [data]);

  if (!data.rows.length) return null;

  const W = 980;
  const H = 200;
  const PAD_L = 44;
  const PAD_R = 18;
  const PAD_T = 30;
  const PAD_B = 36;

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const xFor = (i) => PAD_L + (i * innerW) / Math.max(1, data.rows.length - 1);

  const tMin = Math.floor(data.minT - 1);
  const tMax = Math.ceil(data.maxT + 1);
  const yTemp = (temp) => {
    const k = (temp - tMin) / Math.max(1e-6, (tMax - tMin));
    return PAD_T + (1 - k) * innerH;
  };

  const barBaseY = PAD_T + innerH;
  const barMaxH = 52;
  const barH = (p) => (clamp(p / data.maxP, 0, 1) * barMaxH);

  const path = data.rows
    .map((r, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yTemp(r.temp).toFixed(2)}`)
    .join(" ");

  const gridLines = [0.25, 0.5, 0.75].map((k) => PAD_T + k * innerH);

  const getWeatherDesc = (code) => {
    const desc = {
      0: "Dégagé", 1: "Dégagé", 2: "Nuageux", 3: "Couvert",
      61: "Pluie légère", 63: "Pluie modérée", 65: "Pluie forte",
      71: "Neige légère", 95: "Orage"
    };
    return desc[code] || "Variable";
  };

  const handleScroll = (e) => {
    const scrollPercentage = (e.target.scrollLeft / (e.target.scrollWidth - e.target.clientWidth)) * 100;
    setScrollPosition(Math.round(scrollPercentage));
  };

  return (
    <div className={`rounded-2xl border p-4 mb-5 ${darkMode ? "border-white/10 bg-white/4" : "border-slate-200 bg-white/60"} backdrop-blur-xl`}>
      {/* Narrative Summary */}
      <div className={`mb-4 p-4 rounded-xl ${darkMode ? "bg-indigo-900/20 border border-indigo-500/20" : "bg-indigo-50 border border-indigo-100"}`}>
        <p className={`text-sm font-semibold leading-relaxed ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
          {narrative}
        </p>
      </div>

      {/* Header with improved legend */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className={`text-sm font-extrabold ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
          {t?.hourlyChartTitle || "Graphique 48h"}
        </div>
        
        {/* Visual Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-0.5 rounded-full ${darkMode ? "bg-gradient-to-r from-purple-400 to-pink-400" : "bg-gradient-to-r from-purple-600 to-indigo-600"}`}></div>
            <span className={darkMode ? "text-slate-300" : "text-slate-600"}>Température</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-6 bg-sky-400/40 rounded"></div>
            <span className={darkMode ? "text-slate-300" : "text-slate-600"}>Pluie</span>
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className={`font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
          Position: {scrollPosition}%
        </span>
        <span className={`font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
          ← Glisser pour voir toutes les heures →
        </span>
      </div>

      <div className="overflow-x-auto" onScroll={handleScroll}>
        <svg 
          width={W} 
          height={H} 
          className="block"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <rect x="0" y="0" width={W} height={H} rx="18" ry="18" fill="transparent" />

          {/* Rain zones (background) */}
          {data.rainZones.map((zone, idx) => {
            const x1 = xFor(zone.start);
            const x2 = xFor(zone.end - 1);
            return (
              <rect
                key={`zone-${idx}`}
                x={x1}
                y={PAD_T}
                width={x2 - x1}
                height={innerH}
                fill={darkMode ? "rgba(56,189,248,0.08)" : "rgba(56,189,248,0.1)"}
                rx="8"
              />
            );
          })}

          {/* Grid lines */}
          {gridLines.map((y, idx) => (
            <line
              key={idx}
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
              stroke={darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}

          {/* "Now" vertical line */}
          <line
            x1={xFor(0)}
            y1={PAD_T}
            x2={xFor(0)}
            y2={PAD_T + innerH}
            stroke={darkMode ? "rgba(168,85,247,0.5)" : "rgba(124,58,237,0.5)"}
            strokeWidth="2"
            strokeDasharray="6 3"
          />

          {/* Rain bars */}
          {data.rows.map((r, i) => {
            const x = xFor(i);
            const w = innerW / Math.max(1, data.rows.length - 1);
            const bw = clamp(w * 0.62, 6, 14);
            const h = barH(r.precip);
            return (
              <rect
                key={`bar-${r.time}`}
                x={x - bw / 2}
                y={barBaseY - h}
                width={bw}
                height={h}
                rx="3"
                fill={darkMode ? "rgba(56,189,248,0.35)" : "rgba(56,189,248,0.4)"}
              />
            );
          })}

          {/* Temperature gradient area (under the line) */}
          <defs>
            <linearGradient id="tempGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={darkMode ? "rgba(217,70,239,0.3)" : "rgba(124,58,237,0.2)"} />
              <stop offset="100%" stopColor={darkMode ? "rgba(217,70,239,0.02)" : "rgba(124,58,237,0.02)"} />
            </linearGradient>
          </defs>
          <path
            d={`${path} L ${xFor(data.rows.length - 1)} ${barBaseY} L ${xFor(0)} ${barBaseY} Z`}
            fill="url(#tempGradient)"
          />

          {/* Temperature line */}
          <path 
            d={path} 
            fill="none" 
            stroke={darkMode ? "rgba(217,70,239,0.95)" : "rgba(124,58,237,0.95)"} 
            strokeWidth="3" 
            strokeLinejoin="round" 
            strokeLinecap="round"
            filter={darkMode ? "drop-shadow(0 2px 8px rgba(217,70,239,0.4))" : "drop-shadow(0 2px 8px rgba(124,58,237,0.3))"}
          />

          {/* Temperature points with hover effect */}
          {data.rows.map((r, i) => {
            const isHovered = hoveredIndex === i;
            const isNow = i === 0;
            return (
              <g key={`point-${r.time}`}>
                {/* Hover area (invisible) */}
                <rect
                  x={xFor(i) - 15}
                  y={PAD_T}
                  width={30}
                  height={innerH}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredIndex(i)}
                />
                
                {/* Point */}
                <circle
                  cx={xFor(i)}
                  cy={yTemp(r.temp)}
                  r={isHovered ? 5 : isNow ? 4 : 3.2}
                  fill={darkMode ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.95)"}
                  stroke={darkMode ? "rgba(217,70,239,0.9)" : "rgba(124,58,237,0.9)"}
                  strokeWidth={isHovered ? 3 : 2}
                  style={{ transition: "all 0.2s" }}
                />
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hoveredIndex !== null && (
            <g>
              <rect
                x={xFor(hoveredIndex) - 60}
                y={yTemp(data.rows[hoveredIndex].temp) - 70}
                width="120"
                height="60"
                rx="8"
                fill={darkMode ? "rgba(30,41,59,0.95)" : "rgba(255,255,255,0.95)"}
                stroke={darkMode ? "rgba(255,255,255,0.2)" : "rgba(15,23,42,0.2)"}
                strokeWidth="1"
                filter="drop-shadow(0 4px 12px rgba(0,0,0,0.15))"
              />
              <text
                x={xFor(hoveredIndex)}
                y={yTemp(data.rows[hoveredIndex].temp) - 52}
                textAnchor="middle"
                fontSize="11"
                fontWeight="800"
                fill={darkMode ? "rgba(226,232,240,0.95)" : "rgba(15,23,42,0.9)"}
              >
                {fmtHourLabel(data.rows[hoveredIndex].d)}
              </text>
              <text
                x={xFor(hoveredIndex)}
                y={yTemp(data.rows[hoveredIndex].temp) - 38}
                textAnchor="middle"
                fontSize="13"
                fontWeight="900"
                fill={darkMode ? "#a855f7" : "#7c3aed"}
              >
                {Math.round(data.rows[hoveredIndex].temp)}°C
              </text>
              <text
                x={xFor(hoveredIndex)}
                y={yTemp(data.rows[hoveredIndex].temp) - 24}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#38bdf8"
              >
                ☔ {Math.round(data.rows[hoveredIndex].pp)}%
              </text>
              <text
                x={xFor(hoveredIndex)}
                y={yTemp(data.rows[hoveredIndex].temp) - 12}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fill={darkMode ? "rgba(226,232,240,0.7)" : "rgba(71,85,105,0.8)"}
              >
                {getWeatherDesc(data.rows[hoveredIndex].wc)}
              </text>
            </g>
          )}

          {/* Y-axis labels */}
          <text x={10} y={PAD_T + 6} fontSize="11" fill={darkMode ? "rgba(226,232,240,0.75)" : "rgba(71,85,105,0.85)"} fontWeight="700">
            {tMax}°
          </text>
          <text x={10} y={PAD_T + innerH} fontSize="11" fill={darkMode ? "rgba(226,232,240,0.75)" : "rgba(71,85,105,0.85)"} fontWeight="700">
            {tMin}°
          </text>

          {/* X-axis labels */}
          {data.rows.map((r, i) => {
            if (i % 6 !== 0 && i !== 0) return null;
            const x = xFor(i);
            const label = i === 0 ? (t?.now || "Maintenant") : fmtHourLabel(r.d);
            return (
              <text
                key={`x-${r.time}`}
                x={x}
                y={H - 12}
                textAnchor="middle"
                fontSize="11"
                fill={i === 0 
                  ? (darkMode ? "rgba(168,85,247,0.9)" : "rgba(124,58,237,0.9)")
                  : (darkMode ? "rgba(226,232,240,0.75)" : "rgba(71,85,105,0.85)")
                }
                fontWeight="800"
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Footer note */}
      <div className={`mt-3 text-xs ${darkMode ? "text-slate-300/80" : "text-slate-600"}`}>
        💡 {t?.hourlyChartNote || "Survole le graphique pour voir les détails. Sur mobile, fais glisser horizontalement."}
      </div>
    </div>
  );
}