import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Alert, AppState, Linking, Platform } from "react-native";
import Constants from "expo-constants";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfirmProvider } from "@/components/ConfirmModal";
import { registerForPushNotificationsAsync } from "@/hooks/usePushNotifications";
import { useRouter } from "expo-router";
// Register background location task at app startup — wrapped in try/catch so any
// task-manager init failure never crashes the whole app.
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@/backgroundLocationTask");
  } catch {
    // Silently skip — background tracking unavailable (e.g. Expo Go)
  }
}

if (Platform.OS === "web") {
  if (typeof window !== "undefined") {
    setBaseUrl(window.location.origin);
  }
} else {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const API_BASE =
  Platform.OS === "web" && typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

function PushManager() {
  const { user, token } = useAuth();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !token || Platform.OS === "web") return;
    if (lastUserId.current === user.id) return;
    lastUserId.current = user.id;

    registerForPushNotificationsAsync(token, API_BASE).catch(() => {});
  }, [user?.id, token]);

  return null;
}

function LocationTracker() {
  const { user, token } = useAuth();
  const lastEnsure = useRef<number>(0);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const isTechnician = !!user && user.role === "technician" && !user.isAdmin;
    if (!user || !token || !isTechnician) return;

    // 24/7 always-on tracking. startAlwaysOnTracking() is idempotent and
    // self-healing — it uses a heartbeat to detect a service the OS killed (or
    // one running stale config) and forces a restart. So we (re)verify on login
    // AND on every app foreground, NOT just once: if an aggressive OEM stopped
    // the service while the app was backgrounded, reopening the app brings it
    // back. A short throttle avoids redundant permission churn on rapid
    // foreground events.
    const ensure = () => {
      const now = Date.now();
      if (now - lastEnsure.current < 15_000) return;
      lastEnsure.current = now;
      import("@/backgroundLocationTask")
        .then((m) => m.startAlwaysOnTracking())
        .catch(() => {});
    };
    ensure();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") ensure();
    });
    return () => sub.remove();
  }, [user?.id, token, user?.role, user?.isAdmin]);

  return null;
}

function AppUpdateChecker() {
  const { user } = useAuth();
  const checked = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!user) return;
    if (checked.current) return;
    checked.current = true;

    const currentVersion = Constants.expoConfig?.version ?? "";
    if (!currentVersion) return;

    fetch(`${API_BASE}/settings`)
      .then((r) => r.json())
      .then((settings: { key: string; value: string }[]) => {
        const latest = settings.find((s) => s.key === "app_update_version")?.value ?? "";
        const url = settings.find((s) => s.key === "app_update_url")?.value ?? "";
        if (!latest || !url) return;

        const parseV = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
        const cur = parseV(currentVersion);
        const lat = parseV(latest);
        let isNewer = false;
        for (let i = 0; i < Math.max(cur.length, lat.length); i++) {
          const c = cur[i] ?? 0;
          const l = lat[i] ?? 0;
          if (l > c) { isNewer = true; break; }
          if (l < c) break;
        }
        if (!isNewer) return;

        Alert.alert(
          "Update Available 🚀",
          `A new version (${latest}) of K&S Solar is available. Please update to get the latest features.`,
          [
            { text: "Later", style: "cancel" },
            { text: "Update Now", onPress: () => Linking.openURL(url).catch(() => {}) },
          ],
          { cancelable: true }
        );
      })
      .catch(() => {});
  }, [user?.id]);

  return null;
}

function NotificationObserver() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web") return;
    let sub: { remove: () => void } | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require("expo-notifications") as typeof import("expo-notifications");
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, string> | undefined;
        if (!data?.type) return;
        switch (data.type) {
          case "booking_new":
          case "complaint_new":
          case "quote_new":
            router.push("/(tabs)/admin");
            break;
          case "booking_assigned":
          case "complaint_assigned":
          case "site_visit_assigned":
            router.push("/(tabs)/technician");
            break;
          default:
            break;
        }
      });
    } catch {
      // expo-notifications unavailable (Expo Go) — silently skip
    }
    return () => {
      try { sub?.remove(); } catch { /* ignore */ }
    };
  }, [router]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <AuthProvider>
                <ConfirmProvider>
                  <PushManager />
                  <LocationTracker />
                  <AppUpdateChecker />
                  <NotificationObserver />
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="complaint-detail" />
                  </Stack>
                </ConfirmProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
