import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Session } from "@/features/auth/session";
import { LesionTimeline } from "./lesion-timeline";
import { trackingStyles as styles } from "./tracking-styles";

export function LesionTrackingScreen({ session }: { session: Session }) {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 14 }}>
        <Text style={styles.title}>Theo dõi tổn thương</Text>
        <LesionTimeline
          session={session}
          patientId={Number(session.user.user_id)}
          patient
          editable
        />
      </ScrollView>
    </SafeAreaView>
  );
}
