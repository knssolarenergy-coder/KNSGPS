import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface LoginPromptProps {
  icon?: React.ComponentProps<typeof Feather>["name"];
  title: string;
  message: string;
}

export function LoginPrompt({ icon = "lock", title, message }: LoginPromptProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "33" }]}>
        <Feather name={icon} size={36} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
      <TouchableOpacity
        style={[styles.loginBtn, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/(auth)/login")}
        activeOpacity={0.85}
      >
        <Feather name="log-in" size={18} color="#FFFFFF" />
        <Text style={styles.loginBtnText}>Login</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.registerBtn, { borderColor: colors.border }]}
        onPress={() => router.push("/(auth)/register")}
        activeOpacity={0.85}
      >
        <Text style={[styles.registerBtnText, { color: colors.mutedForeground }]}>
          Don't have an account?{" "}
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Register</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    textAlign: "center",
  },
  message: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 4,
    width: "100%",
    justifyContent: "center",
  },
  loginBtnText: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  registerBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    width: "100%",
    alignItems: "center",
  },
  registerBtnText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
});
