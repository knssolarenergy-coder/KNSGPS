import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "solar_system_kw";

export function useSolarSystem(): {
  systemKw: number | null;
  setSystemKw: (kw: number | null) => Promise<void>;
  loading: boolean;
} {
  const [systemKw, setLocalKw] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((val) => {
      setLocalKw(val ? parseFloat(val) : null);
      setLoading(false);
    });
  }, []);

  const setSystemKw = async (kw: number | null) => {
    setLocalKw(kw);
    if (kw === null) {
      await AsyncStorage.removeItem(KEY);
    } else {
      await AsyncStorage.setItem(KEY, kw.toString());
    }
  };

  return { systemKw, setSystemKw, loading };
}
