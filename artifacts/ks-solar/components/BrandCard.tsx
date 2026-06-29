import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Brand {
  id: string;
  name: string;
  country: string;
  portalUrl: string;
  iconName: keyof typeof Feather.glyphMap;
  color: string;
  logoUrl?: string;
}

interface BrandCardProps {
  brand: Brand;
  onPress: (brand: Brand) => void;
}

export function BrandCard({ brand, onPress }: BrandCardProps) {
  const colors = useColors();
  const [imgError, setImgError] = useState(false);
  const showLogo = !!brand.logoUrl && !imgError;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => onPress(brand)}
      activeOpacity={0.75}
    >
      <View style={[styles.iconContainer, { backgroundColor: brand.color + "18" }]}>
        {showLogo ? (
          <Image
            source={{ uri: brand.logoUrl }}
            style={styles.logoImage}
            resizeMode="contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <Feather name={brand.iconName} size={28} color={brand.color} />
        )}
      </View>
      <Text style={[styles.brandName, { color: colors.foreground }]}>{brand.name}</Text>
      <View style={[styles.viewBtn, { backgroundColor: brand.color }]}>
        <Text style={styles.viewBtnText}>View Status</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "47%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  brandName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 20,
  },
  viewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 2,
  },
  viewBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});

export type { Brand };
