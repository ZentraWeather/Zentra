import { getT } from "./lang";
import SevenDayTemps from "./components/SevenDayTemps";
import SevenDayForecast from "./components/SevenDayForecast";
import DayParts from "./components/DayParts";
import HourlyChart from "./components/HourlyChart";
import { buildAiNarrative } from "./utils/aiNarrative";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Cloud,
  MapPin,
  Droplets,
  Wind,
  Sun,
  Loader2,
  Navigation,
  CloudRain,
  CloudSnow,
  Zap,
  Globe,
  Moon,
  LocateFixed,
  AlertTriangle,
  RefreshCcw,
} from "lucide-react";

const BELGIAN_CITIES = [
  { name: { fr: "Bruxelles", nl: "Brussel", de: "Brüssel", en: "Brussels" }, lat: 50.8503, lon: 4.3517 },
  { name: { fr: "Anvers", nl: "Antwerpen", de: "Antwerpen", en: "Antwerp" }, lat: 51.2194, lon: 4.4025 },
  { name: { fr: "Liège", nl: "Luik", de: "Lüttich", en: "Liège" }, lat: 50.6326, lon: 5.5797 },
  { name: { fr: "Gand", nl: "Gent", de: "Gent", en: "Ghent" }, lat: 51.0543, lon: 3.7174 },
  { name: { fr: "Charleroi", nl: "Charleroi", de: "Charleroi", en: "Charleroi" }, lat: 50.4108, lon: 4.4446 },
  { name: { fr: "Bruges", nl: "Brugge", de: "Brügge", en: "Bruges" }, lat: 51.2093, lon: 3.2247 },
  { name: { fr: "Namur", nl: "Namen", de: "Namur", en: "Namur" }, lat: 50.4674, lon: 4.872 },
  { name: { fr: "Louvain", nl: "Leuven", de: "Löwen", en: "Leuven" }, lat: 50.8798, lon: 4.7005 },
];

