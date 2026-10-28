import { useCallback, useEffect, useState } from "react";
import { ChoiceField } from "@/components/forms/choice-field";
import {
  bodyParts,
  episodeContexts,
  symptomDescriptions,
} from "@/components/forms/form-options";
import { useFocusedReload } from "@/hooks/use-focused-reload";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { Session } from "@/features/auth/session";
import {
  lesionsApi,
  type Episode,
  type LesionLocation,
  type LesionPhoto,
} from "./lesions-api";
import { LesionPhotoForm } from "./lesion-photo-form";
import { trackingStyles as styles } from "./tracking-styles";

export function LesionTimeline({
  session,
  patientId,
  patient,
  editable,
}: {
  session: Session;
  patientId: number;
  patient: boolean;
  editable: boolean;
}) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selected, setSelected] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [context, setContext] = useState("");
  const [medication, setMedication] = useState("");
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [gallery, setGallery] = useState<
    (LesionPhoto & { episodeName: string })[]
  >([]);
  const reload = useFocusedReload(
    useCallback(
      async (isCurrent: () => boolean) => {
        setLoading(true);
        setError(null);
        try {
          const data = await lesionsApi.episodes(session, patientId, patient);
          const groups = await Promise.all(
            data.map(async (episode) =>
              (await lesionsApi.photos(session, episode.episode_id)).map(
                (photo) => ({ ...photo, episodeName: episode.name }),
              ),
            ),
          );
          if (isCurrent()) {
            setEpisodes(data);
            setGallery(
              groups
                .flat()
                .sort(
                  (a, b) =>
                    Date.parse(b.taken_at ?? b.created_at) -
                    Date.parse(a.taken_at ?? a.created_at),
                ),
            );
          }
        } catch (caught) {
          if (isCurrent())
            setError(
              caught instanceof Error
                ? caught.message
                : "Không tải được đợt tổn thương.",
            );
        } finally {
          if (isCurrent()) setLoading(false);
        }
      },
      [session, patientId, patient],
    ),
  );
  async function create() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const episode = await lesionsApi.createEpisode(session, {
        name:
          name.trim() || `Đợt tổn thương ${new Date().toLocaleString("vi-VN")}`,
        description: description.trim(),
        context_other: context.trim(),
        medication_name: medication.trim(),
        occurred_at: new Date().toISOString(),
      });
      setEpisodes((current) => [episode, ...current]);
      setSelected(episode);
      setName("");
      setDescription("");
      setContext("");
      setMedication("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không tạo được đợt.",
      );
    } finally {
      setSaving(false);
    }
  }
  if (selected)
    return (
      <View style={styles.stack}>
        <Pressable
          onPress={() => {
            setSelected(null);
            setAdding(false);
            reload();
          }}
          style={styles.action}
        >
          <Text style={styles.link}>← Danh sách đợt tổn thương</Text>
        </Pressable>
        <EpisodeDetail
          key={selected.episode_id}
          session={session}
          episode={selected}
          editable={patient && editable}
        />
      </View>
    );
  return (
    <View style={styles.stack}>
      <Text style={styles.title}>Nhật ký ảnh của bệnh nhân</Text>
      <Text style={styles.body}>
        Theo dõi xuyên suốt các lần khám. Ảnh mới nhất hiển thị trước.
      </Text>
      {patient && editable ? (
        <Pressable
          style={styles.button}
          onPress={() => setAdding((value) => !value)}
        >
          <Text style={styles.buttonText}>
            {adding ? "Đóng thêm ảnh" : "+ Thêm ảnh"}
          </Text>
        </Pressable>
      ) : null}
      {adding ? (
        <Text style={styles.body}>
          Chọn một đợt bên dưới để thêm ảnh, hoặc tạo đợt mới.
        </Text>
      ) : null}
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        disabled={loading || saving}
        onPress={() => reload()}
        style={styles.action}
      >
        <Text style={styles.link}>Tải lại</Text>
      </Pressable>
      {!loading && !error && !episodes.length ? (
        <Text style={styles.body}>
          Chưa có ảnh theo dõi. Bấm “Thêm ảnh” để bắt đầu.
        </Text>
      ) : null}
      {episodes.map((episode) => (
        <Pressable
          key={episode.episode_id}
          onPress={() => setSelected(episode)}
          style={styles.card}
        >
          <Text style={styles.title}>{episode.name}</Text>
          <Text style={styles.body}>
            {episode.occurred_at
              ? new Date(episode.occurred_at).toLocaleString("vi-VN")
              : "Chưa ghi thời điểm"}
          </Text>
          {episode.description ? (
            <Text style={styles.body}>{episode.description}</Text>
          ) : null}
          <Text style={styles.link}>Xem diễn biến và ảnh →</Text>
        </Pressable>
      ))}
      {patient && editable && adding ? (
        <View style={styles.card}>
          <Text style={styles.title}>Ghi nhận đợt tổn thương mới</Text>
          <Text style={styles.body}>
            Tên đợt tự tạo theo thời gian nếu bạn không chọn tên riêng.
          </Text>
          <ChoiceField
            label="Tên đợt (không bắt buộc)"
            value={name}
            onChange={setName}
            options={["Đợt mới", "Đợt tái phát"]}
            allowCustom
            disabled={saving}
          />
          <ChoiceField
            label="Triệu chứng"
            value={description}
            onChange={setDescription}
            options={symptomDescriptions}
            allowCustom
            maxLength={10000}
            disabled={saving}
          />
          <ChoiceField
            label="Hoàn cảnh xuất hiện (không khẳng định nguyên nhân)"
            value={context}
            onChange={setContext}
            options={episodeContexts}
            allowCustom
            maxLength={500}
            disabled={saving}
          />
          <ChoiceField
            label="Thuốc đã dùng trước khi nổi"
            value={medication}
            onChange={setMedication}
            options={["Không dùng thuốc", "Không nhớ tên thuốc"]}
            allowCustom
            disabled={saving}
          />
          <Pressable
            disabled={saving}
            onPress={() => void create()}
            style={styles.button}
          >
            <Text style={styles.buttonText}>
              {saving ? "Đang lưu…" : "Tạo đợt tổn thương"}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {!adding
        ? gallery.map((photo) => (
            <View key={photo.photo_id} style={styles.card}>
              <Text style={styles.title}>
                {photo.episodeName} · {photo.body_part ?? "Toàn đợt"}
              </Text>
              <Text style={styles.body}>
                {new Date(photo.taken_at ?? photo.created_at).toLocaleString(
                  "vi-VN",
                )}
              </Text>
              <PrivateImage
                session={session}
                attachmentId={photo.attachment_id}
              />
              <Text style={styles.body}>
                Ngứa: {photo.itch_score ?? "—"} · Đau: {photo.pain_score ?? "—"}{" "}
                · Rát: {photo.burn_score ?? "—"}
              </Text>
            </View>
          ))
        : null}
    </View>
  );
}
function EpisodeDetail({
  session,
  episode,
  editable,
}: {
  session: Session;
  episode: Episode;
  editable: boolean;
}) {
  const [photos, setPhotos] = useState<LesionPhoto[]>([]),
    [locations, setLocations] = useState<LesionLocation[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [part, setPart] = useState(""),
    [saving, setSaving] = useState(false);
  const reload = useFocusedReload(
    useCallback(
      async (isCurrent: () => boolean) => {
        setLoading(true);
        setError(null);
        try {
          const [images, parts] = await Promise.all([
            lesionsApi.photos(session, episode.episode_id),
            lesionsApi.locations(session, episode.episode_id),
          ]);
          if (isCurrent()) {
            setPhotos(images);
            setLocations(parts);
          }
        } catch (caught) {
          if (isCurrent())
            setError(
              caught instanceof Error ? caught.message : "Không tải được ảnh.",
            );
        } finally {
          if (isCurrent()) setLoading(false);
        }
      },
      [session, episode.episode_id],
    ),
  );
  async function addLocation() {
    if (saving || !part.trim()) return;
    setSaving(true);
    try {
      const result = await lesionsApi.createLocation(
        session,
        episode.episode_id,
        part.trim(),
      );
      setLocations((current) => [...current, result]);
      setPart("");
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không tạo được vị trí.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <View style={styles.stack}>
      <Text style={styles.title}>{episode.name}</Text>
      {[
        ["Mô tả", episode.description],
        ["Bối cảnh", episode.context_other],
        ["Thuốc", episode.medication_name],
      ]
        .filter(([, value]) => Boolean(value))
        .map(([label, value]) => (
          <Text key={label} style={styles.body}>
            {label}: {value}
          </Text>
        ))}
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        disabled={loading}
        onPress={() => reload()}
        style={styles.action}
      >
        <Text style={styles.link}>Tải lại ảnh</Text>
      </Pressable>
      <Text style={styles.body}>
        Vị trí:{" "}
        {locations.map((location) => location.body_part).join(", ") ||
          "Chưa ghi vị trí"}
      </Text>
      {!loading && !photos.length && !error ? (
        <Text style={styles.body}>Chưa có ảnh theo dõi.</Text>
      ) : null}
      {photos.map((photo) => (
        <View key={photo.photo_id} style={styles.card}>
          <Text style={styles.title}>
            {
              { start: "Khởi phát", peak: "Đỉnh điểm", normal: "Thông thường" }[
                photo.milestone
              ]
            }{" "}
            · {photo.body_part ?? "Toàn đợt"}
          </Text>
          <Text style={styles.body}>
            {new Date(photo.taken_at ?? photo.created_at).toLocaleString(
              "vi-VN",
            )}
          </Text>
          <PrivateImage session={session} attachmentId={photo.attachment_id} />
          <Text style={styles.body}>
            Ngứa: {photo.itch_score ?? "—"} · Đau: {photo.pain_score ?? "—"} ·
            Rát: {photo.burn_score ?? "—"} · Số nốt: {photo.hives_count ?? "—"}
          </Text>
        </View>
      ))}
      {editable ? (
        <>
          <View style={styles.card}>
            <ChoiceField
              label="Vị trí tổn thương"
              value={part}
              onChange={setPart}
              options={bodyParts.filter(
                (item) =>
                  !locations.some((location) => location.body_part === item),
              )}
              allowCustom
              maxLength={100}
              disabled={saving}
            />
            <Pressable
              disabled={saving || !part.trim()}
              onPress={() => void addLocation()}
              style={styles.action}
            >
              <Text style={styles.link}>+ Thêm vị trí</Text>
            </Pressable>
          </View>
          <LesionPhotoForm
            session={session}
            episodeId={episode.episode_id}
            locations={locations}
            onSaved={() => reload()}
          />
        </>
      ) : null}
    </View>
  );
}
function PrivateImage({
  session,
  attachmentId,
}: {
  session: Session;
  attachmentId: string;
}) {
  const [uri, setUri] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [expanded, setExpanded] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    lesionsApi
      .image(session, attachmentId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setUri(value);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError(
            caught instanceof Error ? caught.message : "Không đọc được ảnh.",
          );
      });
    return () => controller.abort();
  }, [session, attachmentId, reload]);
  if (error)
    return (
      <Pressable onPress={() => setReload((n) => n + 1)}>
        <Text style={styles.error}>{error} Bấm để thử lại.</Text>
      </Pressable>
    );
  if (!uri) return <ActivityIndicator />;
  return (
    <>
      <Pressable
        accessibilityLabel="Phóng to ảnh tổn thương"
        onPress={() => setExpanded(true)}
      >
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      </Pressable>
      <Modal visible={expanded} onRequestClose={() => setExpanded(false)}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
          <Pressable style={styles.action} onPress={() => setExpanded(false)}>
            <Text style={styles.link}>Đóng ảnh</Text>
          </Pressable>
          <Image
            source={{ uri }}
            style={{ width: "100%", height: 600 }}
            resizeMode="contain"
          />
        </ScrollView>
      </Modal>
    </>
  );
}
