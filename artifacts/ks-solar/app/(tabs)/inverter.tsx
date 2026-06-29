import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandCard, Brand } from "@/components/BrandCard";
import { LoginPrompt } from "@/components/LoginPrompt";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

const hapticLight = () => { if (Platform.OS !== "web") Haptics.selectionAsync(); };

// Realistic Chrome mobile UA — prevents most bot-detection blocks including Cloudflare
const CHROME_MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

const ALL_INVERTER_BRANDS: Brand[] = [
  {
    id: "livoltek",
    name: "Livoltek",
    country: "China",
    portalUrl: "https://www.livoltek-portal.com/#/",
    iconName: "zap",
    color: "#F59E0B",
    logoUrl: "https://logo.clearbit.com/livoltek.com",
  },
  {
    id: "solarman",
    name: "Solarman Smart",
    country: "Deye · Sunsynk · KStar · Sol-Ark · Hinen · LuxPower",
    portalUrl: "https://home.solarmanpv.com/login",
    iconName: "sun",
    color: "#EF4444",
    logoUrl: "https://logo.clearbit.com/solarmanpv.com",
  },
  {
    id: "goodwe",
    name: "GoodWe (SEMS+)",
    country: "China",
    portalUrl: "https://semsplus.goodwe.com/#/login",
    iconName: "cpu",
    color: "#3B82F6",
    logoUrl: "https://logo.clearbit.com/goodwe.com",
  },
  {
    id: "solarmax",
    name: "Solar Max",
    country: "Cloud Inverter",
    portalUrl: "https://www.cloudinverter.net/dist/#/login/index",
    iconName: "cloud",
    color: "#0EA5E9",
    logoUrl: "https://www.google.com/s2/favicons?domain=cloudinverter.net&sz=128",
  },
  {
    id: "solarmax-hybrid",
    name: "Solarmax Hybrid",
    country: "Inteless",
    portalUrl: "https://pv.inteless.com/login",
    iconName: "battery-charging",
    color: "#10B981",
    logoUrl: "https://logo.clearbit.com/inteless.com",
  },
  {
    id: "auxol",
    name: "Auxol",
    country: "China",
    portalUrl: "https://www.auxsolcloud.com/#/login?redirect=%2Findex",
    iconName: "shield",
    color: "#8B5CF6",
    logoUrl: "https://www.google.com/s2/favicons?domain=auxsolcloud.com&sz=128",
  },
  {
    id: "sigenergy",
    name: "Sigenergy",
    country: "EU Cloud",
    portalUrl: "https://web-eu.sigencloud.com/user/login",
    iconName: "radio",
    color: "#F97316",
    logoUrl: "https://logo.clearbit.com/sigenergy.com",
  },
  {
    id: "huawei",
    name: "Huawei FusionSolar",
    country: "China",
    portalUrl: "https://intl.fusionsolar.huawei.com/",
    iconName: "globe",
    color: "#EF4444",
    logoUrl: "https://logo.clearbit.com/huawei.com",
  },
  {
    id: "growatt",
    name: "Growatt",
    country: "China",
    portalUrl: "https://server.growatt.com/",
    iconName: "trending-up",
    color: "#10B981",
    logoUrl: "https://logo.clearbit.com/growatt.com",
  },
  {
    id: "solaredge",
    name: "SolarEdge",
    country: "Israel",
    portalUrl: "https://monitoring.solaredge.com/",
    iconName: "bar-chart-2",
    color: "#6366F1",
    logoUrl: "https://logo.clearbit.com/solaredge.com",
  },
  {
    id: "fronius",
    name: "Fronius",
    country: "Austria",
    portalUrl: "https://www.solarweb.com/",
    iconName: "monitor",
    color: "#EC4899",
    logoUrl: "https://logo.clearbit.com/fronius.com",
  },
  {
    id: "itel",
    name: "iTeL Energy Hybrid",
    country: "Pakistan",
    portalUrl: "https://ims.itelenergy.net/",
    iconName: "zap-off",
    color: "#06B6D4",
    logoUrl: "https://logo.clearbit.com/itelenergy.net",
  },
  {
    id: "inverex",
    name: "Inverex",
    country: "Pakistan",
    portalUrl: "https://ive.inverex.pk/",
    iconName: "activity",
    color: "#14B8A6",
    logoUrl: "https://logo.clearbit.com/inverex.pk",
  },
];

