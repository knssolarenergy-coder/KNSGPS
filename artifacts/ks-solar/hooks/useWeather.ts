import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { getCityInfo } from "@/utils/cities";

const CACHE_TTL_MS = 60 * 60 * 1000;

export type SolarEstimate = "Excellent" | "Good" | "Low" | "Poor";
export type WeatherCondition = "Sunny" | "Mostly Clear" | "Partly Cloudy" | "Overcast" | "Foggy" | "Drizzle" | "Rainy" | "Snowy" | "Thunderstorm";

export interface WeatherData {
  city: string;
  temperatureC: number;
  condition: WeatherCondition;
  solarEstimate: SolarEstimate;
  wmoCode: number;
  fetchedAt: number;
  dailyRadiationKWhM2: number;
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    weather_code: number;
  };
  daily: {
    shortwave_radiation_sum: number[];
  };
}

function wmoToCondition(code: number): { condition: WeatherCondition; estimate: SolarEstimate } {
  if (code === 0) return { condition: "Sunny", estimate: "Excellent" };
  if (code === 1) return { condition: "Mostly Clear", estimate: "Excellent" };
  if (code === 2) return { condition: "Partly Cloudy", estimate: "Good" };
  if (code === 3) return { condition: "Overcast", estimate: "Low" };
  if (code === 45 || code === 48) return { condition: "Foggy", estimate: "Low" };
  if (code >= 51 && code <= 57) return { condition: "Drizzle", estimate: "Low" };
  if (code >= 61 && code <= 67) return { condition: "Rainy", estimate: "Poor" };
  if (code >= 71 && code <= 77) return { condition: "Snowy", estimate: "Low" };
  if (code >= 80 && code <= 82) return { condition: "Rainy", estimate: "Poor" };
  if (code === 85 || code === 86) return { condition: "Snowy", estimate: "Low" };
  if (code >= 95) return { condition: "Thunderstorm", estimate: "Poor" };
  return { condition: "Partly Cloudy", estimate: "Good" };
}

function cacheKey(city: string) {
  return `weather_cache_${city.toLowerCase().replace(/\s+/g, "_")}`;
}

async function loadCache(city: string): Promise<WeatherData | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(city));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeatherData;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    if (parsed.city !== city) return null;
    if (parsed.dailyRadiationKWhM2 === undefined) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function saveCache(data: WeatherData) {
  try {
    await AsyncStorage.setItem(cacheKey(data.city), JSON.stringify(data));
  } catch {}
}

async function fetchWeather(city: string): Promise<WeatherData> {
  const info = getCityInfo(city);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${info.lat}&longitude=${info.lon}&current=temperature_2m,weather_code&daily=shortwave_radiation_sum&timezone=auto&forecast_days=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
  const json: OpenMeteoResponse = await res.json();
  const { condition, estimate } = wmoToCondition(json.current.weather_code);
  const rawRadiation = json.daily?.shortwave_radiation_sum?.[0] ?? 0;
  const dailyRadiationKWhM2 = parseFloat((rawRadiation / 3.6).toFixed(2));
  const data: WeatherData = {
    city,
    temperatureC: Math.round(json.current.temperature_2m),
    condition,
    solarEstimate: estimate,
    wmoCode: json.current.weather_code,
    fetchedAt: Date.now(),
    dailyRadiationKWhM2,
  };
  await saveCache(data);
  return data;
}

export interface UseWeatherResult {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useWeather(city: string): UseWeatherResult {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fetchingRef = useRef(false);

  async function doFetch(forceRefresh: boolean) {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (!forceRefresh) {
      const cached = await loadCache(city);
      if (cached) {
        setWeather(cached);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }
    }

    try {
      const data = await fetchWeather(city);
      setWeather(data);
      setError(null);
      setLoading(false);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Weather unavailable");
      setLoading(false);
    } finally {
      fetchingRef.current = false;
    }
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    setWeather(null);
    doFetch(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, tick]);

  useEffect(() => {
    const checkAndRefresh = () => {
      if (weather && Date.now() - weather.fetchedAt >= CACHE_TTL_MS) {
        doFetch(true);
      }
    };

    const interval = setInterval(checkAndRefresh, CACHE_TTL_MS);

    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        checkAndRefresh();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather, city]);

  return {
    weather,
    loading,
    error,
    refresh: () => setTick((t) => t + 1),
  };
}
