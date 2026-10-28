import { useRef, useState } from "react";
import { ChoiceField } from "@/components/forms/choice-field";
import { DateField } from "@/components/forms/date-field";
import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { Session } from "@/features/auth/session";
import {
  lesionsApi,
  type Attachment,
  type LesionLocation,
  type LesionPhoto,
} from "./lesions-api";
import { trackingStyles as styles } from "./tracking-styles";

export function LesionPhotoForm({
  session,
  episodeId,
  locations,
  onSaved,
}: {
  session: Session;
  episodeId: string;
  locations: LesionLocation[];
  onSaved: (photo: LesionPhoto) => void;
}) {
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [location, setLocation] = useState("");
  const [milestone, setMilestone] = useState<"start" | "peak" | "normal">(
    "normal",
  );
  const [scores, setScores] = useState({
    itch_score: "",
    pain_score: "",
    burn_score: "",
    hives_count: "",
  });
  const [takenAt, setTakenAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  async function pick() {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsMultipleSelection: false,
      });
      if (result.canceled) return;
      const chosen = result.assets[0];
      if (chosen.fileSize && chosen.fileSize > 5 * 1024 * 1024)
        throw new Error("Chọn ảnh tối đa 5 MB.");
      if (
        chosen.mimeType &&
        !["image/jpeg", "image/png", "image/webp"].includes(chosen.mimeType)
      )
        throw new Error("Chọn ảnh JPEG, PNG hoặc WebP.");
      setAsset(chosen);
      setAttachment(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không mở được thư viện ảnh.",
      );
    }
  }
  async function save() {
    if (!asset || locked.current) return;
    const values: Record<string, number> = {};
    for (const [key, value] of Object.entries(scores)) {
      if (!value.trim()) continue;
      const number = Number(value);
      if (
        !/^\d+$/.test(value) ||
        !Number.isSafeInteger(number) ||
        number > (key === "hives_count" ? 2147483647 : 10)
      ) {
        setError(
          "Điểm ngứa/đau/rát từ 0–10; số nốt mề đay là số nguyên không âm.",
        );
        return;
      }
      values[key] = number;
    }
    if (takenAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(takenAt)) {
      setError("Nhập thời điểm chụp dạng YYYY-MM-DDTHH:mm.");
      return;
    }
    const date = takenAt ? new Date(takenAt) : new Date();
    if (Number.isNaN(date.getTime())) {
      setError("Thời điểm chụp không hợp lệ.");
      return;
    }
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const uploaded = attachment ?? (await lesionsApi.upload(session, asset));
      setAttachment(uploaded);
      const photo = await lesionsApi.createPhoto(session, {
        episode_id: episodeId,
        attachment_id: uploaded.id,
        ...(location ? { location_id: location } : {}),
        milestone,
        taken_at: date.toISOString(),
        ...values,
      });
      setAsset(null);
      setAttachment(null);
      setScores({
        itch_score: "",
        pain_score: "",
        burn_score: "",
        hives_count: "",
      });
      setTakenAt("");
      onSaved(photo);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không lưu được ảnh.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Thêm ảnh theo dõi</Text>
      <Pressable
        disabled={busy || !!attachment}
        onPress={() => void pick()}
        style={styles.action}
      >
        <Text style={styles.link}>
          Chọn ảnh JPEG / PNG / WebP (tối đa 5 MB)
        </Text>
      </Pressable>
      {asset ? (
        <Image
          source={{ uri: asset.uri }}
          style={styles.image}
          resizeMode="contain"
        />
      ) : null}
      <Text style={styles.body}>Vị trí</Text>
      <View style={styles.row}>
        {[{ location_id: "", body_part: "Toàn đợt" }, ...locations].map(
          (item) => (
            <Pressable
              key={item.location_id}
              disabled={busy}
              onPress={() => setLocation(item.location_id)}
              style={[
                styles.card,
                location === item.location_id && styles.selected,
              ]}
            >
              <Text>{item.body_part}</Text>
            </Pressable>
          ),
        )}
      </View>
      <Text style={styles.body}>Mốc diễn biến</Text>
      <View style={styles.row}>
        {(["start", "peak", "normal"] as const).map((value) => (
          <Pressable
            key={value}
            disabled={busy}
            onPress={() => setMilestone(value)}
            style={[styles.card, milestone === value && styles.selected]}
          >
            <Text>
              {
                {
                  start: "Khởi phát",
                  peak: "Đỉnh điểm",
                  normal: "Thông thường",
                }[value]
              }
            </Text>
          </Pressable>
        ))}
      </View>
      <DateField
        label="Thời điểm chụp (bỏ trống: lúc lưu ảnh)"
        value={takenAt}
        onChange={setTakenAt}
        disabled={busy}
        withTime
      />
      {(Object.keys(scores) as (keyof typeof scores)[]).map((key) => (
        <View key={key}>
          <Text style={styles.body}>
            {
              {
                itch_score: "Điểm ngứa 0–10",
                pain_score: "Điểm đau 0–10",
                burn_score: "Điểm rát 0–10",
                hives_count: "Số nốt mề đay",
              }[key]
            }
          </Text>
          <ChoiceField
            label={
              key === "hives_count"
                ? "Chọn số nốt (không rõ: bỏ chọn)"
                : "Chọn điểm (0: không có; 10: cao nhất)"
            }
            value={scores[key]}
            onChange={(value) =>
              setScores((current) => ({ ...current, [key]: value }))
            }
            options={Array.from(
              { length: key === "hives_count" ? 101 : 11 },
              (_, n) => String(n),
            )}
            allowCustom={key === "hives_count"}
            maxLength={10}
            disabled={busy}
          />
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {attachment ? (
        <Text style={styles.body}>
          Ảnh đã tải lên. Nếu lưu thông tin thất bại, bấm lưu lại để dùng ảnh
          này.
        </Text>
      ) : null}
      <Pressable
        disabled={busy || !asset}
        onPress={() => void save()}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {busy ? "Đang lưu…" : "Lưu ảnh và điểm triệu chứng"}
        </Text>
      </Pressable>
    </View>
  );
}
