import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function TabIcon({ name, color }: { name: React.ComponentProps<typeof Feather>["name"]; color: string }) {
  return <Feather name={name} size={22} color={color} />;
}

export default function TabLayout() {
  const colors = useColors();
  const { user, isLoading } = useAuth();
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          shadowOpacity: 0,
          ...(isWeb ? { height: 84 } : { paddingBottom: Math.max(insets.bottom, 8) }),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="inverter"
        options={{
          title: "Inverter",
          href: (user?.role === "technician" || (!user?.isAdmin && !user?.inverterBrand)) ? null : undefined,
          tabBarIcon: ({ color }) => <TabIcon name="activity" color={color} />,
        }}
      />
      <Tabs.Screen
        name="booking"
        options={{
          href: null,
          title: "Book Wash",
          tabBarIcon: ({ color }) => <TabIcon name="droplet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "My Orders",
          href: (user?.role === "technician" || user?.isAdmin) ? null : undefined,
          tabBarIcon: ({ color }) => <TabIcon name="list" color={color} />,
        }}
      />
      <Tabs.Screen
        name="technician"
        options={{
          title: "My Jobs",
          href: user?.role === "technician" && !user?.isAdmin ? undefined : null,
          tabBarIcon: ({ color }) => <TabIcon name="tool" color={color} />,
        }}
      />
      <Tabs.Screen
        name="installation"
        options={{
          href: null,
          title: "Installation",
          tabBarIcon: ({ color }) => <TabIcon name="tool" color={color} />,
        }}
      />
      <Tabs.Screen
        name="complaint"
        options={{
          href: null,
          title: "Complaint",
          tabBarIcon: ({ color }) => <TabIcon name="alert-circle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
          title: "Support",
          tabBarIcon: ({ color }) => <TabIcon name="message-circle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="calculator"
        options={{
          href: null,
          title: "Calculator",
          tabBarIcon: ({ color }) => <TabIcon name="percent" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          href: user?.isAdmin ? null : undefined,
          tabBarIcon: ({ color }) => <TabIcon name="user" color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          href: user?.isAdmin ? undefined : null,
          tabBarIcon: ({ color }) => <TabIcon name="shield" color={color} />,
        }}
      />
    </Tabs>
  );
}