function PortalWebView({
  brand,
  onBack,
  showBack,
}: {
  brand: Brand;
  onBack: () => void;
  showBack: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const webViewRef = useRef<WebView>(null);

  function reload() {
    setError(false);
    setLoading(true);
    webViewRef.current?.reload();
  }

  return (
    <View style={[styles.wvContainer, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.wvHeader,
          { paddingTop: topPad + 10, backgroundColor: brand.color },
        ]}
      >
        <View style={styles.wvHeaderRow}>
          {showBack && (
            <TouchableOpacity
              style={[styles.wvBackBtn, { backgroundColor: "#FFFFFF22" }]}
              onPress={() => { hapticLight(); onBack(); }}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.wvTitle}>{brand.name}</Text>
            <Text style={styles.wvSub}>Monitoring Portal</Text>
          </View>
          <TouchableOpacity
            style={[styles.wvReloadBtn, { backgroundColor: "#FFFFFF22" }]}
            onPress={reload}
            activeOpacity={0.7}
          >
            <Feather name="refresh-cw" size={16} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={[styles.liveDot, { backgroundColor: loading ? "#FFFFFF66" : "#FFFFFF" }]}>
            <View style={[styles.liveDotInner, { backgroundColor: loading ? "#F59E0B" : "#10B981" }]} />
          </View>
        </View>
      </View>

      {/* WebView or iframe for web */}
      {Platform.OS === "web" ? (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Open in browser bar */}
          <View style={[styles.webActionBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={[styles.webActionNote, { color: colors.mutedForeground }]}>
              Some portals block embedding — use the button if it doesn't load.
            </Text>
            <TouchableOpacity
              style={[styles.webOpenBtn, { backgroundColor: brand.color }]}
              onPress={() => Linking.openURL(brand.portalUrl).catch(() => {})}
              activeOpacity={0.85}
            >
              <Feather name="external-link" size={13} color="#FFFFFF" />
              <Text style={styles.webOpenBtnText}>Open</Text>
            </TouchableOpacity>
          </View>
          {React.createElement("iframe", {
            src: brand.portalUrl,
            title: brand.name,
            style: { flex: 1, width: "100%", height: "100%", border: "none", display: "block" },
            allow: "autoplay; encrypted-media; fullscreen",
          })}
        </View>
      ) : error ? (
        <View style={[styles.errorView, { backgroundColor: colors.background }]}>
          <Feather name="wifi-off" size={48} color={colors.mutedForeground} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Could not load portal</Text>
          <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>
            Check your internet connection and try again.
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: brand.color }]}
            onPress={reload}
            activeOpacity={0.85}
          >
            <Feather name="refresh-cw" size={16} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {loading && (
            <View style={[styles.wvLoader, { backgroundColor: colors.background }]}>
              <View style={[styles.wvLoaderIconWrap, { backgroundColor: brand.color + "18" }]}>
                <Feather name={brand.iconName as keyof typeof Feather.glyphMap} size={36} color={brand.color} />
              </View>
              <ActivityIndicator size="large" color={brand.color} style={{ marginTop: 20 }} />
              <Text style={[styles.wvLoadingText, { color: colors.mutedForeground }]}>
                Loading {brand.name}...
              </Text>
            </View>
          )}
          <WebView
            ref={webViewRef}
            source={{ uri: brand.portalUrl }}
            style={styles.wv}
            userAgent={CHROME_MOBILE_UA}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            mixedContentMode="always"
            onLoadStart={() => { setLoading(true); setError(false); }}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            onHttpError={(e) => {
              // Only treat hard errors as failures; redirect/auth pages are fine
              if (e.nativeEvent.statusCode >= 500) {
                setLoading(false);
                setError(true);
              }
            }}
          />
        </View>
      )}
    </View>
  );
}

