import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";

const CALCULATOR_URL = "https://solar-spark-motion.lovable.app";

const CHROME_MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

export default function CalculatorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: "#0F172A" }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: "#F5A62322" }]}>
            <Feather name="percent" size={18} color="#F5A623" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Solar Calculator</Text>
            <Text style={styles.headerSub}>Estimate your solar needs</Text>
          </View>
        </View>
        <View style={styles.navBtns}>
          {canGoBack && (
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => webViewRef.current?.goBack()}
              activeOpacity={0.7}
            >
              <Feather name="chevron-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => { setError(false); setLoading(true); webViewRef.current?.reload(); }}
            activeOpacity={0.7}
          >
            <Feather name="refresh-cw" size={17} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading overlay */}
      {loading && !error && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
          <View style={[styles.loadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.loadingIcon, { backgroundColor: "#F5A62318" }]}>
              <Feather name="percent" size={32} color="#F5A623" />
            </View>
            <Text style={[styles.loadingTitle, { color: colors.foreground }]}>Solar Calculator</Text>
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading calculator...</Text>
            <ActivityIndicator style={{ marginTop: 16 }} size="large" color="#F5A623" />
          </View>
        </View>
      )}

      {/* Error state */}
      {error && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
          <View style={[styles.loadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.loadingIcon, { backgroundColor: "#EF444418" }]}>
              <Feather name="wifi-off" size={32} color="#EF4444" />
            </View>
            <Text style={[styles.loadingTitle, { color: colors.foreground }]}>No Connection</Text>
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Could not load the calculator. Check your internet connection and try again.
            </Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => { setError(false); setLoading(true); webViewRef.current?.reload(); }}
              activeOpacity={0.85}
            >
              <Feather name="refresh-cw" size={15} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* WebView / iframe */}
      {Platform.OS === "web" ? (
        <View style={[styles.webview, { marginBottom: bottomPad, overflow: "hidden" }]}>
          {loading && !error && (
            <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
              <ActivityIndicator size="large" color="#F5A623" />
              <Text style={[styles.loadingText, { color: colors.mutedForeground, marginTop: 12 }]}>
                Loading calculator...
              </Text>
            </View>
          )}
          {React.createElement("iframe", {
            src: CALCULATOR_URL,
            style: {
              width: "100%",
              height: "100%",
              border: "none",
              flex: 1,
              display: "block",
            },
            onLoad: () => setLoading(false),
            onError: () => { setLoading(false); setError(true); },
            allow: "fullscreen",
            title: "Solar Calculator",
          })}
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: CALCULATOR_URL }}
          style={[styles.webview, { marginBottom: bottomPad }]}
          userAgent={CHROME_MOBILE_UA}
          onLoadStart={() => { setLoading(true); setError(false); }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          startInLoadingState={false}
          mixedContentMode="compatibility"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#FFFFFF18",
  },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
  headerSub: { color: "#FFFFFF99", fontSize: 11, fontFamily: "Inter_400Regular" },
  navBtns: { flexDirection: "row", gap: 6 },
  navBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#FFFFFF18",
  },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
    zIndex: 10, padding: 32,
  },
  loadingCard: {
    width: "100%", maxWidth: 320, borderRadius: 20, borderWidth: 1,
    padding: 28, alignItems: "center", gap: 8,
  },
  loadingIcon: {
    width: 68, height: 68, borderRadius: 18,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  loadingTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 12, backgroundColor: "#EF4444",
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  retryBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  webPlaceholder: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32,
  },
  webPlaceholderText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
});
