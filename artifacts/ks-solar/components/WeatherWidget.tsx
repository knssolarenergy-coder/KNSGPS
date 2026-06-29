import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { SolarEstimate, WeatherCondition } from "@/hooks/useWeather";

const CONDITION_ICONS: Record<WeatherCondition, keyof typeof Feather.glyphMap> = {
  Sunny: "sun",
  "Mostly Clear": "sun",
  "Partly Cloudy": "cloud",
  Overcast: "cloud",
  Foggy: "wind",
  Drizzle: "cloud-drizzle",
  Rainy: "cloud-rain",
  Snowy: "cloud-snow",
  Thunderstorm: "cloud-lightning",
};

const CONDITION_BG: Record<WeatherCondition, string> = {
  Sunny: "#F59E0B",
  "Mostly Clear": "#F59E0B",
  "Partly Cloudy": "#3B82F6",
  Overcast: "#64748B",
  Foggy: "#64748B",
  Drizzle: "#6366F1",
  Rainy: "#3B82F6",
  Snowy: "#94A3B8",
  Thunderstorm: "#7C3AED",
};

const ESTIMATE_COLORS: Record<SolarEstimate, string> = {
  Excellent: "#10B981",
  Good: "#3B82F6",
  Low: "#F59E0B",
  Poor: "#EF4444",
};

const ESTIMATE_LABELS: Record<SolarEstimate, string> = {
  Excellent: "Excellent solar day",
  Good: "Good solar day",
  Low: "Low solar output",
  Poor: "Poor solar day",
};

const SHOW_WARNING: Set<SolarEstimate> = new Set(["Low", "Poor"]);

interface WeatherWidgetProps {
  city: string;
  weather: {
    temperatureC: number;
    condition: WeatherCondition;
    solarEstimate: SolarEstimate;
    fetchedAt: number;
  } | null;
  loading: boolean;
  error: string | null;
  onRefresh?: () => void;
  onCityPress?: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
}

export function WeatherWidget({ city, weather, loading, error, onRefresh, onCityPress }: WeatherWidgetProps) {
  const colors = useColors();

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.secondary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Fetching weather for {city}…
        </Text>
      </View>
    );
  }

  if (error || !weather) {
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={onRefresh}
        activeOpacity={0.8}
      >
        <Feather name="wifi-off" size={18} color={colors.mutedForeground} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Weather unavailable — tap to retry
        </Text>
      </TouchableOpacity>
    );
  }

  const conditionBg = CONDITION_BG[weather.condition] ?? "#3B82F6";
  const conditionIcon = CONDITION_ICONS[weather.condition] ?? "sun";
  const estimateColor = ESTIMATE_COLORS[weather.solarEstimate];
  const estimateLabel = ESTIMATE_LABELS[weather.solarEstimate];
  const showWarning = SHOW_WARNING.has(weather.solarEstimate);

  return (
    <View style={styles.wrapper}>
      {/* Main weather card */}
      <View style={[styles.card, { backgroundColor: conditionBg }]}>
        {/* Left: city + condition */}
        <View style={styles.left}>
          <TouchableOpacity
            style={styles.cityRow}
            onPress={onCityPress}
            activeOpacity={onCityPress ? 0.65 : 1}
            disabled={!onCityPress}
          >
            <Feather name="map-pin" size={12} color="#FFFFFFBB" />
            <Text style={styles.cityName}>{city}</Text>
            {onCityPress && <Feather name="edit-2" size={10} color="#FFFFFFBB" />}
          </TouchableOpacity>
          <Text style={styles.condition}>{weather.condition}</Text>
          <Text style={styles.temp}>{weather.temperatureC}°C</Text>
        </View>

        {/* Center: condition icon */}
        <View style={[styles.iconWrap, { backgroundColor: "#FFFFFF22" }]}>
          <Feather name={conditionIcon} size={36} color="#FFFFFF" />
        </View>

        {/* Right: solar estimate */}
        <View style={styles.right}>
          <View style={[styles.estimateBadge, { backgroundColor: "#FFFFFF22" }]}>
            <Feather name="zap" size={13} color="#FFFFFF" />
            <Text style={styles.estimateText}>{weather.solarEstimate}</Text>
          </View>
          <Text style={styles.estimateLabel}>{estimateLabel}</Text>
          {onRefresh && (
            <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.7}>
              <Feather name="refresh-cw" size={12} color="#FFFFFFAA" />
              <Text style={styles.refreshText}>
                {formatTime(weather.fetchedAt)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Warning banner */}
      {showWarning && (
        <View style={[styles.warningBanner, { backgroundColor: estimateColor + "18", borderColor: estimateColor + "44" }]}>
          <Feather name={weather.solarEstimate === "Poor" ? "alert-triangle" : "info"} size={14} color={estimateColor} />
          <Text style={[styles.warningText, { color: estimateColor }]}>
            {weather.condition === "Thunderstorm"
              ? "Storm today — solar output will be very low"
              : weather.condition === "Rainy"
                ? "Rainy today — expect significantly lower solar output"
                : weather.condition === "Drizzle"
                  ? "Drizzle today — solar panels will produce less energy"
                  : weather.condition === "Foggy"
                    ? "Foggy conditions — reduced sunlight reaching your panels"
                    : weather.condition === "Snowy"
                      ? "Snow today — clear panels if safe to do so"
                      : "Cloudy today — expect lower solar output"}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  card: {
    borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "center",
    gap: 14, borderWidth: 0,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
  },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  left: { flex: 1, gap: 4 },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cityName: { color: "#FFFFFFBB", fontSize: 12, fontFamily: "Inter_500Medium" },
  condition: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_500Medium" },
  temp: { color: "#FFFFFF", fontSize: 38, fontFamily: "Inter_700Bold", lineHeight: 44 },
  iconWrap: { width: 70, height: 70, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  right: { flex: 1, alignItems: "flex-end", gap: 6 },
  estimateBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  estimateText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_700Bold" },
  estimateLabel: { color: "#FFFFFFAA", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right" },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  refreshText: { color: "#FFFFFF77", fontSize: 10, fontFamily: "Inter_400Regular" },
  warningBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  warningText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
});
