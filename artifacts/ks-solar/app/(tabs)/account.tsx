import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
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
import {
  getGetMyPaymentsQueryKey,
  getGetReferralStatsQueryKey,
  useGetMyPayments,
  useGetReferralStats,
  useRedeemReferralPoints,
} from "@workspace/api-client-react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { LoginPrompt } from "@/components/LoginPrompt";
import { useColors } from "@/hooks/useColors";
import { confirmAction } from "@/utils/confirm";
import { PAKISTANI_CITIES } from "@/utils/cities";

const hapticSuccess = () => { if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };
const hapticError = () => { if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); };

const INVERTER_BRANDS = [
  { id: "livoltek", name: "Livoltek", color: "#F59E0B" },
  { id: "solarman", name: "Solarman Smart", color: "#EF4444" },
  { id: "goodwe", name: "GoodWe (SEMS+)", color: "#3B82F6" },
  { id: "solarmax", name: "Solar Max", color: "#0EA5E9" },
  { id: "solarmax-hybrid", name: "Solarmax Hybrid", color: "#10B981" },
  { id: "auxol", name: "Auxol", color: "#8B5CF6" },
  { id: "sigenergy", name: "Sigenergy", color: "#F97316" },
  { id: "huawei", name: "Huawei FusionSolar", color: "#EF4444" },
  { id: "growatt", name: "Growatt", color: "#10B981" },
  { id: "solaredge", name: "SolarEdge", color: "#6366F1" },
  { id: "fronius", name: "Fronius", color: "#EC4899" },
  { id: "itel", name: "iTeL Energy Hybrid", color: "#06B6D4" },
  { id: "inverex", name: "Inverex", color: "#14B8A6" },
];

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, updateProfile, changePassword } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: referralData } = useGetReferralStats({
    query: { queryKey: getGetReferralStatsQueryKey(), enabled: !!user && !user.isAdmin },
  });

  const { data: myPayments } = useGetMyPayments({
    query: { queryKey: getGetMyPaymentsQueryKey(), enabled: !!user && !user.isAdmin },
  });

  const { mutate: redeemPoints, isPending: redeeming } = useRedeemReferralPoints({
    mutation: {
      onSuccess: () => {
        hapticSuccess();
        Alert.alert("Request Submitted", "Your payment request has been submitted. Admin will process it shortly.");
      },
      onError: (err: any) => {
        hapticError();
        Alert.alert("Error", err?.response?.data?.error ?? "Could not submit payment request");
      },
    },
  });

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  // Bank account
  const [bankName, setBankName] = useState(user?.bankName ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState(user?.bankAccountNumber ?? "");
  const [bankAccountTitle, setBankAccountTitle] = useState(user?.bankAccountTitle ?? "");
  const [savingBank, setSavingBank] = useState(false);

  // Inverter brand
  const [inverterBrandState, setInverterBrandState] = useState<string | null>(user?.inverterBrand ?? null);
  const [showBrandModal, setShowBrandModal] = useState(false);

  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone);
      setCity(user.city ?? "");
      setBankName(user.bankName ?? "");
      setBankAccountNumber(user.bankAccountNumber ?? "");
      setBankAccountTitle(user.bankAccountTitle ?? "");
      setInverterBrandState(user.inverterBrand ?? null);
    }
  }, [user]);

  if (!user) {
    return (
      <LoginPrompt
        icon="user"
        title="My Account"
        message="Login to view and edit your account profile."
      />
    );
  }

  async function handleSaveProfile() {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter your name");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Required", "Please enter your phone number");
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        city: city.trim() || null,
        ...(!user?.isAdmin && user?.role !== "technician" ? { inverterBrand: inverterBrandState } : {}),
      });
      hapticSuccess();
      Alert.alert("Saved", "Profile updated successfully");
    } catch (err: any) {
      hapticError();
      Alert.alert("Error", err.message ?? "Could not update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPass || !newPass || !confirmPass) {
      Alert.alert("Required", "Please fill in all password fields");
      return;
    }
    if (newPass.length < 6) {
      Alert.alert("Too Short", "New password must be at least 6 characters");
      return;
    }
    if (newPass !== confirmPass) {
      Alert.alert("Mismatch", "New password and confirmation do not match");
      return;
    }
    setSavingPass(true);
    try {
      await changePassword(currentPass, newPass);
      hapticSuccess();
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
      Alert.alert("Done", "Password changed successfully");
    } catch (err: any) {
      hapticError();
      Alert.alert("Error", err.message ?? "Could not change password");
    } finally {
      setSavingPass(false);
    }
  }

  async function handleSaveBank() {
    if (!bankName.trim() || !bankAccountNumber.trim() || !bankAccountTitle.trim()) {
      Alert.alert("Required", "Please fill in all bank account fields");
      return;
    }
    setSavingBank(true);
    try {
      await updateProfile({
        name: user!.name,
        phone: user!.phone,
        bankName: bankName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountTitle: bankAccountTitle.trim(),
      });
      hapticSuccess();
      Alert.alert("Saved", "Bank account saved successfully");
    } catch (err: any) {
      hapticError();
      Alert.alert("Error", err.message ?? "Could not save bank account");
    } finally {
      setSavingBank(false);
    }
  }

  async function handleLogout() {
    confirmAction(
      "Logout",
      "Are you sure you want to logout?",
      async () => {
        await logout();
        router.replace("/(auth)/login");
      },
      "Logout",
      true
    );
  }

  const statusColors: Record<string, string> = {
    approved: "#10B981",
    pending: "#F59E0B",
    rejected: "#EF4444",
  };
  const statusColor = statusColors[user.status] ?? colors.mutedForeground;

  return (
    <>
      <KeyboardAwareScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: bottomPad + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: "#0F172A" }]}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.headerName}>{user.name}</Text>
          <Text style={styles.headerEmail}>{user.email}</Text>
          {user.city ? (
            <View style={styles.cityBadge}>
              <Feather name="map-pin" size={11} color="#FFFFFFBB" />
              <Text style={styles.cityBadgeText}>{user.city}</Text>
            </View>
          ) : null}
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "25", borderColor: statusColor + "55" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Referral + Balance Card — shown to all non-admin users */}
          {!user.isAdmin && user.referralCode && (
            <View style={[styles.referralCard, { backgroundColor: "#0F766E" }]}>
              {/* Header */}
              <View style={styles.referralCardTop}>
                <View style={[styles.referralIconWrap, { backgroundColor: "#FFFFFF18" }]}>
                  <Feather name="gift" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.referralCardTitle}>Referral Program</Text>
                  <Text style={styles.referralCardSub}>Share your code — earn points & balance</Text>
                </View>
              </View>

              {/* Stats row — points, referrals */}
              <View style={styles.referralStatsRow}>
                <View style={[styles.referralStat, { backgroundColor: "#FFFFFF14" }]}>
                  <Feather name="star" size={14} color="#FCD34D" />
                  <Text style={styles.referralStatNum}>{referralData?.points ?? user.referralPoints ?? 0}</Text>
                  <Text style={styles.referralStatLabel}>Points</Text>
                </View>
                <View style={[styles.referralStat, { backgroundColor: "#FFFFFF14" }]}>
                  <Feather name="users" size={14} color="#6EE7B7" />
                  <Text style={styles.referralStatNum}>{referralData?.referralCount ?? 0}</Text>
                  <Text style={styles.referralStatLabel}>Referrals</Text>
                </View>
              </View>

              {/* Balance summary — available vs received */}
              <View style={styles.referralBalanceRow}>
                <View style={[styles.referralBalanceBox, { backgroundColor: "#FFFFFF14" }]}>
                  <View style={styles.referralBalanceTop}>
                    <Feather name="trending-up" size={13} color="#FCD34D" />
                    <Text style={styles.referralBalanceSub}>Available Balance</Text>
                  </View>
                  <Text style={styles.referralBalanceAmt}>
                    PKR {referralData?.balance ?? (user.referralPoints ?? 0)}
                  </Text>
                  <Text style={styles.referralBalanceHint}>Ready to withdraw</Text>
                </View>
                <View style={[styles.referralBalanceBox, { backgroundColor: "#FFFFFF14" }]}>
                  <View style={styles.referralBalanceTop}>
                    <Feather name="check-circle" size={13} color="#6EE7B7" />
                    <Text style={styles.referralBalanceSub}>Total Received</Text>
                  </View>
                  <Text style={styles.referralBalanceAmt}>
                    PKR {(myPayments ?? []).filter(p => p.status === "paid").reduce((s, p) => s + p.amountPkr, 0)}
                  </Text>
                  <Text style={styles.referralBalanceHint}>All-time earnings</Text>
                </View>
              </View>

              {/* Referral Code */}
              <View style={[styles.referralCodeBox, { backgroundColor: "#FFFFFF14" }]}>
                <Text style={styles.referralCodeLabel}>Your Referral Code</Text>
                <Text style={styles.referralCode}>{user.referralCode}</Text>
              </View>

              {/* Buttons */}
              <View style={styles.referralBtnRow}>
                <TouchableOpacity
                  style={[styles.referralBtn, { backgroundColor: "#FFFFFF22" }]}
                  onPress={async () => {
                    await Clipboard.setStringAsync(user.referralCode!);
                    Alert.alert("Copied!", `Code ${user.referralCode} copied to clipboard.`);
                  }}
                  activeOpacity={0.8}
                >
                  <Feather name="copy" size={14} color="#FFFFFF" />
                  <Text style={styles.referralBtnText}>Copy Code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.referralBtn, { backgroundColor: "#FFFFFF22" }]}
                  onPress={() => Share.share({
                    message: `Join K&S Solar Energy app and use my referral code ${user.referralCode} when registering!`,
                    title: "Join K&S Solar Energy",
                  })}
                  activeOpacity={0.8}
                >
                  <Feather name="share-2" size={14} color="#FFFFFF" />
                  <Text style={styles.referralBtnText}>Share</Text>
                </TouchableOpacity>
              </View>

              {/* Request Payment button */}
              {(() => {
                const points = referralData?.points ?? user.referralPoints ?? 0;
                const hasPending = (myPayments ?? []).some(p => p.status === "pending");
                const hasBankAccount = !!(user.bankAccountNumber);
                const canRedeem = points > 0 && hasBankAccount && !hasPending;
                return (
                  <TouchableOpacity
                    style={[styles.referralBtnRow, {
                      backgroundColor: canRedeem ? "#FCD34D22" : "#FFFFFF14",
                      borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
                      justifyContent: "center", alignItems: "center", gap: 8,
                      opacity: redeeming ? 0.7 : 1,
                    }]}
                    onPress={() => {
                      if (!hasBankAccount) {
                        Alert.alert("Bank Account Required", "Please save your bank account details below before requesting payment.");
                        return;
                      }
                      if (hasPending) {
                        Alert.alert("Pending Request", "You already have a pending payment request. Please wait for admin to process it.");
                        return;
                      }
                      if (points === 0) {
                        Alert.alert("No Points", "You don't have any points to redeem yet.");
                        return;
                      }
                      Alert.alert(
                        "Request Payment",
                        `Redeem ${points} points for PKR ${referralData?.balance ?? points}?\n\nPayment will be sent to:\n${user.bankAccountTitle} — ${user.bankAccountNumber} (${user.bankName})`,
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Confirm", onPress: () => redeemPoints() },
                        ]
                      );
                    }}
                    activeOpacity={0.8}
                    disabled={redeeming}
                  >
                    <Feather name="dollar-sign" size={14} color={canRedeem ? "#FCD34D" : "#FFFFFF99"} />
                    <Text style={[styles.referralBtnText, { color: canRedeem ? "#FCD34D" : "#FFFFFF99" }]}>
                      {redeeming ? "Submitting..." : hasPending ? "Payment Pending..." : "Request Payment"}
                    </Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          )}

          {/* Payment History — always visible for non-admin */}
          {!user.isAdmin && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: "#10B98118" }]}>
                  <Feather name="credit-card" size={16} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Received History</Text>
                  <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                    All payment withdrawals
                  </Text>
                </View>
              </View>

              {/* Summary bar */}
              {myPayments && myPayments.length > 0 && (
                <View style={[styles.paymentSummaryBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <View style={styles.paymentSummaryItem}>
                    <Text style={[styles.paymentSummaryVal, { color: "#10B981" }]}>
                      PKR {myPayments.filter(p => p.status === "paid").reduce((s, p) => s + p.amountPkr, 0)}
                    </Text>
                    <Text style={[styles.paymentSummaryLbl, { color: colors.mutedForeground }]}>Total Received</Text>
                  </View>
                  <View style={[styles.paymentSummarySep, { backgroundColor: colors.border }]} />
                  <View style={styles.paymentSummaryItem}>
                    <Text style={[styles.paymentSummaryVal, { color: "#F59E0B" }]}>
                      PKR {myPayments.filter(p => p.status === "pending").reduce((s, p) => s + p.amountPkr, 0)}
                    </Text>
                    <Text style={[styles.paymentSummaryLbl, { color: colors.mutedForeground }]}>Pending</Text>
                  </View>
                  <View style={[styles.paymentSummarySep, { backgroundColor: colors.border }]} />
                  <View style={styles.paymentSummaryItem}>
                    <Text style={[styles.paymentSummaryVal, { color: colors.foreground }]}>
                      {myPayments.length}
                    </Text>
                    <Text style={[styles.paymentSummaryLbl, { color: colors.mutedForeground }]}>Requests</Text>
                  </View>
                </View>
              )}

              {/* Payment list */}
              {!myPayments || myPayments.length === 0 ? (
                <View style={styles.paymentEmpty}>
                  <Feather name="inbox" size={32} color={colors.mutedForeground} />
                  <Text style={[styles.paymentEmptyTitle, { color: colors.foreground }]}>No payments yet</Text>
                  <Text style={[styles.paymentEmptyMsg, { color: colors.mutedForeground }]}>
                    Earn points by referring friends, then withdraw your balance here.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {myPayments.map((payment) => {
                    const isPaid = payment.status === "paid";
                    const isPending = payment.status === "pending";
                    const statusColor = isPending ? "#F59E0B" : isPaid ? "#10B981" : "#EF4444";
                    const statusLabel = isPaid ? "Received" : isPending ? "Pending" : "Rejected";
                    return (
                      <View
                        key={payment.id}
                        style={[styles.paymentRow, { backgroundColor: colors.muted, borderLeftColor: statusColor }]}
                      >
                        {/* Icon */}
                        <View style={[styles.paymentIcon, { backgroundColor: statusColor + "20" }]}>
                          <Feather
                            name={isPaid ? "check-circle" : isPending ? "clock" : "x-circle"}
                            size={18}
                            color={statusColor}
                          />
                        </View>

                        {/* Details */}
                        <View style={{ flex: 1, gap: 3 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold" }}>
                              PKR {payment.amountPkr.toLocaleString()}
                            </Text>
                            <View style={{ backgroundColor: statusColor + "22", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
                              <Text style={{ color: statusColor, fontSize: 11, fontFamily: "Inter_700Bold" }}>
                                {statusLabel}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                            {payment.pointsUsed} points redeemed · {new Date(payment.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                          </Text>
                          {isPaid && payment.paidAt && (
                            <Text style={{ color: "#10B981", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
                              ✓ Paid on {new Date(payment.paidAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                            </Text>
                          )}
                          {payment.adminNote ? (
                            <Text style={{ color: statusColor, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                              Note: {payment.adminNote}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Edit Profile */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="user" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Edit Profile</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Full Name</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="user" size={15} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Phone Number</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="phone" size={15} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="0300-0000000"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* City picker */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>City</Text>
              <TouchableOpacity
                style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={() => setCityModalOpen(true)}
                activeOpacity={0.75}
              >
                <Feather name="map-pin" size={15} color={colors.mutedForeground} />
                <Text style={[styles.input, { color: city ? colors.foreground : colors.mutedForeground }]}>
                  {city || "Select your city"}
                </Text>
                <Feather name="chevron-down" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Email Address</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted + "88", borderColor: colors.border }]}>
                <Feather name="mail" size={15} color={colors.mutedForeground} />
                <Text style={[styles.input, { color: colors.mutedForeground }]}>{user.email}</Text>
                <Feather name="lock" size={13} color={colors.mutedForeground} />
              </View>
            </View>

            {/* Inverter Brand — customers only */}
            {!user.isAdmin && user.role !== "technician" && (
              <View style={styles.fieldGroup}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Text style={[styles.label, { color: colors.foreground, marginBottom: 0 }]}>Inverter Brand</Text>
                  {!user.inverterBrand && (
                    <View style={{ backgroundColor: "#F59E0B22", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: "#F59E0B", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>Unlock Inverter Status</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.inputRow, {
                    backgroundColor: colors.muted,
                    borderColor: !user.inverterBrand ? "#F59E0B" : colors.border,
                    borderWidth: !user.inverterBrand ? 1.5 : 1,
                  }]}
                  onPress={() => setShowBrandModal(true)}
                  activeOpacity={0.75}
                >
                  <Feather name="activity" size={15} color={!user.inverterBrand ? "#F59E0B" : colors.mutedForeground} />
                  <Text style={[styles.input, { color: inverterBrandState ? colors.foreground : colors.mutedForeground }]}>
                    {inverterBrandState
                      ? INVERTER_BRANDS.find((b) => b.id === inverterBrandState)?.name ?? inverterBrandState
                      : "Select your inverter brand"}
                  </Text>
                  <Feather name="chevron-down" size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
                {!user.inverterBrand && (
                  <Text style={{ color: "#F59E0B", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 5 }}>
                    Select to unlock Inverter Status monitoring
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: savingProfile ? colors.mutedForeground : colors.primary }]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
              activeOpacity={0.85}
            >
              <Feather name="check" size={16} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>{savingProfile ? "Saving..." : "Save Profile"}</Text>
            </TouchableOpacity>
          </View>

          {/* Bank Account — non-admin users only */}
          {!user.isAdmin && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: "#10B98118" }]}>
                  <Feather name="credit-card" size={16} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Bank Account</Text>
                  <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                    For receiving referral balance payments
                  </Text>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>Bank Name</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Feather name="home" size={15} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={bankName}
                    onChangeText={setBankName}
                    placeholder="e.g. HBL, Meezan, UBL, JazzCash"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>Account Number / IBAN</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Feather name="hash" size={15} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={bankAccountNumber}
                    onChangeText={setBankAccountNumber}
                    placeholder="e.g. 0123456789 or PK36SCBL..."
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="default"
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>Account Title</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Feather name="user" size={15} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={bankAccountTitle}
                    onChangeText={setBankAccountTitle}
                    placeholder="Account holder name"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: savingBank ? colors.mutedForeground : "#10B981" }]}
                onPress={handleSaveBank}
                disabled={savingBank}
                activeOpacity={0.85}
              >
                <Feather name="check" size={16} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>{savingBank ? "Saving..." : "Save Bank Account"}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Change Password */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: "#EF444418" }]}>
                <Feather name="lock" size={16} color="#EF4444" />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Change Password</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Current Password</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="lock" size={15} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={currentPass}
                  onChangeText={setCurrentPass}
                  placeholder="Enter current password"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showCurrent}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowCurrent(v => !v)}>
                  <Feather name={showCurrent ? "eye-off" : "eye"} size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>New Password</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="key" size={15} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={newPass}
                  onChangeText={setNewPass}
                  placeholder="Min 6 characters"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowNew(v => !v)}>
                  <Feather name={showNew ? "eye-off" : "eye"} size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Confirm New Password</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="check-circle" size={15} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                  placeholder="Repeat new password"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirm(v => !v)}>
                  <Feather name={showConfirm ? "eye-off" : "eye"} size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: savingPass ? colors.mutedForeground : "#EF4444" }]}
              onPress={handleChangePassword}
              disabled={savingPass}
              activeOpacity={0.85}
            >
              <Feather name="shield" size={16} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>{savingPass ? "Changing..." : "Change Password"}</Text>
            </TouchableOpacity>
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: "#EF444444", backgroundColor: "#EF444410" }]}
            onPress={handleLogout}
            activeOpacity={0.85}
          >
            <Feather name="log-out" size={16} color="#EF4444" />
            <Text style={[styles.logoutText, { color: "#EF4444" }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>

      {/* City picker Modal */}
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
                const selected = city === item.name;
                return (
                  <TouchableOpacity
                    style={[
                      styles.cityItem,
                      { borderBottomColor: colors.border },
                      selected && { backgroundColor: colors.primary + "12" },
                    ]}
                    onPress={() => {
                      setCity(item.name);
                      setCityModalOpen(false);
                      setCitySearch("");
                    }}
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

      {/* Inverter Brand picker Modal */}
      <Modal
        visible={showBrandModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBrandModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Inverter Brand</Text>
              <TouchableOpacity onPress={() => setShowBrandModal(false)} activeOpacity={0.7}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={INVERTER_BRANDS}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected = inverterBrandState === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.cityItem,
                      { borderBottomColor: colors.border },
                      selected && { backgroundColor: item.color + "14" },
                    ]}
                    onPress={() => {
                      setInverterBrandState(item.id);
                      setShowBrandModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
                    <Text style={[styles.cityItemText, { color: selected ? item.color : colors.foreground }]}>
                      {item.name}
                    </Text>
                    {selected && <Feather name="check" size={15} color={item.color} />}
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: "center",
    gap: 6,
  },
  avatarWrap: { marginBottom: 8 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontFamily: "Inter_700Bold",
  },
  headerName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  headerEmail: {
    color: "#FFFFFFCC",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  cityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  cityBadgeText: {
    color: "#FFFFFFBB",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  referralCard: { borderRadius: 18, padding: 18, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  referralCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  referralIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  referralCardTitle: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
  referralCardSub: { color: "#FFFFFFBB", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  referralStatsRow: { flexDirection: "row", gap: 8 },
  referralStat: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center", gap: 4 },
  referralStatNum: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_700Bold" },
  referralStatLabel: { color: "#FFFFFFAA", fontSize: 10, fontFamily: "Inter_400Regular" },
  referralCodeBox: { borderRadius: 12, paddingVertical: 14, alignItems: "center", gap: 4 },
  referralCodeLabel: { color: "#FFFFFFAA", fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 1 },
  referralCode: { color: "#FFFFFF", fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: 7 },
  referralBtnRow: { flexDirection: "row", gap: 10 },
  referralBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12 },
  referralBtnText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  referralBalanceRow: { flexDirection: "row", gap: 8 },
  referralBalanceBox: { flex: 1, borderRadius: 12, padding: 12, gap: 4 },
  referralBalanceTop: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  referralBalanceSub: { color: "#FFFFFFBB", fontSize: 11, fontFamily: "Inter_500Medium" },
  referralBalanceAmt: { color: "#FFFFFF", fontSize: 17, fontFamily: "Inter_700Bold" },
  referralBalanceHint: { color: "#FFFFFF88", fontSize: 10, fontFamily: "Inter_400Regular" },
  paymentSummaryBar: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 12, gap: 0 },
  paymentSummaryItem: { flex: 1, alignItems: "center", gap: 3 },
  paymentSummaryVal: { fontSize: 15, fontFamily: "Inter_700Bold" },
  paymentSummaryLbl: { fontSize: 10, fontFamily: "Inter_400Regular" },
  paymentSummarySep: { width: 1, marginVertical: 4, marginHorizontal: 8 },
  paymentEmpty: { alignItems: "center", paddingVertical: 28, gap: 10 },
  paymentEmptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  paymentEmptyMsg: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, paddingHorizontal: 10 },
  paymentRow: { flexDirection: "row", gap: 12, borderRadius: 12, padding: 14, borderLeftWidth: 3, alignItems: "flex-start" },
  paymentIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 16 },
  section: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 2,
  },
  saveBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#00000055",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  cityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cityItemText: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  citySearchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  citySearchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, paddingVertical: 4 },
});
