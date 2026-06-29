import React, { useEffect, useState } from "react";
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ConfirmOptions, setConfirmHandler } from "@/utils/confirm";
import { useColors } from "@/hooks/useColors";

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const colors = useColors();

  useEffect(() => {
    if (Platform.OS !== "web") return;
    setConfirmHandler((opts) => setPending(opts));
    return () => setConfirmHandler(null);
  }, []);

  function handleConfirm() {
    pending?.onConfirm();
    setPending(null);
  }

  function handleCancel() {
    setPending(null);
  }

  return (
    <>
      {children}
      {Platform.OS === "web" && pending && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={handleCancel}
        >
          <View style={styles.overlay}>
            <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.foreground }]}>{pending.title}</Text>
              {!!pending.message && (
                <Text style={[styles.message, { color: colors.mutedForeground }]}>{pending.message}</Text>
              )}
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.cancelBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
                  onPress={handleCancel}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: pending.destructive ? "#EF4444" : "#1E3A5F" }]}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.btnText, { color: "#FFFFFF" }]}>{pending.confirmText}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#00000066",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    borderWidth: 1,
  },
  btnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
