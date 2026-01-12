function generateIRMStyleAnalysis(weatherData, location, language, t, getWeatherDescription, estimateConfidence) {
  if (!weatherData?.current || !weatherData?.daily || !weatherData?.hourly) {
    return { emoji: "🌤️", title: "", content: "", confidenceLabel: "" };
  }

  const current = weatherData.current;
  const daily = weatherData.daily;
  const hourly = weatherData.hourly;

  const tempNow = Math.round(current.temperature_2m ?? 0);
  const feelsNow = Math.round(current.apparent_temperature ?? tempNow);
  const windNow = Math.round(current.wind_speed_10m ?? 0);
  const weatherDesc = getWeatherDescription(language, current.weather_code);

  const rainProbToday = Math.round((daily.precipitation_probability_max || [0])[0] ?? 0);
  const rainSumToday = Number((daily.precipitation_sum || [0])[0] ?? 0);
  const uvToday = Math.round((daily.uv_index_max || [0])[0] ?? 0);
  const minToday = Math.round((daily.temperature_2m_min || [0])[0] ?? tempNow);
  const maxToday = Math.round((daily.temperature_2m_max || [0])[0] ?? tempNow);

  const hours = (hourly.time || []).slice(0, 24);
  const temps = (hourly.temperature_2m || []).slice(0, 24).map(x => Number(x));
  const pps = (hourly.precipitation_probability || []).slice(0, 24).map(x => Number(x));
  const pr = (hourly.precipitation || []).slice(0, 24).map(x => Number(x));
  const winds = (hourly.wind_speed_10m || []).slice(0, 24).map(x => Number(x));

  const safe = arr => arr.filter(x => Number.isFinite(x));
  const safeTemps = safe(temps);
  const safeWinds = safe(winds);

  const maxWind24 = safeWinds.length ? Math.round(Math.max(...safeWinds)) : windNow;

  const fmtHour = (i) => {
    const iso = hours[i];
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.getHours()}h`;
  };

  const getPeriodName = (hour) => {
    if (hour >= 6 && hour < 12) return t.morning;
    if (hour >= 12 && hour < 18) return t.afternoon;
    if (hour >= 18 && hour < 22) return t.evening;
    return t.night;
  };

  let rainStart = -1, rainEnd = -1, peakPP = 0, peakIdx = -1;
  
  for (let i = 0; i < Math.min(hours.length, pps.length); i++) {
    const pp = pps[i] ?? 0;
    const mm = pr[i] ?? 0;
    const rainy = pp >= 50 || mm > 0.1;
    
    if (rainy && rainStart === -1) rainStart = i;
    if (rainy) rainEnd = i;
    if (pp > peakPP) { peakPP = pp; peakIdx = i; }
  }

  const hasRainWindow = rainStart !== -1 && rainEnd !== -1;
  const idxMin = temps.indexOf(Math.min(...safeTemps));
  const idxMax = temps.indexOf(Math.max(...safeTemps));

  let emoji = "🌤️";
  if (rainProbToday > 70) emoji = "☔";
  else if (rainProbToday > 40) emoji = "🌦️";
  else if (tempNow <= 1) emoji = "❄️";
  else if (maxWind24 >= 40) emoji = "💨";
  else if (tempNow >= 22) emoji = "☀️";

  const confKey = estimateConfidence({ rainProb: rainProbToday, windSpeed: maxWind24 });
  const confidenceLabel = confKey === "high" ? t.highConfidence : confKey === "medium" ? t.mediumConfidence : t.lowConfidence;

  let content = "";

  // PARAGRAPHE 1 : Situation générale
  content += `**${t.irmGeneralSituation}**\n\n`;
  content += `${t.irmDayAnnounces} ${weatherDesc.toLowerCase()} ${t.irmWith} ${location.name[language]} `;
  content += `${t.irmWith} des températures ${t.irmBetween} ${minToday}°C ${t.irmInEarlyMorning} `;
  content += `et ${maxToday}°C ${t.irmInAfternoon} (${t.irmTowards} ${fmtHour(idxMax)}). `;
  
  if (Math.abs(feelsNow - tempNow) >= 2) {
    content += `${t.irmFeelsHowever} ${feelsNow < tempNow ? t.irmCooler : t.irmWarmer} `;
    content += `(${feelsNow}°C ${t.irmCurrently}) ${t.irmDueToWind}. `;
  }
  
  content += `\n\n`;

  // PARAGRAPHE 2 : Précipitations
  content += `**${t.irmPrecipitation}**\n\n`;
  if (hasRainWindow) {
    content += `${t.irmPrecipExpected} ${t.irmBetweenHours} ${fmtHour(rainStart)} ${t.irmAnd} ${fmtHour(rainEnd)}. `;
    content += `${t.irmRainProbWillReach} ${Math.round(peakPP)}% ${t.irmTowards} ${fmtHour(peakIdx)}. `;
    
    if (rainSumToday >= 5) {
      content += `${t.irmAccumulationSignificant} ${rainSumToday.toFixed(1)}mm ${t.irmExpectedForDay}. `;
    } else if (rainSumToday >= 1) {
      content += `${t.irmAccumulationModerate} ${rainSumToday.toFixed(1)}mm ${t.irmExpected}. `;
    } else {
      content += `${t.irmLightPrecip}. `;
    }
  } else if (rainProbToday >= 30) {
    content += `${t.irmIsolatedShowers}, ${t.irmWithMaxProb} ${rainProbToday}%. `;
    content += `${t.irmAccumulationLow} ${rainSumToday.toFixed(1)}mm). `;
  } else {
    content += `${t.irmMostlyDry}. ${t.irmLimitedRisk} ${rainProbToday}%. `;
  }
  
  content += `\n\n`;

  // PARAGRAPHE 3 : Vent
  content += `**${t.irmWind}**\n\n`;
  if (maxWind24 >= 40) {
    content += `${t.irmWindStrong} ${windNow} km/h ${t.irmWithGusts} ${maxWind24} km/h ${t.irmDuringDay}. `;
    content += `${t.irmCautionBike}. `;
  } else if (windNow >= 25) {
    content += `${t.irmWindModerate} ${windNow} km/h, ${t.irmWithPeaks} ${maxWind24} km/h. `;
  } else {
    content += `${t.irmWindCalm} (${windNow} km/h ${t.irmCurrently}). `;
  }
  
  content += `\n\n`;

  // PARAGRAPHE 4 : Recommandations
  content += `**${t.irmRecommendations}**\n\n`;
  
  const tips = [];
  if (rainProbToday >= 60) tips.push(t.irmUmbrellaOrJacket);
  if (tempNow <= 3 || minToday <= 1) tips.push(t.irmWarmClothes);
  if (feelsNow <= tempNow - 3) tips.push(t.irmExtraLayer);
  if (uvToday >= 6) tips.push(t.irmSunProtection);
  
  if (tips.length > 0) {
    content += `${t.irmThinkOfBringing} ${tips.join(", ")}. `;
  } else {
    content += `${t.irmNormalConditions}. `;
  }
  
  content += `\n\n`;

  // PARAGRAPHE 5 : Confiance
  content += `**${t.irmConfidenceTitle} : ${confidenceLabel}**\n\n`;
  
  if (confKey === "high") {
    content += `${t.irmStableConditions}. ${t.irmGoodReliability}.`;
  } else if (confKey === "medium") {
    content += `${t.irmEvolvingSituation}. ${t.irmMayBeAdjusted}.`;
  } else {
    content += `${t.irmUncertainSituation}. ${t.irmCheckUpdates}.`;
  }

  return {
    emoji,
    title: `${t.aiAnalysisFor} ${location.name[language]}`,
    content,
    confidenceLabel
  };
}
