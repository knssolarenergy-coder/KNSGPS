import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

const PERFORMANCE_RATIO = 0.80;
const QUICK_SIZES = [3, 5, 8, 10, 12, 15, 20];

interface Props {
  dailyRadiationKWhM2: number | null;
  systemKw: number | null;
  onSetSystemKw: (kw: number | null) => Promise<void>;
}

export function SolarProductionWidget({ dailyRadiationKWhM2, systemKw, onSetSystemKw }: Props) {
  const colors = useColors();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedKw, setSelectedKw] = useState<number | null>(systemKw);
  const [customInput, setCustomInput] = useState(systemKw ? systemKw.toString() : "");

  useEffect(() => {
    setSelectedKw(systemKw);
    setCustomInput(systemKw ? systemKw.toString() : "");
  }, [systemKw]);

  const estimatedKwh =
    systemKw !== null && dailyRadiationKWhM2 !== null && dailyRadiationKWhM2 > 0
      ? Math.round(systemKw * dailyRadiationKWhM2 * PERFORMANCE_RATIO * 10) / 10
      : null;

  function handleSave() {
    const kw = selectedKw ?? (customInput.trim() ? parseFloat(customInput.trim()) : NaN);
    if (!kw || isNaN(kw) || kw <= 0 || kw > 2000) {
      Alert.alert("Invalid Size", "Please select or enter a valid system size (1–2000 kW)");
      return;
    }
    onSetSystemKw(kw);
    setModalOpen(false);
  }

  function openModal() {
    setSelectedKw(systemKw);
    setCustomInput(systemKw ? systemKw.toString() : "");
    setModalOpen(true);
  }

  function pickSize(kw: number) {
    setSelectedKw(kw);
    setCustomInput(kw.toString());
  }

  if (systemKw === null) {
    return (
      <>
        <TouchableOpacity
          style={[styles.setupCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={openModal}
          activeOpacity={0.85}
        >
          <View style={[styles.setupIconWrap, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="zap" size={22} color={colors.primary} />
          </View>
          <View style={styles.setupTextWrap}>
            <Text style={[styles.setupTitle, { color: colors.foreground }]}>See Today's Solar Estimate</Text>
            <Text style={[styles.setupSub, { color: colors.mutedForeground }]}>
              Enter your system size once — get daily kWh estimates based on live weather
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <SystemModal
          visible={modalOpen}
          selectedKw={selectedKw}
          customInput={customInput}
          systemKw={systemKw}
          colors={colors}
          onPickSize={pickSize}
          onCustomChange={(v) => { setCustomInput(v); setSelectedKw(null); }}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
          onRemove={null}
        />
      </>
    );
  }

  return (
    <>
      <View style={[styles.estimateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.estimateHeader}>
          <View style={styles.estimateHeaderLeft}>
            <Feather name="zap" size={16} color={colors.primary} />
            <Text style={[styles.estimateTitle, { color: colors.foreground }]}>Today's Solar Estimate</Text>
          </View>
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "33" }]}
            onPress={openModal}
            activeOpacity={0.7}
          >
            <Feather name="edit-2" size={12} color={colors.primary} />
            <Text style={[styles.editBtnText, { color: colors.primary }]}>{systemKw} kW</Text>
          </TouchableOpacity>
        </View>

        {estimatedKwh !== null ? (
          <View style={[styles.kwhBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "25" }]}>
            <Text style={[styles.kwhNumber, { color: colors.primary }]}>~ {estimatedKwh}</Text>
            <Text style={[styles.kwhUnit, { color: colors.primary }]}>kWh</Text>
          </View>
        ) : (
          <View style={[styles.kwhBox, { backgroundColor: colors.muted + "40", borderColor: colors.border }]}>
            <Feather name="cloud-off" size={18} color={colors.mutedForeground} />
            <Text style={[styles.kwhUnavailable, { color: colors.mutedForeground }]}>
              Weather data loading…
            </Text>
          </View>
        )}

        <View style={styles.metaRow}>
          {dailyRadiationKWhM2 !== null && dailyRadiationKWhM2 > 0 && (
            <View style={styles.metaItem}>
              <Feather name="sun" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {dailyRadiationKWhM2} kWh/m² irradiance
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Feather name="sliders" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              80% performance ratio
            </Text>
          </View>
        </View>
      </View>

      <SystemModal
        visible={modalOpen}
        selectedKw={selectedKw}
        customInput={customInput}
        systemKw={systemKw}
        colors={colors}
        onPickSize={pickSize}
        onCustomChange={(v) => { setCustomInput(v); setSelectedKw(null); }}
        onSave={handleSave}
        onClose={() => setModalOpen(false)}
        onRemove={() => {
          onSetSystemKw(null);
          setModalOpen(false);
        }}
      />
    </>
  );
}

interface ModalProps {
  visible: boolean;
  selectedKw: number | null;
  customInput: string;
  systemKw: number | null;
  colors: ReturnType<typeof useColors>;
  onPickSize: (kw: number) => void;
  onCustomChange: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
  onRemove: (() => void) | null;
}

function SystemModal({ visible, selectedKw, customInput, systemKw, colors, onPickSize, onCustomChange, onSave, onClose, onRemove }: ModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>My Solar System</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Common sizes</Text>
            <View style={styles.chipsRow}>
              {QUICK_SIZES.map((kw) => {
                const active = selectedKw === kw;
                return (
                  <TouchableOpacity
                    key={kw}
                    style={[
                      styles.chip,
                      { borderColor: active ? colors.primary : colors.border },
                      active && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => onPickSize(kw)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, { color: active ? "#FFFFFF" : colors.foreground }]}>
                      {kw} kW
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 16 }]}>Custom size</Text>
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={customInput}
                onChangeText={onCustomChange}
                keyboardType="decimal-pad"
                placeholder="e.g. 7.5"
                placeholderTextColor={colors.mutedForeground}
              />
              <Text style={[styles.inputUnit, { color: colors.mutedForeground }]}>kW</Text>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={onSave}
              activeOpacity={0.85}
            >
              <Feather name="check" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>

            {onRemove && systemKw !== null && (
              <TouchableOpacity style={styles.removeLink} onPress={onRemove} activeOpacity={0.7}>
                <Text style={[styles.removeLinkText, { color: colors.mutedForeground }]}>Remove system</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  setupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  setupIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  setupTextWrap: { flex: 1, gap: 3 },
  setupTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  setupSub: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 16 },
  estimateCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  estimateHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  estimateHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 7 },
  estimateTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  editBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  kwhBox: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  kwhNumber: { fontFamily: "Inter_700Bold", fontSize: 40, lineHeight: 46 },
  kwhUnit: { fontFamily: "Inter_600SemiBold", fontSize: 20 },
  kwhUnavailable: { fontFamily: "Inter_400Regular", fontSize: 13 },
  metaRow: { gap: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontFamily: "Inter_400Regular", fontSize: 12 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000066" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  modalBody: { padding: 20, gap: 10 },
  sectionLabel: { fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
  },
  input: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 16 },
  inputUnit: { fontFamily: "Inter_500Medium", fontSize: 14, marginLeft: 8 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6,
  },
  saveBtnText: { color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 16 },
  removeLink: { alignItems: "center", paddingVertical: 8 },
  removeLinkText: { fontFamily: "Inter_400Regular", fontSize: 13 },
});
