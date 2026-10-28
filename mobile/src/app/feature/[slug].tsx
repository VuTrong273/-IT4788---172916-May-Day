import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { appColors } from "@/constants/app-theme";
import { useAuthenticatedSession } from "@/features/auth/use-authenticated-session";
import { ManageTemplates } from "@/features/admin/manage-templates";
import { ClinicalWorkspace } from "@/features/doctor/clinical-workspace";
import { MedicalRecordList } from "@/features/doctor/medical-record-list";
import { PatientsScreen } from "@/features/doctor/patients-screen";
import { LesionTrackingScreen } from "@/features/tracking/lesion-tracking-screen";
import {
  getDemoRole,
  getFeatureRoute,
} from "@/features/navigation/feature-routes";
import { CreateMedicalRecord } from "@/features/patient/create-medical-record";
import { MyMedicalRecords } from "@/features/patient/my-medical-records";
import { MyResults } from "@/features/patient/my-results";
import { Uas7Screen } from "@/features/patient/uas7-screen";

export default function FeatureScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const session = useAuthenticatedSession();
  const feature = getFeatureRoute(slug);
  const role = session ? getDemoRole(session.user.role_id) : null;
  const isAllowed = !!feature && !!role && feature.roles.includes(role);

  if (!session) return <SafeAreaView style={styles.safeArea} />;
  if (isAllowed && slug === "lesion-tracking")
    return <LesionTrackingScreen session={session} />;

  if (isAllowed && slug === "patients")
    return <PatientsScreen session={session} />;

  if (
    isAllowed &&
    (slug === "pending-records" ||
      slug === "in-progress-records" ||
      slug === "completed-records")
  ) {
    return (
      <MedicalRecordList
        session={session}
        status={
          slug === "pending-records"
            ? "pending"
            : slug === "completed-records"
              ? "completed"
              : "in_progress"
        }
      />
    );
  }
  if (isAllowed && slug === "create-medical-record")
    return <CreateMedicalRecord session={session} />;
  if (isAllowed && slug === "my-medical-records")
    return <MyMedicalRecords session={session} />;
  if (isAllowed && slug === "my-results")
    return <MyResults session={session} />;
  if (isAllowed && slug === "uas7") return <Uas7Screen session={session} />;
  if (isAllowed && slug === "manage-templates")
    return <ManageTemplates session={session} />;
  if (isAllowed && (slug === "lab-requests" || slug === "prescriptions")) {
    return (
      <ClinicalWorkspace
        session={session}
        mode={slug === "lab-requests" ? "labs" : "prescriptions"}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>MAY DAY / CHỨC NĂNG</Text>
        <Text style={styles.title}>
          {isAllowed ? feature.title : "Không thể mở trang"}
        </Text>
        <Text style={styles.description}>
          {isAllowed
            ? feature.description
            : "Mục này không thuộc vai trò của tài khoản đang đăng nhập."}
        </Text>

        {isAllowed ? (
          <View style={styles.noticeCard}>
            <View style={styles.statusChip}>
              <Text style={styles.statusText}>ĐANG HOÀN THIỆN</Text>
            </View>
            <Text style={styles.noticeTitle}>Chức năng sắp có mặt</Text>
            <Text style={styles.noticeText}>
              Trang đã được đặt trong luồng sử dụng của May Day. Dữ liệu và thao
              tác sẽ được bổ sung khi phần nghiệp vụ này hoàn thành.
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/home")}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backButtonText}>Về trang chủ</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 40,
  },
  eyebrow: {
    color: appColors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  title: {
    marginTop: 13,
    color: appColors.ink,
    fontSize: 30,
    fontWeight: "800",
  },
  description: {
    marginTop: 10,
    color: appColors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  noticeCard: {
    marginTop: 30,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 22,
    backgroundColor: appColors.surface,
    padding: 23,
  },
  statusChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: appColors.warm,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  statusText: {
    color: appColors.warmInk,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  noticeTitle: {
    marginTop: 20,
    color: appColors.ink,
    fontSize: 21,
    fontWeight: "800",
  },
  noticeText: {
    marginTop: 9,
    color: appColors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  backButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 25,
    borderRadius: 15,
    backgroundColor: appColors.primary,
  },
  backButtonText: { color: appColors.surface, fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.76 },
});
