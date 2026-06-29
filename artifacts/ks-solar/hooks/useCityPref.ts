import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { DEFAULT_CITY } from "@/utils/cities";

const CITY_KEY = "weather_city_pref";

export function useCityPref(profileCity?: string | null): {
  city: string;
  setCity: (city: string) => Promise<void>;
  initialized: boolean;
} {
  const [city, setLocalCity] = useState<string>(DEFAULT_CITY);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CITY_KEY).then((stored) => {
      setLocalCity(stored ?? profileCity ?? DEFAULT_CITY);
      setInitialized(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCity = async (newCity: string) => {
    setLocalCity(newCity);
    await AsyncStorage.setItem(CITY_KEY, newCity);
  };

  return { city, setCity, initialized };
}
