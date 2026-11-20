import { canAccess } from "@/features/auth/permissions";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { appColors } from "@/constants/app-theme";
import type { Session } from "@/features/auth/session";
import {
  appendImage,
  chooseImages,
} from "@/features/records/record-image-workflows";
import {
  imageAttachmentsApi,
  validateImageSelection,
  type ImageAttachment,
} from "@/features/records/image-attachments-api";
import {
  lesionDetailsApi as api,
  type LesionLocation,
  type LesionPhoto,
  type Milestone,
} from "./lesion-details-api";

const milestones: Record<Milestone, string> = {
  start: "Khởi phát",
  peak: "Nặng nhất",
  normal: "Trở lại bình thường",
};

export function LesionDetails({
  session,
  episodeId,
  canEdit,
}: {
  session: Session;
  episodeId: string;
  canEdit: boolean;
}) {
  const [locations, setLocations] = useState<LesionLocation[]>([]);
  const [photos, setPhotos] = useState<LesionPhoto[]>([]);
  const [bodyPart, setBodyPart] = useState("");
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<Milestone>("start");
  const [scores, setScores] = useState({
    itch_score: "",
    pain_score: "",
    burn_score: "",
    hives_count: "",
  });
  const [editingPhoto, setEditingPhoto] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<ImageAttachment | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextLocations, nextPhotos] = await Promise.all([
      canAccess(session, "GET", `/lesion-locations/episode/${episodeId}`)
        ? api.locations(session, episodeId)
        : Promise.resolve([]),
      canAccess(session, "GET", `/lesion-photos/episode/${episodeId}`)
        ? api.photos(session, episodeId)
        : Promise.resolve([]),
    ]);
    setLocations(nextLocations);
    setPhotos(nextPhotos);
  }, [session, episodeId]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      canAccess(session, "GET", `/lesion-locations/episode/${episodeId}`)
        ? api.locations(session, episodeId)
        : Promise.resolve([]),
      canAccess(session, "GET", `/lesion-photos/episode/${episodeId}`)
        ? api.photos(session, episodeId)
        : Promise.resolve([]),
    ])
      .then(([nextLocations, nextPhotos]) => {
        if (active) {
          setLocations(nextLocations);
          setPhotos(nextPhotos);
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Không tải được tổn thương.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session, episodeId]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      setConfirmation(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Thao tác không thành công.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function savePhoto() {
    const values: Record<string, number | null> = {};
    for (const [key, value] of Object.entries(scores)) {
      if (
        value !== "" &&
        (!/^\d+$/.test(value) ||
          !Number.isSafeInteger(Number(value)) ||
          (key !== "hives_count" && Number(value) > 10))
      )
        throw new Error(
          "Điểm triệu chứng phải là số nguyên từ 0–10; số sẩn phù là số nguyên không âm.",
        );
      values[key] = value === "" ? null : Number(value);
    }
    if (editingPhoto)
      await api.updatePhoto(session, editingPhoto, { milestone, ...values });
    else {
      let image = pendingImage;
      if (!image) {
        const result = await chooseImages(false);
        if (!result) return;
        if (result.error) throw new Error(result.error);
        const validation = validateImageSelection(
          result.assets.map((asset) => ({
            ...asset,
            fileName: asset.fileName,
          })),
          1,
        );
        if (validation) throw new Error(validation);
        const form = new FormData();
        await appendImage(form, "file", result.assets[0]);
        image = await imageAttachmentsApi.uploadOne(session, form);
        setPendingImage(image);
      }
      await api.createPhoto(session, {
        episode_id: episodeId,
        location_id: locationId,
        attachment_id: image.id,
        milestone,
        ...values,
        taken_at: new Date().toISOString(),
      });
      setPendingImage(null);
    }
    setEditingPhoto(null);
    setScores({
      itch_score: "",
      pain_score: "",
      burn_score: "",
      hives_count: "",
    });
  }

  const button = (label: string, action: () => void, key?: string) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      disabled={busy}
      onPress={action}
      style={[styles.button, busy && { opacity: 0.5 }]}
    >
      <Text style={styles.action}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vị trí và diễn biến qua ảnh</Text>
      {loading ? <ActivityIndicator /> : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {error ? button("Thử tải lại", () => void run(load)) : null}
      {!loading && locations.length === 0 ? (
        <Text>Chưa ghi nhận vị trí tổn thương.</Text>
      ) : null}
      {locations.map((location) => (
        <View key={location.location_id} style={styles.item}>
          <Text style={styles.title}>{location.body_part}</Text>
          {canEdit ? (
            <View>
              {canAccess(
                session,
                "PATCH",
                `/lesion-locations/${location.location_id}`,
              )
                ? button("Đổi tên vị trí", () => {
                    setEditingLocation(location.location_id);
                    setBodyPart(location.body_part);
                  })
                : null}
              {canAccess(
                session,
                "DELETE",
                `/lesion-locations/${location.location_id}`,
              )
                ? confirmation === `location-${location.location_id}`
                  ? button(
                      "Xác nhận xóa vị trí và các mốc ảnh liên quan",
                      () =>
                        void run(async () => {
                          await api.removeLocation(
                            session,
                            location.location_id,
                          );
                          if (locationId === location.location_id)
                            setLocationId(null);
                        }),
                    )
                  : button("Xóa vị trí", () =>
                      setConfirmation(`location-${location.location_id}`),
                    )
                : null}
            </View>
          ) : null}
        </View>
      ))}
      {canEdit &&
      canAccess(
        session,
        editingLocation ? "PATCH" : "POST",
        editingLocation
          ? `/lesion-locations/${editingLocation}`
          : "/lesion-locations",
      ) ? (
        <View>
          <TextInput
            accessibilityLabel="Tên vị trí tổn thương"
            placeholder="Ví dụ: cẳng tay trái"
            value={bodyPart}
            onChangeText={setBodyPart}
            maxLength={100}
            style={styles.input}
          />
          {button(
            editingLocation ? "Lưu tên vị trí" : "Thêm vị trí",
            () =>
              void run(async () => {
                if (!bodyPart.trim())
                  throw new Error("Nhập tên vị trí tổn thương.");
                if (editingLocation)
                  await api.renameLocation(session, editingLocation, bodyPart);
                else await api.createLocation(session, episodeId, bodyPart);
                setBodyPart("");
                setEditingLocation(null);
              }),
          )}
          {editingLocation
            ? button("Hủy đổi tên", () => {
                setEditingLocation(null);
                setBodyPart("");
              })
            : null}
        </View>
      ) : null}
      {photos.map((photo) => (
        <View key={photo.photo_id} style={styles.item}>
          <Text style={styles.title}>
            {milestones[photo.milestone]} ·{" "}
            {locations.find(
              (location) => location.location_id === photo.location_id,
            )?.body_part ?? "Toàn đợt"}
          </Text>
          <Text>
            {new Date(photo.taken_at ?? photo.created_at).toLocaleString(
              "vi-VN",
            )}
          </Text>
          {photo.attachment.file_url ? (
            <Image
              accessibilityLabel={`Ảnh ${milestones[photo.milestone]}`}
              source={{ uri: photo.attachment.file_url }}
              style={styles.image}
            />
          ) : null}
          <Text>
            Ngứa: {photo.itch_score ?? "—"}/10 · Đau: {photo.pain_score ?? "—"}
            /10 · Rát: {photo.burn_score ?? "—"}/10 · Số sẩn phù:{" "}
            {photo.hives_count ?? "—"}
          </Text>
          {canEdit ? (
            <View>
              {canAccess(
                session,
                "PATCH",
                `/lesion-photos/${photo.photo_id}/milestone`,
              )
                ? button("Sửa mốc và điểm", () => {
                    setEditingPhoto(photo.photo_id);
                    setMilestone(photo.milestone);
                    setScores({
                      itch_score: String(photo.itch_score ?? ""),
                      pain_score: String(photo.pain_score ?? ""),
                      burn_score: String(photo.burn_score ?? ""),
                      hives_count: String(photo.hives_count ?? ""),
                    });
                  })
                : null}
              {canAccess(session, "DELETE", `/lesion-photos/${photo.photo_id}`)
                ? confirmation === `photo-${photo.photo_id}`
                  ? button(
                      "Xác nhận gỡ ảnh khỏi đợt",
                      () =>
                        void run(async () => {
                          await api.removePhoto(session, photo.photo_id);
                          if (editingPhoto === photo.photo_id)
                            setEditingPhoto(null);
                        }),
                    )
                  : button("Gỡ ảnh khỏi đợt", () =>
                      setConfirmation(`photo-${photo.photo_id}`),
                    )
                : null}
            </View>
          ) : null}
        </View>
      ))}
      {!loading && photos.length === 0 ? (
        <Text>Chưa có ảnh theo mốc.</Text>
      ) : null}
      {confirmation ? button("Hủy xóa", () => setConfirmation(null)) : null}
      {canEdit &&
      (editingPhoto
        ? canAccess(
            session,
            "PATCH",
            `/lesion-photos/${editingPhoto}/milestone`,
          )
        : canAccess(session, "POST", "/lesion-photos") &&
          canAccess(session, "POST", "/image-attachments/upload")) ? (
        <View style={styles.item}>
          <Text style={styles.title}>
            {editingPhoto ? "Chỉnh sửa mốc ảnh" : "Thêm ảnh theo mốc"}
          </Text>
          {!editingPhoto ? (
            <View>
              {button(locationId === null ? "✓ Toàn đợt" : "Toàn đợt", () =>
                setLocationId(null),
              )}
              {locations.map((location) =>
                button(
                  `${locationId === location.location_id ? "✓ " : ""}${location.body_part}`,
                  () => setLocationId(location.location_id),
                  location.location_id,
                ),
              )}
            </View>
          ) : null}
          {(Object.keys(milestones) as Milestone[]).map((value) =>
            button(
              `${milestone === value ? "✓ " : ""}${milestones[value]}`,
              () => setMilestone(value),
              value,
            ),
          )}
          {(
            [
              ["itch_score", "Mức ngứa (0–10)"],
              ["pain_score", "Mức đau (0–10)"],
              ["burn_score", "Mức rát (0–10)"],
              ["hives_count", "Số sẩn phù"],
            ] as const
          ).map(([key, label]) => (
            <View key={key}>
              <Text>{label}</Text>
              <TextInput
                accessibilityLabel={label}
                keyboardType="number-pad"
                value={scores[key]}
                onChangeText={(value) =>
                  setScores((current) => ({ ...current, [key]: value }))
                }
                style={styles.input}
              />
            </View>
          ))}
          {button(
            busy
              ? "Đang lưu…"
              : editingPhoto
                ? "Lưu mốc và điểm"
                : pendingImage
                  ? "Thử gắn lại ảnh đã tải"
                  : "Chọn ảnh và lưu mốc",
            () => void run(savePhoto),
          )}
          {editingPhoto
            ? button("Hủy sửa mốc", () => {
                setEditingPhoto(null);
                setScores({
                  itch_score: "",
                  pain_score: "",
                  burn_score: "",
                  hives_count: "",
                });
              })
            : null}
        </View>
      ) : (
        <Text>Chỉ xem dữ liệu theo dõi.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 20, gap: 12 },
  title: { color: appColors.ink, fontWeight: "700", fontSize: 16 },
  item: {
    borderTopWidth: 1,
    borderColor: appColors.border,
    paddingTop: 12,
    gap: 8,
  },
  button: { paddingVertical: 10, minHeight: 44 },
  action: { color: appColors.primary, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 8,
    minHeight: 44,
    padding: 10,
    color: appColors.ink,
  },
  image: { width: "100%", height: 220, resizeMode: "contain" },
  error: { color: "#b91c1c" },
});