export default function InverterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!user) {
    return (
      <LoginPrompt
        icon="activity"
        title="Inverter Monitoring"
        message="Login to your account to monitor your solar inverter status and performance."
      />
    );
  }

  const showAll = user?.isAdmin || user?.isMaster;
  const visibleBrands = showAll
    ? ALL_INVERTER_BRANDS
    : ALL_INVERTER_BRANDS.filter((b) => b.id === user?.inverterBrand);

  const singleBrand = !showAll && visibleBrands.length === 1 ? visibleBrands[0] : null;
  const activeBrand = selectedBrand ?? singleBrand ?? null;

  if (activeBrand) {
    return (
      <PortalWebView
        brand={activeBrand}
        onBack={() => setSelectedBrand(null)}
        showBack={showAll || !singleBrand}
      />
    );
  }

  if (!showAll && visibleBrands.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.secondary }]}>
          <Text style={styles.headerTitle}>Inverter Status</Text>
          <Text style={styles.headerSub}>Your inverter monitoring portal</Text>
        </View>
        <View style={styles.emptyState}>
          <Feather name="zap-off" size={52} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Inverter Linked</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No inverter brand was selected during signup. Please contact support to update your account.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.secondary }]}>
        <Text style={styles.headerTitle}>Inverter Status</Text>
        <Text style={[styles.headerSub]}>
          {showAll
            ? "Select an inverter brand to open its monitoring portal"
            : "Tap below to open your inverter monitoring portal"}
        </Text>
      </View>

      <FlatList
        data={visibleBrands}
        keyExtractor={(item) => item.id}
        numColumns={showAll ? 2 : 1}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 100 }]}
        columnWrapperStyle={showAll ? styles.columnWrapper : undefined}
        renderItem={({ item }) => (
          <BrandCard
            brand={item}
            onPress={(b) => { hapticLight(); setSelectedBrand(b); }}
          />
        )}
        ListHeaderComponent={
          <View style={[styles.infoBox, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "44" }]}>
            <Feather name="monitor" size={16} color={colors.accent} />
            <Text style={[styles.infoText, { color: colors.foreground }]}>
              {showAll
                ? "Master/Admin view — all inverter brands visible. Tap a brand to open its monitoring portal."
                : `Your registered inverter: ${visibleBrands[0]?.name ?? ""}. Tap to open your monitoring portal.`}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { color: "#FFFFFF", fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 4 },
  headerSub: { color: "#FFFFFFCC", fontSize: 13, fontFamily: "Inter_400Regular" },
  listContent: { padding: 16, gap: 12 },
  columnWrapper: { justifyContent: "space-between" },
  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 14 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  // WebView portal
  wvContainer: { flex: 1 },
  wvHeader: { paddingHorizontal: 16, paddingBottom: 14 },
  wvHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  wvBackBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  wvReloadBtn: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  wvTitle: { color: "#FFFFFF", fontSize: 17, fontFamily: "Inter_700Bold" },
  wvSub: { color: "#FFFFFFAA", fontSize: 11, fontFamily: "Inter_400Regular" },
  liveDot: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  liveDotInner: { width: 8, height: 8, borderRadius: 4 },
  wv: { flex: 1 },
  wvLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center", zIndex: 10, gap: 0,
  },
  wvLoaderIconWrap: {
    width: 80, height: 80, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  wvLoadingText: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 12 },
  // Error
  errorView: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 14 },
  errorTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  errorSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 4,
  },
  retryBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
  // Web iframe action bar
  webActionBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1,
  },
  webActionNote: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular" },
  webOpenBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  webOpenBtnText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
