import * as Device from "expo-device";
import { Platform } from "react-native";

// expo-notifications is not supported in Expo Go on SDK 53+.
// Imported dynamically so a module-level error does not crash the app.
let Notifications: typeof import("expo-notifications") | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require("expo-notifications");

  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // Running in Expo Go — push notifications unavailable, silently skip
}

export async function registerForPushNotificationsAsync(
  authToken: string,
  apiBase: string
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;
  if (!Notifications) return null;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "K&S Solar",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#E27D00",
        sound: "default",
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    const { data: pushToken } = await Notifications.getExpoPushTokenAsync();

    await fetch(`${apiBase}/auth/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ pushToken }),
    });

    return pushToken;
  } catch {
    return null;
  }
}