function detectLang() {
  const browserLang = (navigator?.language || "fr").toLowerCase();
  if (browserLang.startsWith("nl")) return "nl";
  if (browserLang.startsWith("de")) return "de";
  if (browserLang.startsWith("en")) return "en";
  return "fr";
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fmt(n, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

function getWeatherIcon(code, className = "w-12 h-12") {
  if (code === 0) return <Sun className={`${className} text-yellow-500`} />;
  if (code <= 3) return <Cloud className={`${className} text-slate-400`} />;
  if (code >= 61 && code <= 67) return <CloudRain className={`${className} text-blue-500`} />;
  if (code >= 71 && code <= 77) return <CloudSnow className={`${className} text-sky-400`} />;
  if (code >= 95) return <Zap className={`${className} text-yellow-500`} />;
  return <Cloud className={`${className} text-slate-400`} />;
}

function getWeatherDescription(language, code) {
  const descriptions = {
    fr: { 0: "Ciel dégagé", 1: "Principalement dégagé", 2: "Partiellement nuageux", 3: "Couvert", 45: "Brouillard", 48: "Brouillard givrant", 51: "Bruine légère", 61: "Pluie légère", 63: "Pluie modérée", 65: "Pluie forte", 71: "Neige légère", 80: "Averses", 95: "Orage" },
    nl: { 0: "Helder", 1: "Grotendeels helder", 2: "Gedeeltelijk bewolkt", 3: "Bewolkt", 45: "Mist", 48: "IJzelmist", 51: "Lichte motregen", 61: "Lichte regen", 63: "Matige regen", 65: "Zware regen", 71: "Lichte sneeuw", 80: "Buien", 95: "Onweer" },
    de: { 0: "Klar", 1: "Überwiegend klar", 2: "Teilweise bewölkt", 3: "Bewölkt", 45: "Nebel", 48: "Gefrierender Nebel", 51: "Leichter Nieselregen", 61: "Leichter Regen", 63: "Mäßiger Regen", 65: "Starker Regen", 71: "Leichter Schnee", 80: "Schauer", 95: "Gewitter" },
    en: { 0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Freezing fog", 51: "Light drizzle", 61: "Light rain", 63: "Moderate rain", 65: "Heavy rain", 71: "Light snow", 80: "Showers", 95: "Thunderstorm" },
  };
  const fallback =
    language === "fr" ? "Conditions variables" :
    language === "nl" ? "Variabele omstandigheden" :
    language === "de" ? "Variable Bedingungen" :
    "Variable conditions";
  return descriptions?.[language]?.[code] || fallback;
}

function estimateConfidence({ rainProb, windSpeed }) {
  const midUncertainty = 1 - Math.abs((rainProb ?? 50) - 50) / 50;
  const windPenalty = clamp((windSpeed ?? 0) / 60, 0, 1);
  const score = clamp(0.85 - 0.35 * midUncertainty - 0.25 * windPenalty, 0.25, 0.95);
  if (score >= 0.72) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

function generateRealisticWeather() {
  const now = new Date();
  const currentHour = now.getHours();

  const baseTemp = 4 + Math.random() * 4;
  const isRainy = Math.random() > 0.45;
  const isCloudy = Math.random() > 0.35;

  const current = {
    time: now.toISOString(),
    temperature_2m: baseTemp,
    apparent_temperature: baseTemp - (1 + Math.random() * 2),
    relative_humidity_2m: 75 + Math.random() * 20,
    precipitation: isRainy ? Math.random() * 3 : 0,
    weather_code: isRainy ? 61 : isCloudy ? 3 : 1,
    wind_speed_10m: 10 + Math.random() * 18,
  };

  const hourly = { time: [], temperature_2m: [], precipitation_probability: [], precipitation: [], weather_code: [], wind_speed_10m: [] };

  for (let i = 0; i < 48; i++) {
    const hourDate = new Date();
    hourDate.setHours(currentHour + i);
    hourly.time.push(hourDate.toISOString());

    const hourOfDay = hourDate.getHours();
    let tempVariation = 0;
    if (hourOfDay >= 6 && hourOfDay <= 14) tempVariation = 2;
    else if (hourOfDay >= 22 || hourOfDay <= 5) tempVariation = -2;

    hourly.temperature_2m.push(baseTemp + tempVariation + (Math.random() - 0.5) * 2);

    const rainChance = clamp(20 + Math.random() * 70, 0, 100);
    hourly.precipitation_probability.push(rainChance);
    hourly.precipitation.push(rainChance > 60 ? Math.random() * 2 : 0);

    if (rainChance > 75) hourly.weather_code.push(61);
    else if (rainChance > 45) hourly.weather_code.push(3);
    else hourly.weather_code.push(1);

    hourly.wind_speed_10m.push(10 + Math.random() * 20);
  }

  const daily = { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_probability_max: [], precipitation_sum: [], wind_speed_10m_max: [], uv_index_max: [] };

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dayStr = date.toISOString().split("T")[0];
    daily.time.push(dayStr);

    const dayRain = Math.random() > 0.55;
    daily.weather_code.push(dayRain ? 61 : Math.random() > 0.4 ? 3 : 1);
    daily.temperature_2m_max.push(5 + Math.random() * 7);
    daily.temperature_2m_min.push(0 + Math.random() * 5);
    daily.precipitation_probability_max.push(dayRain ? 60 + Math.random() * 35 : 15 + Math.random() * 35);
    daily.precipitation_sum.push(dayRain ? Math.random() * 9 : Math.random() * 2);
    daily.wind_speed_10m_max.push(15 + Math.random() * 25);
    daily.uv_index_max.push(1 + Math.random() * 3);
  }

  return { timezone: "Europe/Brussels", current, hourly, daily };
}

async function reverseGeocodeCity(lat, lon) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("zoom", "10");

  const r = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("reverse geocode failed");
  const j = await r.json();

  const addr = j?.address || {};
  const city = addr.city || addr.town || addr.village || addr.municipality;

  return { fr: city || "Ma position", nl: city || "Mijn locatie", de: city || "Mein Standort", en: city || "My location" };
}

export default function App() {
  const [language, setLanguage] = useState("fr");
  const [darkMode, setDarkMode] = useState(false);
  const [location, setLocation] = useState({
    name: { fr: "Bruxelles", nl: "Brussel", de: "Brüssel", en: "Brussels" },
    lat: 50.8503,
    lon: 4.3517,
  });
    // --- Favoris + persistance ---
  const STORAGE_LAST = "zw:lastLocation:v1";
  const STORAGE_FAVS = "zw:favorites:v1";

  const [favorites, setFavorites] = useState([]);

  const sameLoc = (a, b) => {
    if (!a || !b) return false;
    const la = Number(a.lat), loa = Number(a.lon);
    const lb = Number(b.lat), lob = Number(b.lon);
    return Math.abs(la - lb) < 0.0001 && Math.abs(loa - lob) < 0.0001;
  };

  const isFavorite = useMemo(() => {
    return favorites.some((f) => sameLoc(f, location));
  }, [favorites, location]);

  const toggleFavorite = () => {
    setFavorites((prev) => {
      const exists = prev.some((f) => sameLoc(f, location));
      if (exists) return prev.filter((f) => !sameLoc(f, location));
      // On sauvegarde un “snapshot” propre du lieu
      const snap = { name: location.name, lat: location.lat, lon: location.lon };
      return [snap, ...prev].slice(0, 20); // limite à 20 favoris
    });
  };

  const [useRealAPI, setUseRealAPI] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weatherData, setWeatherData] = useState(null);

  // --- Code postal BE ---
  const [postalCode, setPostalCode] = useState("");
  const [postalResults, setPostalResults] = useState([]);
  const [postalLoading, setPostalLoading] = useState(false);
  const [postalMessage, setPostalMessage] = useState("");
  const postalDebounceRef = useRef(null);

  // --- Recherche ville / localité (Belgique) ---
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeMessage, setPlaceMessage] = useState("");
  const placeDebounceRef = useRef(null);

  const [updateReady, setUpdateReady] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  const abortRef = useRef(null);
  const t = getT(language);
  const makeNameObj = (label) => ({ fr: label, nl: label, de: label, en: label });

  useEffect(() => setLanguage(detectLang()), []);

  // (Optionnel mais top) : scrollbars / champs natifs cohérents avec le mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const onNeedRefresh = () => setUpdateReady(true);
    const onOfflineReady = () => setOfflineReady(true);
    window.addEventListener("pwa:need-refresh", onNeedRefresh);
    window.addEventListener("pwa:offline-ready", onOfflineReady);
    return () => {
      window.removeEventListener("pwa:need-refresh", onNeedRefresh);
      window.removeEventListener("pwa:offline-ready", onOfflineReady);
    };
  }, []);

  useEffect(() => { loadWeather(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [location.lat, location.lon, useRealAPI]);

  async function loadWeather() {
    setLoading(true);
    setError(null);
    try {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (useRealAPI) {
        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", String(location.lat));
        url.searchParams.set("longitude", String(location.lon));
        url.searchParams.set("timezone", "Europe/Brussels");
        url.searchParams.set("current", ["temperature_2m","relative_humidity_2m","apparent_temperature","precipitation","weather_code","wind_speed_10m"].join(","));
        url.searchParams.set("hourly", ["temperature_2m","precipitation_probability","precipitation","weather_code","wind_speed_10m"].join(","));
        url.searchParams.set("daily", ["weather_code","temperature_2m_max","temperature_2m_min","precipitation_probability_max","precipitation_sum","wind_speed_10m_max","uv_index_max"].join(","));

        const response = await fetch(url.toString(), { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data?.current || !data?.daily || !data?.hourly) throw new Error("Invalid API payload");
        setWeatherData(data);
        setLoading(false);
        return;
      }

      setWeatherData(generateRealisticWeather());
      setLoading(false);
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (useRealAPI) { setUseRealAPI(false); return; }
      setError(e?.message || "Unknown error");
      setLoading(false);
    }
  }

  function changeCity(city) {
    setLocation({ name: city.name, lat: city.lat, lon: city.lon });
  }

  async function useMyLocation() {
    if (!navigator?.geolocation) { setError("Geolocation not supported"); return; }
    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        let name = { fr: "Ma position", nl: "Mijn locatie", de: "Mein Standort", en: "My location" };
        try { name = { ...name, ...(await reverseGeocodeCity(lat, lon)) }; } catch {}
        setLocation({ name, lat, lon });
      },
      (err) => { setError(err?.message || "Geolocation error"); setLoading(false); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }

  async function searchByPostalCode(pc) {
    const clean = (pc || "").trim();
    setPostalMessage("");
    setPostalResults([]);
    if (!/^\d{4}$/.test(clean)) return;

    setPostalLoading(true);
    try {
      const res = await fetch(`https://api.zippopotam.us/be/${clean}`);
      if (!res.ok) {
        if (res.status === 404) { setPostalMessage(t.postalNoResults); return; }
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      const places = (json.places || [])
        .map((p, idx) => ({
          id: `${clean}-${idx}-${p["place name"]}`,
          name: p["place name"],
          state: p.state,
          lat: Number(p.latitude),
          lon: Number(p.longitude),
        }))
        .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon))
        .filter((p, i, arr) => arr.findIndex((x) => x.name === p.name) === i)
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));

      if (!places.length) setPostalMessage(t.postalNoResults);
      else if (places.length === 1) selectPostalPlace(places[0]);
      else setPostalResults(places);
    } catch (e) {
      console.error(e);
      setPostalMessage(t.postalError);
    } finally {
      setPostalLoading(false);
    }
  }

  function selectPostalPlace(place) {
    const label = `${postalCode.trim()} ${place.name}`;
    setLocation({ name: makeNameObj(label), lat: place.lat, lon: place.lon });
    setPostalResults([]);
    setPostalMessage("");
  }

  useEffect(() => {
    if (postalDebounceRef.current) clearTimeout(postalDebounceRef.current);
    const clean = postalCode.trim();

    if (clean.length === 4) postalDebounceRef.current = setTimeout(() => searchByPostalCode(clean), 350);
    else { setPostalResults([]); setPostalMessage(""); }

    return () => {
      if (postalDebounceRef.current) clearTimeout(postalDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postalCode, language]);

  async function searchByPlaceName(q) {
    const clean = (q || "").trim();
    setPlaceMessage("");
    setPlaceResults([]);
    if (clean.length < 2) return;

    setPlaceLoading(true);
    try {
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.searchParams.set("name", clean);
      url.searchParams.set("count", "10");
      url.searchParams.set("language", language);
      url.searchParams.set("format", "json");
      url.searchParams.set("country_code", "BE");

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const results = (json.results || [])
        .map((r, idx) => ({
          id: `${r.id || "r"}-${idx}`,
          name: r.name,
          admin1: r.admin1,
          admin2: r.admin2,
          postcode: r.postcode,
          lat: r.latitude,
          lon: r.longitude,
        }))
        .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lon));

      if (!results.length) setPlaceMessage(t.placeNoResults);
      else setPlaceResults(results);
    } catch (e) {
      console.error(e);
      setPlaceMessage(t.placeError);
    } finally {
      setPlaceLoading(false);
    }
  }

  function selectPlaceResult(r) {
    const label = r.postcode ? `${r.postcode} ${r.name}` : r.name;

    setLocation({
      name: makeNameObj(label),
      lat: r.lat,
      lon: r.lon,
    });

    if (r.postcode && /^\d{4}$/.test(String(r.postcode))) setPostalCode(String(r.postcode));

    setPlaceResults([]);
    setPlaceMessage("");
  }

  useEffect(() => {
    if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current);

    const clean = placeQuery.trim();
    if (clean.length >= 2) {
      placeDebounceRef.current = setTimeout(() => searchByPlaceName(clean), 350);
    } else {
      setPlaceResults([]);
      setPlaceMessage("");
    }

    return () => {
      if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeQuery, language]);
  
    // Charger last location + favoris au démarrage
  useEffect(() => {
    try {
      const rawFavs = localStorage.getItem(STORAGE_FAVS);
      if (rawFavs) setFavorites(JSON.parse(rawFavs));

      const rawLast = localStorage.getItem(STORAGE_LAST);
      if (rawLast) {
        const saved = JSON.parse(rawLast);
        if (saved?.lat && saved?.lon && saved?.name) {
          setLocation(saved);
        }
      }
    } catch (e) {
      console.warn("Storage load failed", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sauver favoris
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FAVS, JSON.stringify(favorites));
    } catch (e) {
      console.warn("Storage save favs failed", e);
    }
  }, [favorites]);

  // Sauver le dernier lieu sélectionné
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_LAST,
        JSON.stringify({ name: location.name, lat: location.lat, lon: location.lon })
      );
    } catch (e) {
      console.warn("Storage save last failed", e);
    }
  }, [location]);

  const aiAnalysis = useMemo(() => {
    if (!weatherData?.current || !weatherData?.daily || !weatherData?.hourly) {
      return { emoji: "🌤️", title: "", lines: [], tips: [], confidenceLabel: "" };
    }

    const current = weatherData.current;
    const daily = weatherData.daily;
    const hourly = weatherData.hourly;
	const aiNarrative = useMemo(() => {
    const locationLabel = location?.name?.[language] || location?.name?.fr || "";
    return buildAiNarrative({
      t,
      language,
      locationLabel,
      current: weatherData?.current,
      hourly: weatherData?.hourly,
      daily: weatherData?.daily,
      getWeatherDescription,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, language, location, weatherData]);

    const tempNow = Math.round(current.temperature_2m ?? 0);
    const feelsNow = Math.round(current.apparent_temperature ?? tempNow);
    const windNow = Math.round(current.wind_speed_10m ?? 0);

    const rainProbToday = Math.round((daily.precipitation_probability_max || [0])[0] ?? 0);
    const rainSumToday = Number((daily.precipitation_sum || [0])[0] ?? 0);
    const uvToday = Math.round((daily.uv_index_max || [0])[0] ?? 0);

    const weatherDesc = getWeatherDescription(language, current.weather_code);

    // --------- helpers sur 24h ---------
    const hours = (hourly.time || []).slice(0, 24);
    const temps = (hourly.temperature_2m || []).slice(0, 24).map((x) => Number(x));
    const pps = (hourly.precipitation_probability || []).slice(0, 24).map((x) => Number(x));
    const pr = (hourly.precipitation || []).slice(0, 24).map((x) => Number(x));
    const winds = (hourly.wind_speed_10m || []).slice(0, 24).map((x) => Number(x));

    const safe = (arr) => arr.filter((x) => Number.isFinite(x));
    const safeTemps = safe(temps);
    const safePps = safe(pps);
    const safePr = safe(pr);
    const safeWinds = safe(winds);

    const min24 = safeTemps.length ? Math.round(Math.min(...safeTemps)) : tempNow;
    const max24 = safeTemps.length ? Math.round(Math.max(...safeTemps)) : tempNow;
    const maxWind24 = safeWinds.length ? Math.round(Math.max(...safeWinds)) : windNow;

    const idxMin = safeTemps.length ? temps.indexOf(Math.min(...safeTemps)) : 0;
    const idxMax = safeTemps.length ? temps.indexOf(Math.max(...safeTemps)) : 0;

    const fmtHour = (i) => {
      const iso = hours[i];
      if (!iso) return "—";
      const d = new Date(iso);
      const h = d.getHours();
      return `${h}h`;
    };

    // Fenêtres pluie : on détecte une “séquence” d'heures avec probabilité >= 50% (ou précip > 0)
    const rainThreshold = 50;
    let rainStart = -1;
    let rainEnd = -1;
    let peakPP = 0;
    let peakIdx = -1;

    for (let i = 0; i < Math.min(hours.length, safePps.length); i++) {
      const pp = pps[i] ?? 0;
      const mm = pr[i] ?? 0;
      const rainy = (pp >= rainThreshold) || (mm > 0.1);

      if (rainy && rainStart === -1) rainStart = i;
      if (rainy) rainEnd = i;

      if (pp > peakPP) {
        peakPP = pp;
        peakIdx = i;
      }
    }

    const hasRainWindow = rainStart !== -1 && rainEnd !== -1;

    // Confiance (reprend ton estimateur mais on ajoute une explication)
    const confKey = estimateConfidence({ rainProb: rainProbToday, windSpeed: maxWind24 });
    const confidenceLabel =
      confKey === "high" ? t.highConfidence :
      confKey === "medium" ? t.mediumConfidence :
      t.lowConfidence;

    const confidenceWhy =
      confKey === "high"
        ? (t.confHighWhy || "Prévision stable : risque de variation faible aujourd’hui.")
        : confKey === "medium"
          ? (t.confMedWhy || "Prévision plausible mais météo changeante : surveille l’évolution heure par heure.")
          : (t.confLowWhy || "Prévision incertaine : conditions très variables ou fronts possibles.");

    // Emoji “principal”
    let emoji = "🌤️";
    if (rainProbToday > 70) emoji = "☔";
    else if (rainProbToday > 40) emoji = "🌦️";
    else if (tempNow <= 1) emoji = "❄️";
    else if (maxWind24 >= 40) emoji = "💨";
    else if (tempNow >= 22) emoji = "☀️";

    // Lignes d’analyse (style pro)
    const lines = [];

    // 1) Situation actuelle
    lines.push(
      `${t.aiNow || "Actuellement"} : ${tempNow}°C (${t.feelsLike} ${feelsNow}°C), ${weatherDesc.toLowerCase()} — ${t.wind}: ${windNow} km/h.`
    );

    // 2) Tendance 24h
    lines.push(
      `${t.aiTrend24 || "Tendance (24h)"} : ${t.aiMin || "min"} ${min24}°C vers ${fmtHour(idxMin)}, ${t.aiMax || "max"} ${max24}°C vers ${fmtHour(idxMax)}.`
    );

    // 3) Pluie
    if (hasRainWindow) {
      lines.push(
        `${t.aiRainWindow || "Pluie"} : risque surtout entre ${fmtHour(rainStart)} et ${fmtHour(rainEnd)} (pic ~${Math.round(peakPP)}% vers ${fmtHour(peakIdx)}).`
      );
    } else {
      lines.push(
        `${t.aiRainWindow || "Pluie"} : risque faible à modéré aujourd’hui (max ${rainProbToday}%).`
      );
    }

    // 4) Quantité + UV + vent max
    const extra = [];
    if (Number.isFinite(rainSumToday)) extra.push(`${t.aiRainSum || "cumul"} ~${rainSumToday.toFixed(1)} mm`);
    if (Number.isFinite(uvToday)) extra.push(`${t.uvMax} ${uvToday}`);
    if (Number.isFinite(maxWind24)) extra.push(`${t.aiWindMax || "vent max"} ${maxWind24} km/h`);
    if (extra.length) lines.push(`${t.aiExtras || "Indicateurs"} : ${extra.join(" • ")}.`);

    // Conseils pratiques (courts mais utiles)
    const tips = [];

    if (rainProbToday >= 50 || rainSumToday >= 1) tips.push(t.aiTipUmbrella || "Prends un parapluie (ou une veste imperméable).");
    if (tempNow <= 1 || min24 <= 0) tips.push(t.aiTipIce || "Attention au gel/verglas possible (trottoirs, routes secondaires).");
    if (maxWind24 >= 35) tips.push(t.aiTipWind || "Vent notable : prudence à vélo et sur les zones dégagées.");
    if (feelsNow <= tempNow - 2) tips.push(t.aiTipFeels || "Le ressenti est plus froid : prévois une couche en plus.");
    if (!tips.length) tips.push(t.aiTipOk || "Conditions plutôt stables : rien de particulier à signaler.");

    return {
      emoji,
      title: `${t.aiTitle || "Analyse IA détaillée"} — ${confidenceLabel}`,
      confidenceLabel,
      confidenceWhy,
      lines,
      tips,
    };
  }, [weatherData, language, t]);

  const theme = darkMode
    ? {
        page: "bg-[#070612] text-slate-100",
        wrap: "aurora-bg",
        card: "bg-white/6 border border-white/10 shadow-[0_20px_80px_rgba(0,0,0,.35)] backdrop-blur-xl card-anim card-shimmer",
        cardSoft: "bg-white/4 border border-white/10 backdrop-blur-xl card-anim card-shimmer",
        text: "text-slate-100",
        muted: "text-slate-300/80",
        muted2: "text-slate-400/70",
        input:
          "bg-white/6 border border-white/10 text-slate-100 placeholder:text-slate-400/70 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 focus:border-fuchsia-400/30",
        btn:
          "bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white shadow-[0_12px_40px_rgba(168,85,247,.25)] hover:brightness-110 active:brightness-95",
        btnGhost:
          "bg-white/6 border border-white/10 text-slate-100 hover:bg-white/10",
        chipOn:
          "bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white shadow-[0_10px_30px_rgba(168,85,247,.22)]",
        chipOff:
          "bg-white/6 border border-white/10 text-slate-100 hover:bg-white/10",
      }
    : {
        page: "bg-[#FBF8FF] text-slate-900",
        wrap: "aurora-bg",
        card: "bg-white/70 border border-white/60 shadow-[0_20px_80px_rgba(59,130,246,.10)] backdrop-blur-xl card-anim card-shimmer",
        cardSoft: "bg-white/55 border border-white/60 backdrop-blur-xl card-anim card-shimmer",
        text: "text-slate-900",
        muted: "text-slate-600",
        muted2: "text-slate-500",
        input:
          "bg-white/70 border border-white/70 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-500/20",
        btn:
          "bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-[0_12px_40px_rgba(99,102,241,.18)] hover:brightness-110 active:brightness-95",
        btnGhost:
          "bg-white/70 border border-white/70 text-slate-900 hover:bg-white/90",
        chipOn:
          "bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-[0_10px_30px_rgba(99,102,241,.18)]",
        chipOff:
          "bg-white/65 border border-white/70 text-slate-900 hover:bg-white/85",
      };

  const isLive = useRealAPI;

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.page} ${theme.wrap}`}>
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <div className={`text-center ${theme.text}`}>
            <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-fuchsia-500" />
            <p className={`text-xl ${theme.muted}`}>{t.loading}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !weatherData) {
    return (
      <div className={`min-h-screen ${theme.page} ${theme.wrap}`}>
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <div className={`max-w-md w-full rounded-2xl p-6 ${theme.card}`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <div className={`font-extrabold text-lg ${theme.text}`}>{t.errorTitle}</div>
                <div className={`mt-1 text-sm ${theme.muted2}`}>{String(error || "Unknown error")}</div>

                <div className="mt-5 flex gap-3">
                  <button onClick={() => loadWeather()} className={`flex-1 rounded-xl px-4 py-2.5 font-extrabold ${theme.btn}`}>
                    {t.retry}
                  </button>
                  <button onClick={() => setUseRealAPI(false)} className={`flex-1 rounded-xl px-4 py-2.5 font-bold ${theme.btnGhost}`}>
                    Demo
                  </button>
                </div>

                <div className={`mt-4 text-xs ${theme.muted2}`}>Astuce : passe en « Demo » si le live est bloqué.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const current = weatherData.current;
  const daily = weatherData.daily;
  const hourly = weatherData.hourly;

  return (
    <div className={`min-h-screen ${theme.page} ${theme.wrap}`}>
      <div className="relative z-10 min-h-screen p-4 pb-10">
        <div className="max-w-5xl mx-auto">

          {(updateReady || offlineReady) && (
            <div className={`mb-4 rounded-2xl p-3 sm:p-4 ${theme.card}`}>
              <div className="flex items-center justify-between gap-3">
                <div className={`text-sm font-extrabold ${theme.text}`}>{updateReady ? t.updateReady : "Offline prêt"}</div>
                {updateReady ? (
                  <button onClick={() => window.location.reload()} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold ${theme.btn}`}>
                    <RefreshCcw className="w-4 h-4" />
                    {t.updateCta}
                  </button>
                ) : (
                  <span className={`text-xs ${theme.muted2}`}>OK</span>
                )}
              </div>
            </div>
          )}

          {/* Header premium */}
          <div className={`sticky top-3 z-20 mb-6 rounded-2xl px-4 py-3 ${theme.card}`}>
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setDarkMode((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold transition ${theme.btnGhost}`}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span className="hidden sm:inline">{darkMode ? t.dark : t.light}</span>
              </button>

              <div className="text-center flex-1 min-w-0">
                <div className={`text-xl sm:text-2xl font-extrabold ${theme.text} truncate`}>
                  {t.title} <span className="align-middle">🇧🇪</span>
                </div>
                <div className={`text-xs sm:text-sm ${theme.muted} truncate`}>
                  {location?.name?.[language] || location?.name?.fr}
                </div>
              </div>

              <div className="relative">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={`appearance-none rounded-xl px-4 py-2 pr-10 text-sm font-extrabold transition ${theme.btnGhost}`}
                >
                  <option value="fr">🇫🇷 Français</option>
                  <option value="nl">🇳🇱 Nederlands</option>
                  <option value="de">🇩🇪 Deutsch</option>
                  <option value="en">🇬🇧 English</option>
                </select>
                <Globe className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme.muted2} pointer-events-none`} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold ${theme.btnGhost}`}>
                <span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-500" : "bg-amber-400"}`} />
                {isLive ? t.liveMode : t.demoMode}
              </span>
              <button onClick={() => setUseRealAPI((v) => !v)} className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${isLive ? theme.chipOff : theme.chipOn}`}>
                {isLive ? "Switch → Demo" : "Switch → Live"}
              </button>
            </div>
          </div>

          {/* Sélection + CP + Localité */}
          <div className={`rounded-2xl p-4 mb-6 ${theme.card}`}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-500" />
                <span className={`font-extrabold ${theme.text}`}>{t.chooseCity}</span>
              </div>
              <button onClick={useMyLocation} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold transition ${theme.btnGhost}`}>
                <LocateFixed className="w-4 h-4" />
                {t.useMyLocation}
              </button>
			  <button onClick={toggleFavorite} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold transition ${theme.btnGhost}`} title={isFavorite ? (t.removeFav || "Retirer des favoris") : (t.addFav || "Ajouter aux favoris")}>
			    <span className="text-lg">{isFavorite ? "⭐" : "☆"}</span>
			    <span className="hidden sm:inline">{isFavorite ? (t.favOn || "Favori") : (t.favOff || "Favori")}</span>
			  </button>
            </div>

            {/* Code postal */}
            <div className="mb-5">
              <div className={`text-sm font-extrabold mb-2 ${theme.text}`}>{t.postalTitle}</div>

              <input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                placeholder={t.postalPlaceholder}
                inputMode="numeric"
                className={`w-full rounded-xl px-3 py-2 text-sm font-semibold shadow-sm transition ${theme.input}`}
              />

              <div className={`text-xs mt-2 ${theme.muted2}`}>{t.postalHint}</div>

              {postalLoading && (
                <div className="flex items-center gap-2 mt-3 text-sm text-indigo-500 font-extrabold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.postalSearching}</span>
                </div>
              )}

              {!!postalMessage && !postalLoading && (
                <div className={`mt-3 text-sm ${theme.muted}`}>{postalMessage}</div>
              )}

              {postalResults.length > 0 && (
                <div className="mt-3">
                  <div className={`text-sm font-extrabold mb-2 ${theme.text}`}>{t.postalPick}</div>
                  <div className={`max-h-56 overflow-auto rounded-xl border ${darkMode ? "border-white/10" : "border-slate-200"}`}>
                    {postalResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => selectPostalPlace(p)}
                        className={`w-full text-left px-3 py-2 transition ${darkMode ? "hover:bg-white/5" : "hover:bg-slate-50"}`}
                      >
                        <div className={`font-extrabold ${theme.text}`}>{p.name}</div>
                        <div className={`text-xs ${theme.muted2}`}>{p.state}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ville / Localité */}
            <div className="mb-5">
              <div className={`text-sm font-extrabold mb-2 ${theme.text}`}>{t.placeTitle}</div>

              <input
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                placeholder={t.placePlaceholder}
                className={`w-full rounded-xl px-3 py-2 text-sm font-semibold shadow-sm transition ${theme.input}`}
              />

              <div className={`text-xs mt-2 ${theme.muted2}`}>{t.placeHint}</div>

              {placeLoading && (
                <div className="flex items-center gap-2 mt-3 text-sm text-indigo-500 font-extrabold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.placeSearching}</span>
                </div>
              )}

              {!!placeMessage && !placeLoading && (
                <div className={`mt-3 text-sm ${theme.muted}`}>{placeMessage}</div>
              )}

              {placeResults.length > 0 && (
                <div className="mt-3">
                  <div className={`text-sm font-extrabold mb-2 ${theme.text}`}>{t.placePick}</div>

                  <div className={`max-h-56 overflow-auto rounded-xl border ${darkMode ? "border-white/10" : "border-slate-200"}`}>
                    {placeResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => selectPlaceResult(r)}
                        className={`w-full text-left px-3 py-2 transition ${darkMode ? "hover:bg-white/5" : "hover:bg-slate-50"}`}
                      >
                        <div className={`font-extrabold ${theme.text}`}>
                          {r.name}{r.postcode ? ` (${r.postcode})` : ""}
                        </div>
                        <div className={`text-xs ${theme.muted2}`}>
                          {[r.admin2, r.admin1].filter(Boolean).join(" · ")}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
			
			{favorites.length > 0 && (
			  <div className="mb-5">
				<div className={`text-sm font-extrabold mb-2 ${theme.text}`}>{t.favoritesTitle || "Favoris"}</div>
				<div className="flex flex-wrap gap-2">
				  {favorites.map((f, idx) => (
					<button
					  key={`${f.lat}-${f.lon}-${idx}`}
					  onClick={() => setLocation(f)}
					  className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
						sameLoc(f, location) ? theme.chipOn : theme.chipOff
					  }`}
					  title={`${f?.name?.[language] || f?.name?.fr || "Lieu"}`}
					>
					  {f?.name?.[language] || f?.name?.fr || "Lieu"}
					</button>
				  ))}
				</div>
			  </div>
			)}

            {/* Villes rapides */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BELGIAN_CITIES.map((city) => {
                const active = location?.name?.fr === city.name.fr;
                return (
                  <button
                    key={city.name.fr}
                    onClick={() => changeCity(city)}
                    className={`px-4 py-2 rounded-xl font-extrabold transition text-sm ${active ? theme.chipOn : theme.chipOff}`}
                  >
                    {city.name[language]}
                  </button>
                );
              })}
            </div>
          </div>

