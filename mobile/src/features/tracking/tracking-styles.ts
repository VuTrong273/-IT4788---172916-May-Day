import { StyleSheet } from "react-native";
import { appColors } from "@/constants/app-theme";
export const trackingStyles = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 14,
    backgroundColor: appColors.surface,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: "700", color: appColors.ink },
  body: { color: appColors.muted, lineHeight: 21 },
  error: { color: "#B42336" },
  input: {
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
    color: appColors.ink,
    backgroundColor: appColors.surface,
  },
  action: { minHeight: 44, justifyContent: "center" },
  link: { color: appColors.primary, fontWeight: "700" },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
  },
  button: {
    backgroundColor: appColors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  selected: { borderColor: appColors.primary, backgroundColor: appColors.warm },
  image: { width: "100%", height: 260, borderRadius: 10 },
});
