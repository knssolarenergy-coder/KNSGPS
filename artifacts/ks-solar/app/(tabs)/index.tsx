import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { getGetBookingStatsQueryKey, getGetReferralStatsQueryKey, getGetWarrantiesQueryKey, useGetBookingStats, useGetReferralStats, useGetSettings, useGetWarranties, useUpdateMe } from "@workspace/api-client-react";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SolarProductionWidget } from "@/components/SolarProductionWidget";
import { WeatherWidget } from "@/components/WeatherWidget";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useCityPref } from "@/hooks/useCityPref";
import { useSolarSystem } from "@/hooks/useSolarSystem";
import { useWeather } from "@/hooks/useWeather";
import { PAKISTANI_CITIES } from "@/utils/cities";

type ServiceItem = {
  title: string;
  sub: string;
  icon: keyof typeof Feather.glyphMap;
  bg: string;
  iconColor?: string;
  route: string;
  full?: boolean;
  isPrompt?: boolean;
};

function openWhatsApp(phone: string, message: string) {
  const clean = phone.replace(/\D/g, "");
  const url = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  Linking.openURL(url).catch(() => {});
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data: stats } = useGetBookingStats({ query: { queryKey: getGetBookingStatsQueryKey(), enabled: !!user && !user.isAdmin } });
  const { data: referralData } = useGetReferralStats({ query: { queryKey: getGetReferralStatsQueryKey(), enabled: !!user && !user.isAdmin } });
  const { data: settings } = useGetSettings();
  const { data: warranties } = useGetWarranties(undefined, {
    query: { queryKey: getGetWarrantiesQueryKey(), enabled: !!user && !user.isAdmin },
  });

  const { city: weatherCity, setCity: setWeatherCity } = useCityPref(
    user && !user.isAdmin ? (user.city ?? undefined) : undefined
  );
  const { systemKw, setSystemKw } = useSolarSystem();
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const { mutate: updateMe } = useUpdateMe({});

  const { weather, loading: weatherLoading, error: weatherError, refresh: refreshWeather } = useWeather(weatherCity);

  async function handleCityChange(newCity: string) {
    await setWeatherCity(newCity);
    setCityModalOpen(false);
    if (user && !user.isAdmin) {
      updateMe({ data: { name: user.name, phone: user.phone, city: newCity } });
    }
  }

  const expiringSoon = (warranties ?? []).filter((w) => w.warrantyStatus === "expiring_soon").length;
  const expired = (warranties ?? []).filter((w) => w.warrantyStatus === "expired").length;
  const warrantyAlerts = expiringSoon + expired;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const supportPhone = settings?.find((s) => s.key === "whatsapp_support")?.value ?? "923001234567";
  const aiSupportEnabled = settings === undefined ? true : (settings.find((s) => s.key === "ai_support_enabled")?.value !== "false");
  const aiSupportPhone = settings?.find((s) => s.key === "whatsapp_ai_support")?.value ?? supportPhone;

  const contactPhone = settings?.find((s) => s.key === "contact_phone")?.value ?? "";
  const contactEmail = settings?.find((s) => s.key === "contact_email")?.value ?? "";
  const contactAddress = settings?.find((s) => s.key === "contact_address")?.value ?? "";
  const contactHours = settings?.find((s) => s.key === "contact_hours")?.value ?? "";

  const socialLinks = [
    { key: "social_instagram", label: "Instagram", icon: "instagram" as const, color: "#E1306C" },
    { key: "social_facebook", label: "Facebook", icon: "facebook-f" as const, color: "#1877F2" },
    { key: "social_tiktok", label: "TikTok", icon: "tiktok" as const, color: "#010101" },
    { key: "social_linkedin", label: "LinkedIn", icon: "linkedin-in" as const, color: "#0A66C2" },
    { key: "social_youtube", label: "YouTube", icon: "youtube" as const, color: "#FF0000" },
    { key: "social_website", label: "Website", icon: "globe" as const, color: "#6366F1" },
  ]
    .map((s) => ({ ...s, url: settings?.find((x) => x.key === s.key)?.value ?? "" }))
    .filter((s) => s.url.trim() !== "");

  const contactRows = [
    contactPhone && { icon: "phone" as const, text: contactPhone },
    contactEmail && { icon: "mail" as const, text: contactEmail },
    contactAddress && { icon: "map-pin" as const, text: contactAddress },
    contactHours && { icon: "clock" as const, text: contactHours },
  ].filter(Boolean) as { icon: "phone" | "mail" | "map-pin" | "clock"; text: string }[];

  // Admin and technicians always see the real inverter card; only gate customers
  const hasInverterBrand = !!(user?.isAdmin || user?.role === "technician" || user?.inverterBrand);

  const services: ServiceItem[] = [
    hasInverterBrand
      ? {
          title: "Inverter Status",
          sub: "Check your system live",
          icon: "activity",
          bg: "#EFF6FF",
          iconColor: "#2563EB",
          route: "/(tabs)/inverter",
        }
      : {
          title: "Inverter Status",
          sub: "Set brand in profile first",
          icon: "activity",
          bg: "#F1F5F9",
          iconColor: "#94A3B8",
          route: "/(tabs)/account",
          isPrompt: true,
        },
    {
      title: "Solar Panels Washing",
      sub: "Book cleaning service",
      icon: "droplet",
      bg: "#ECFEFF",
      iconColor: "#0891B2",
      route: "/(tabs)/booking",
    },
    {
      title: "Installation",
      sub: "Get a free quotation",
      icon: "tool",
      bg: "#FFFBEB",
      iconColor: "#D97706",
      route: "/(tabs)/installation",
    },
    {
      title: "Solar System Complaints",
      sub: "Report an issue",
      icon: "alert-circle",
      bg: "#FFF1F2",
      iconColor: "#E11D48",
      route: "/(tabs)/complaint",
    },
  ];

  // ── Technician Home (simplified dashboard) ──
  if (user?.role === "technician") {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.hero, {
          paddingTop: topPad + 16,
          backgroundColor: "#FFFFFF",
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.07,
          shadowRadius: 16,
          elevation: 5,
        }]}>
          {/* Top accent stripe */}
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, backgroundColor: colors.secondary }} />

          {/* Top row: logout | centered logo | tool badge */}
          <View style={styles.heroTopRow}>
            <TouchableOpacity
              style={[styles.logoutBtn, { backgroundColor: "#EFF6FF" }]}
              onPress={logout}
              activeOpacity={0.7}
            >
              <Feather name="log-out" size={17} color={colors.secondary} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "center" }}>
              <View style={{
                backgroundColor: "#FFFFFF", borderRadius: 16,
                paddingHorizontal: 16, paddingVertical: 10,
                shadowColor: "#0C4A6E", shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
                borderWidth: 1.5, borderColor: "#BAE6FD",
              }}>
                <Image
                  source={require("@/assets/images/logo.png")}
                  style={{ width: 130, height: 50 }}
                  resizeMode="contain"
                />
              </View>
            </View>
            <View style={[styles.logoutBtn, { backgroundColor: colors.secondary + "15", borderRadius: 10, alignItems: "center", justifyContent: "center" }]}>
              <Feather name="tool" size={16} color={colors.secondary} />
            </View>
          </View>

          {/* Welcome */}
          <View style={{ alignItems: "center", paddingBottom: 24, gap: 2, marginTop: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 }}>
              <Feather name="briefcase" size={11} color={colors.secondary} />
              <Text style={{ color: colors.secondary, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.3, textTransform: "uppercase" }}>
                Technician Portal
              </Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>
              Welcome back,
            </Text>
            <Text style={{ color: colors.foreground, fontSize: 20, fontFamily: "Inter_700Bold", marginTop: 2 }}>
              {user.name} 🔧
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 18, gap: 12 }}>
          {/* My Jobs quick access */}
          <TouchableOpacity
            style={[styles.serviceFullCard, { backgroundColor: colors.secondary }]}
            onPress={() => router.push("/(tabs)/technician")}
            activeOpacity={0.85}
          >
            <View style={[styles.serviceIcon, { backgroundColor: "#FFFFFF22" }]}>
              <Feather name="briefcase" size={26} color="#FFFFFF" />
            </View>
            <View style={styles.serviceFullText}>
              <Text style={[styles.serviceCardTitle, { color: "#FFFFFF" }]}>My Jobs</Text>
              <Text style={[styles.serviceCardSub, { color: "#FFFFFFCC" }]}>View and manage your assigned bookings & complaints</Text>
            </View>
            <Feather name="chevron-right" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {/* WhatsApp Support */}
          <TouchableOpacity
            style={[styles.serviceFullCard, { backgroundColor: "#25D366" }]}
            onPress={() => openWhatsApp(supportPhone, "Hi K&S Solar Energy, I need support.")}
            activeOpacity={0.85}
          >
            <View style={[styles.serviceIcon, { backgroundColor: "#FFFFFF22" }]}>
              <Feather name="message-circle" size={26} color="#FFFFFF" />
            </View>
            <View style={styles.serviceFullText}>
              <Text style={[styles.serviceCardTitle, { color: "#FFFFFF" }]}>WhatsApp Support</Text>
              <Text style={[styles.serviceCardSub, { color: "#FFFFFFCC" }]}>Contact admin or office via WhatsApp</Text>
            </View>
            <Feather name="chevron-right" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Social Links */}
        {socialLinks.length > 0 && (
          <View style={[styles.socialCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 14 }]}>Follow Us</Text>
            <View style={styles.socialGrid}>
              {socialLinks.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.socialBtn, { backgroundColor: s.color + "15", borderColor: s.color + "44" }]}
                  onPress={() => Linking.openURL(s.url).catch(() => {})}
                  activeOpacity={0.8}
                >
                  <View style={[styles.socialBtnIcon, { backgroundColor: s.color }]}>
                    <FontAwesome5 name={s.icon} size={16} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.socialBtnLabel, { color: colors.foreground }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Contact */}
        {contactRows.length > 0 && (
          <View style={[styles.contactCard, { backgroundColor: colors.secondary }]}>
            <Text style={styles.contactTitle}>Contact Us</Text>
            {contactRows.map((c) => (
              <View key={c.text} style={styles.contactRow}>
                <Feather name={c.icon} size={15} color="#FFFFFF88" />
                <Text style={styles.contactText}>{c.text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: "#0C4A6E" }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Decorative background circles */}
      <View pointerEvents="none" style={{ position: "absolute", top: 170, right: -55, width: 250, height: 250, borderRadius: 125, backgroundColor: "#FFFFFF10" }} />
      <View pointerEvents="none" style={{ position: "absolute", top: 460, left: -75, width: 200, height: 200, borderRadius: 100, backgroundColor: "#FFFFFF08" }} />
      <View pointerEvents="none" style={{ position: "absolute", top: 750, right: -40, width: 170, height: 170, borderRadius: 85, backgroundColor: "#FFFFFF07" }} />
      <View pointerEvents="none" style={{ position: "absolute", top: 320, right: -20, width: 90, height: 90, borderRadius: 45, backgroundColor: "#FFFFFF0D" }} />

      {/* ── Hero ── */}
      <View style={[styles.hero, { paddingTop: topPad + 16, backgroundColor: "#FFFFFF", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }]}>
        {/* Top accent stripe */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, backgroundColor: "#0891B2", borderTopLeftRadius: 0, borderTopRightRadius: 0 }} />

        <View style={styles.heroTopRow}>
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: "#EFF6FF" }]}
            onPress={logout}
            activeOpacity={0.7}
          >
            <Feather name="log-out" size={17} color="#0891B2" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <View style={{
              backgroundColor: "#FFFFFF", borderRadius: 20,
              paddingHorizontal: 20, paddingVertical: 12,
              shadowColor: "#0C4A6E", shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.22, shadowRadius: 18, elevation: 10,
              borderWidth: 1.5, borderColor: "#BAE6FD",
            }}>
              <Image
                source={require("@/assets/images/logo.png")}
                style={{ width: 155, height: 60 }}
                resizeMode="contain"
              />
            </View>
          </View>
          {aiSupportEnabled ? (
            <TouchableOpacity
              style={{
                backgroundColor: "#25D366", borderRadius: 14,
                paddingHorizontal: 8, paddingVertical: 8,
                alignItems: "center", gap: 2,
                shadowColor: "#25D366", shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
                minWidth: 48,
              }}
              onPress={() => openWhatsApp(aiSupportPhone, "Hi K&S Solar Energy, I need AI support.")}
              activeOpacity={0.85}
            >
              <Feather name="message-circle" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 9, fontFamily: "Inter_700Bold", textAlign: "center", lineHeight: 12 }}>{"AI\nChat"}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 48 }} />
          )}
        </View>

        <View style={{ alignItems: "center", paddingBottom: user && !user.isAdmin ? 60 : 24, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <Feather name="sun" size={11} color="#0891B2" />
            <Text style={{ color: "#0891B2", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.3, textTransform: "uppercase" }}>
              Clean Energy Solutions
            </Text>
          </View>
          <Text style={{ color: "#64748B", fontSize: 13, fontFamily: "Inter_400Regular" }}>
            {user ? "Welcome back," : "Browse our services"}
          </Text>
          {user && (
            <Text style={{ color: "#0F172A", fontSize: 20, fontFamily: "Inter_700Bold", marginTop: 2 }}>
              {user.name}{user.isAdmin ? " 👑" : ""}
            </Text>
          )}
        </View>
      </View>

      {/* ── Stats (logged-in non-admin customers only) ── */}
      {user && !user.isAdmin && (
        <View style={{ marginHorizontal: 16, marginTop: -44, marginBottom: 8 }}>
          <TouchableOpacity
            onPress={() => router.push("/bookings" as never)}
            activeOpacity={0.95}
            style={{ backgroundColor: "#FFFFFF", borderRadius: 20, paddingVertical: 14, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", shadowColor: "#0F172A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4, borderWidth: 1, borderColor: "#F1F5F9" }}
          >
            {[
              { num: stats?.total ?? 0, label: "Total Orders", color: "#0F172A" },
              { num: stats?.pending ?? 0, label: "Pending", color: "#D97706" },
              { num: stats?.completed ?? 0, label: "Completed", color: "#059669" },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <View style={{ width: 1, height: 36, backgroundColor: "#E2E8F0" }} />}
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: s.color }}>{s.num}</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#64748B", marginTop: 2 }}>{s.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Weather Widget + Solar Estimate (customers only) ── */}
      {!user?.isAdmin && (
        <View style={styles.weatherSection}>
          <WeatherWidget
            city={weatherCity}
            weather={weather}
            loading={weatherLoading}
            error={weatherError}
            onRefresh={refreshWeather}
            onCityPress={() => setCityModalOpen(true)}
          />
          <SolarProductionWidget
            dailyRadiationKWhM2={weather?.dailyRadiationKWhM2 ?? null}
            systemKw={systemKw}
            onSetSystemKw={setSystemKw}
          />
        </View>
      )}

      {/* ── Services grid ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: "#FFFFFF" }]}>Our Services</Text>

        <View style={styles.servicesGrid}>
          {services.map((service) => (
            <TouchableOpacity
              key={service.title}
              style={[styles.serviceGridCard, { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", opacity: service.isPrompt ? 0.75 : 1 }]}
              onPress={() => router.push(service.route as Parameters<typeof router.push>[0])}
              activeOpacity={0.85}
            >
              <View style={[styles.serviceGridIcon, { backgroundColor: service.bg }]}>
                <Feather name={service.isPrompt ? "lock" : service.icon} size={22} color={service.iconColor ?? "#0F172A"} />
              </View>
              <Text style={[styles.serviceGridTitle, { color: colors.foreground }]}>{service.title}</Text>
              <Text style={[styles.serviceGridSub, { color: colors.mutedForeground }]}>{service.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Solar Calculator — full width */}
        <TouchableOpacity
          style={[styles.serviceFullCard, { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" }]}
          onPress={() => router.push("/(tabs)/calculator")}
          activeOpacity={0.85}
        >
          <View style={[styles.serviceIcon, { backgroundColor: "#FFFBEB" }]}>
            <Feather name="percent" size={22} color="#D97706" />
          </View>
          <View style={styles.serviceFullText}>
            <Text style={[styles.serviceCardTitle, { color: colors.foreground }]}>Solar Calculator</Text>
            <Text style={[styles.serviceCardSub, { color: colors.mutedForeground }]}>Estimate system size & savings instantly</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* Warranty Search — full width, visible to everyone including guests */}
        <TouchableOpacity
          style={[styles.serviceFullCard, { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" }]}
          onPress={() => router.push("/warranty-search")}
          activeOpacity={0.85}
        >
          <View style={[styles.serviceIcon, { backgroundColor: "#EFF6FF" }]}>
            <Feather name="search" size={22} color="#2563EB" />
          </View>
          <View style={styles.serviceFullText}>
            <Text style={[styles.serviceCardTitle, { color: colors.foreground }]}>Warranty Search</Text>
            <Text style={[styles.serviceCardSub, { color: colors.mutedForeground }]}>Check warranty status by invoice number</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* My Warranties — full width, only for non-admin logged-in users */}
        {user && !user.isAdmin && warranties !== undefined && (
          <TouchableOpacity
            style={[styles.serviceFullCard, { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" }]}
            onPress={() => router.push("/warranties")}
            activeOpacity={0.85}
          >
            <View style={[styles.serviceIcon, { backgroundColor: warrantyAlerts > 0 ? (expired > 0 ? "#FEF2F2" : "#FFFBEB") : "#F0FDF4" }]}>
              <Feather name="shield" size={22} color={warrantyAlerts > 0 ? (expired > 0 ? "#E11D48" : "#D97706") : "#059669"} />
            </View>
            <View style={styles.serviceFullText}>
              <Text style={[styles.serviceCardTitle, { color: colors.foreground }]}>My Warranties</Text>
              <Text style={[styles.serviceCardSub, { color: colors.mutedForeground }]}>
                {warranties.length === 0
                  ? "No warranties registered yet"
                  : warrantyAlerts > 0
                    ? `${warrantyAlerts} warrant${warrantyAlerts === 1 ? "y needs" : "ies need"} attention`
                    : `${warranties.length} warrant${warranties.length === 1 ? "y" : "ies"} active`
                }
              </Text>
            </View>
            {warrantyAlerts > 0 && (
              <View style={[styles.warningBadge, { backgroundColor: expired > 0 ? "#FEF2F2" : "#FFFBEB" }]}>
                <Text style={[styles.warningBadgeText, { color: expired > 0 ? "#E11D48" : "#D97706" }]}>{warrantyAlerts}</Text>
              </View>
            )}
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        {/* Referral Card — visible to logged-in customers when referral system is enabled */}
        {user && !user.isAdmin && referralData?.enabled && referralData.code && (
          <View style={[styles.referralCard, { backgroundColor: "#0F766E" }]}>
            <View style={styles.referralTop}>
              <View style={[styles.referralIconWrap, { backgroundColor: "#FFFFFF18" }]}>
                <Feather name="gift" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.referralTitle}>Referral Program</Text>
                <Text style={styles.referralSub}>Share your code — earn bonus points</Text>
              </View>
            </View>

            <View style={[styles.referralCodeBox, { backgroundColor: "#FFFFFF14" }]}>
              <Text style={styles.referralCodeLabel}>Your Code</Text>
              <Text style={styles.referralCode}>{referralData.code}</Text>
            </View>

            <View style={styles.referralStatsRow}>
              <View style={[styles.referralStat, { backgroundColor: "#FFFFFF14" }]}>
                <Feather name="star" size={14} color="#FCD34D" />
                <Text style={styles.referralStatNum}>{referralData.points}</Text>
                <Text style={styles.referralStatLabel}>Points</Text>
              </View>
              <View style={[styles.referralStat, { backgroundColor: "#FFFFFF14" }]}>
                <Feather name="users" size={14} color="#6EE7B7" />
                <Text style={styles.referralStatNum}>{referralData.referralCount}</Text>
                <Text style={styles.referralStatLabel}>Referrals</Text>
              </View>
              <View style={[styles.referralStat, { backgroundColor: "#FFFFFF14" }]}>
                <Feather name="dollar-sign" size={14} color="#FCD34D" />
                <Text style={styles.referralStatNum}>PKR {referralData.balance}</Text>
                <Text style={styles.referralStatLabel}>Balance</Text>
              </View>
            </View>

            <View style={styles.referralBtnRow}>
              <TouchableOpacity
                style={[styles.referralBtn, { backgroundColor: "#FFFFFF22" }]}
                onPress={async () => {
                  await Clipboard.setStringAsync(referralData.code!);
                  Alert.alert("Copied!", `Referral code ${referralData.code} copied to clipboard.`);
                }}
                activeOpacity={0.8}
              >
                <Feather name="copy" size={14} color="#FFFFFF" />
                <Text style={styles.referralBtnText}>Copy Code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.referralBtn, { backgroundColor: "#FFFFFF22" }]}
                onPress={() => Share.share({
                  message: `Join K&S Solar Energy app and use my referral code ${referralData.code} when registering! Download the app from K&S Solar Energy.`,
                  title: "Join K&S Solar Energy",
                })}
                activeOpacity={0.8}
              >
                <Feather name="share-2" size={14} color="#FFFFFF" />
                <Text style={styles.referralBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* WhatsApp Support — full width */}
        <TouchableOpacity
          style={[styles.serviceFullCard, { backgroundColor: "#128C7E", shadowColor: "#128C7E", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 }]}
          onPress={() => openWhatsApp(supportPhone, "Hi K&S Solar Energy, I need support.")}
          activeOpacity={0.85}
        >
          <View style={[styles.serviceIcon, { backgroundColor: "#FFFFFF20" }]}>
            <Feather name="message-circle" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.serviceFullText}>
            <Text style={[styles.serviceCardTitle, { color: "#FFFFFF" }]}>WhatsApp Support</Text>
            <Text style={[styles.serviceCardSub, { color: "#FFFFFFCC" }]}>We typically reply in minutes</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── Why clean panels ── */}
      <View style={[styles.whyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Why Clean Solar Panels?</Text>
        <View style={styles.whyList}>
          {[
            { icon: "trending-up" as const, text: "Up to 30% efficiency boost after cleaning" },
            { icon: "shield" as const, text: "Extends panel lifespan significantly" },
            { icon: "dollar-sign" as const, text: "Saves money on electricity bills" },
            { icon: "sun" as const, text: "Maximum energy output year-round" },
          ].map((item, i) => (
            <View key={i} style={styles.whyItem}>
              <View style={[styles.whyIconCircle, { backgroundColor: colors.primary + "18" }]}>
                <Feather name={item.icon} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.whyText, { color: colors.foreground }]}>{item.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Social Links ── */}
      {socialLinks.length > 0 && (
        <View style={[styles.socialCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 14 }]}>Follow Us</Text>
          <View style={styles.socialGrid}>
            {socialLinks.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.socialBtn, { backgroundColor: s.color + "15", borderColor: s.color + "44" }]}
                onPress={() => Linking.openURL(s.url).catch(() => {})}
                activeOpacity={0.8}
              >
                <View style={[styles.socialBtnIcon, { backgroundColor: s.color }]}>
                  <FontAwesome5 name={s.icon} size={16} color="#FFFFFF" />
                </View>
                <Text style={[styles.socialBtnLabel, { color: colors.foreground }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Contact ── */}
      {contactRows.length > 0 && (
        <View style={[styles.contactCard, { backgroundColor: colors.secondary }]}>
          <Text style={styles.contactTitle}>Contact Us</Text>
          {contactRows.map((c) => (
            <View key={c.text} style={styles.contactRow}>
              <Feather name={c.icon} size={15} color="#FFFFFF88" />
              <Text style={styles.contactText}>{c.text}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>

    {/* ── City Picker Modal ── */}
    <Modal
      visible={cityModalOpen}
      animationType="slide"
      transparent
      onRequestClose={() => setCityModalOpen(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select City</Text>
            <TouchableOpacity onPress={() => { setCityModalOpen(false); setCitySearch(""); }} activeOpacity={0.7}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={[styles.citySearchWrap, { borderBottomColor: colors.border }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.citySearchInput, { color: colors.foreground }]}
              placeholder="Search city…"
              placeholderTextColor={colors.mutedForeground}
              value={citySearch}
              onChangeText={setCitySearch}
              autoCorrect={false}
            />
            {citySearch.length > 0 && (
              <TouchableOpacity onPress={() => setCitySearch("")} activeOpacity={0.7}>
                <Feather name="x-circle" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={PAKISTANI_CITIES.filter((c) =>
              c.name.toLowerCase().includes(citySearch.toLowerCase())
            )}
            keyExtractor={(item) => item.name}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const selected = weatherCity === item.name;
              return (
                <TouchableOpacity
                  style={[
                    styles.cityItem,
                    { borderBottomColor: colors.border },
                    selected && { backgroundColor: colors.primary + "12" },
                  ]}
                  onPress={() => { handleCityChange(item.name); setCitySearch(""); }}
                  activeOpacity={0.7}
                >
                  <Feather name="map-pin" size={15} color={selected ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.cityItemText, { color: selected ? colors.primary : colors.foreground }]}>
                    {item.name}
                  </Text>
                  {selected && <Feather name="check" size={15} color={colors.primary} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Hero
  hero: { paddingHorizontal: 20, paddingBottom: 24 },
  heroTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoCircle: { width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  brandName: { color: "#FFFFFF", fontSize: 17, fontFamily: "Inter_700Bold" },
  brandTagline: { color: "#FFFFFF88", fontSize: 11, fontFamily: "Inter_400Regular" },
  logoutBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  welcomeBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  welcomeText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  welcomeName: { fontFamily: "Inter_700Bold" },
  // Stats
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: "center",
  },
  statNumber: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  weatherSection: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  // Services
  section: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 2 },
  servicesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  serviceGridCard: {
    width: "47%", borderRadius: 16, padding: 16, gap: 4, alignItems: "center",
  },
  serviceGridIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center", marginBottom: 6,
  },
  serviceGridTitle: { fontSize: 12, fontFamily: "Inter_700Bold", textAlign: "center" },
  serviceGridSub: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15, textAlign: "center" },
  warningBadge: {
    borderRadius: 12, minWidth: 26, height: 26,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 6, marginRight: 4,
  },
  warningBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  serviceFullCard: {
    borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center",
  },
  serviceIcon: { width: 48, height: 48, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  serviceFullText: { flex: 1, marginLeft: 14, gap: 2 },
  serviceCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  serviceCardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  // Why
  whyCard: {
    margin: 16, borderRadius: 18, borderWidth: 1, padding: 18,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  whyList: { gap: 12, marginTop: 10 },
  whyItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  whyIconCircle: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  whyText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  // Social
  socialCard: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 18, borderWidth: 1, padding: 18,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  socialGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  socialBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1, minWidth: "44%", flex: 1,
  },
  socialBtnIcon: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  socialBtnLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  // Contact
  contactCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 18, padding: 18, gap: 10 },
  contactTitle: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  contactText: { color: "#FFFFFFCC", fontSize: 14, fontFamily: "Inter_400Regular" },
  // Referral card
  referralCard: { borderRadius: 18, padding: 18, gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 5 },
  referralTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  referralIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  referralTitle: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  referralSub: { color: "#FFFFFFBB", fontSize: 12, fontFamily: "Inter_400Regular" },
  referralCodeBox: { borderRadius: 12, padding: 14, alignItems: "center", gap: 4 },
  referralCodeLabel: { color: "#FFFFFFAA", fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 1 },
  referralCode: { color: "#FFFFFF", fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 6 },
  referralStatsRow: { flexDirection: "row", gap: 8 },
  referralStat: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center", gap: 4 },
  referralStatNum: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  referralStatLabel: { color: "#FFFFFFAA", fontSize: 10, fontFamily: "Inter_400Regular" },
  referralBtnRow: { flexDirection: "row", gap: 10 },
  referralBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12 },
  referralBtnText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  // City modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000066" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "65%", paddingBottom: Platform.OS === "ios" ? 40 : 24 },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  cityItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cityItemText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15 },
  citySearchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  citySearchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, paddingVertical: 4 },
});