{/* Bandeau IA */}
<div className="bg-gradient-to-r from-indigo-500/90 to-fuchsia-600/90 rounded-2xl shadow-xl p-6 mb-6 text-white border border-white/20 backdrop-blur-xl">
  <div className="flex items-start gap-3">
    <div className="text-4xl">{aiBanner.emoji}</div>

    <div className="flex-1">
      <h3 className="font-extrabold text-lg mb-1">
        {t.aiAnalysisFor} {location?.name?.[language] || location?.name?.fr}
      </h3>

      <div className="text-white/95 font-extrabold mb-2">
        {aiBanner.title}
      </div>

      <p className="text-white/80 text-sm mb-3">
        {aiBanner.confidenceWhy}
      </p>

      <div className="space-y-1.5">
        {(aiBanner.lines || []).map((l, i) => (
          <div key={i} className="text-white/95 leading-relaxed">
            • {l}
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="text-white/90 font-extrabold mb-2">{t.aiTips || "Conseils"}</div>
        <div className="flex flex-wrap gap-2">
          {(aiBanner.tips || []).map((tip, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-extrabold bg-white/15 border border-white/20"
            >
              {tip}
            </span>
          ))}
        </div>
      </div>
    </div>
  </div>
</div>
		  
		  <DayParts
            hourly={hourly}
            language={language}
            t={t}
            darkMode={darkMode}
            theme={theme}
            getWeatherIcon={getWeatherIcon}
		  />

          {/* Carte actuelle */}
          <div className={`rounded-2xl p-4 sm:p-8 mb-6 ${theme.card}`}>
            <div className="flex items-center justify-between mb-6">
              <div className={`flex items-center gap-2 ${theme.muted}`}>
                <MapPin className="w-5 h-5" />
                <span className={`font-extrabold ${theme.text}`}>{location?.name?.[language] || location?.name?.fr}</span>
                <span className={`text-xs ${theme.muted2}`}>({fmt(location.lat, 3)}, {fmt(location.lon, 3)})</span>
              </div>

              <button onClick={() => loadWeather()} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm sm:text-base font-extrabold transition ${theme.btnGhost}`}>
                <Navigation className="w-4 h-4" />
                {t.refresh}
              </button>
            </div>

            <div className="flex items-center justify-between mb-8">
              <div>
                <div className={`text-6xl font-extrabold mb-2 ${theme.text}`}>{Math.round(current.temperature_2m)}°C</div>
                <div className={`text-xl mb-1 ${theme.muted}`}>{getWeatherDescription(language, current.weather_code)}</div>
                <div className={`${theme.muted2}`}>{t.feelsLike} {Math.round(current.apparent_temperature)}°C</div>
              </div>
              <div>{getWeatherIcon(current.weather_code, "w-16 h-16")}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={`${darkMode ? "bg-blue-500/10" : "bg-blue-50"} rounded-xl p-4`}>
                <div className="flex items-center gap-2 text-blue-500 mb-2">
                  <Droplets className="w-5 h-5" />
                  <span className="text-sm font-extrabold">{t.humidity}</span>
                </div>
                <div className={`text-2xl font-extrabold ${theme.text}`}>{Math.round(current.relative_humidity_2m)}%</div>
              </div>

              <div className={`${darkMode ? "bg-emerald-500/10" : "bg-green-50"} rounded-xl p-4`}>
                <div className="flex items-center gap-2 text-emerald-500 mb-2">
                  <Wind className="w-5 h-5" />
                  <span className="text-sm font-extrabold">{t.wind}</span>
                </div>
                <div className={`text-2xl font-extrabold ${theme.text}`}>{Math.round(current.wind_speed_10m)} km/h</div>
              </div>

              <div className={`${darkMode ? "bg-purple-500/10" : "bg-purple-50"} rounded-xl p-4`}>
                <div className="flex items-center gap-2 text-purple-500 mb-2">
                  <CloudRain className="w-5 h-5" />
                  <span className="text-sm font-extrabold">{t.currentRain}</span>
                </div>
                <div className={`text-2xl font-extrabold ${theme.text}`}>{Number(current.precipitation || 0).toFixed(1)} mm</div>
              </div>

              <div className={`${darkMode ? "bg-orange-500/10" : "bg-orange-50"} rounded-xl p-4`}>
                <div className="flex items-center gap-2 text-orange-500 mb-2">
                  <Sun className="w-5 h-5" />
                  <span className="text-sm font-extrabold">{t.uvMax}</span>
                </div>
                <div className={`text-2xl font-extrabold ${theme.text}`}>{Math.round((daily.uv_index_max || [0])[0] || 0)}</div>
              </div>
            </div>
          </div>

          <SevenDayTemps
            daily={daily}
            language={language}
            t={t}
            darkMode={darkMode}
            theme={theme}
            getWeatherIcon={getWeatherIcon}
          />

          {/* Horaires */}
          <div className={`rounded-2xl p-4 sm:p-8 mb-6 ${theme.card}`}>
            <h3 className={`text-xl sm:text-2xl font-extrabold mb-4 sm:mb-6 ${theme.text}`}>{t.hourlyForecast}</h3>
			
			<HourlyChart
			  hourly={hourly}
			  language={language}
			  t={t}
			  darkMode={darkMode}
			  theme={theme}
			/>

            <div className="overflow-x-auto">
              <div className="flex gap-3 pb-4">
                {(hourly.time || []).slice(0, 48).map((time, index) => {
                  const hourDate = new Date(time);
                  const hour = hourDate.getHours();
                  const isNow = index === 0;
                  const temp = Math.round((hourly.temperature_2m || [])[index] ?? 0);
                  const pp = Math.round((hourly.precipitation_probability || [])[index] ?? 0);
                  const ws = Math.round((hourly.wind_speed_10m || [])[index] ?? 0);
                  const wc = (hourly.weather_code || [])[index] ?? 3;

                  return (
                    <div
                      key={`${time}-${index}`}
                      className={`flex-shrink-0 w-24 p-4 rounded-2xl text-center border transition ${
                        isNow
                          ? (darkMode ? "bg-indigo-500/15 border-indigo-500/50" : "bg-indigo-50 border-indigo-200")
                          : (darkMode ? "bg-white/5 border-white/10 hover:bg-white/8" : "bg-slate-50 border-slate-100 hover:bg-slate-100")
                      }`}
                    >
                      <div className={`text-sm font-extrabold mb-2 ${theme.muted}`}>
                        {isNow ? (t.now || "Maintenant") : `${hour}h`}
                      </div>
                      <div className="flex justify-center mb-2">{getWeatherIcon(wc, "w-10 h-10")}</div>
                      <div className={`text-xl font-extrabold mb-1 ${theme.text}`}>{temp}°</div>
                      <div className="flex items-center justify-center gap-1 text-xs text-sky-500 font-extrabold mb-1">
                        <Droplets className="w-3 h-3" /><span>{pp}%</span>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-xs text-emerald-500 font-extrabold">
                        <Wind className="w-3 h-3" /><span>{ws}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className={`text-sm mt-4 text-center ${theme.muted2}`}>{t.scrollHint}</p>
          </div>

          <SevenDayForecast
            daily={daily}
            language={language}
            t={t}
            darkMode={darkMode}
            theme={theme}
            getWeatherIcon={getWeatherIcon}
            // ✅ IMPORTANT : on “bind” la langue pour éviter un appel avec mauvaise signature
            getWeatherDescription={(code) => getWeatherDescription(language, code)}
          />

          <div className={`text-center mt-8 text-sm ${theme.muted2}`}>
            <p className="font-semibold">PWA : partage par lien + installable.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
