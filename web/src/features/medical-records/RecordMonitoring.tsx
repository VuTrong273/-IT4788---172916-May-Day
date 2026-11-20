import { useAuth } from "@/features/auth/auth-context";
import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { useApi, useData, message } from "@/features/operations/api";
import type { MedicalRecordDetail } from "./medical-records-api";

type Episode = {
  episode_id: string;
  name: string;
  description: string | null;
  occurred_at: string | null;
  context_tags: string | null;
  medication_name: string | null;
};
type Photo = {
  photo_id: string;
  location_id: string | null;
  milestone: string;
  taken_at: string | null;
  created_at: string;
  itch_score: string | null;
  pain_score: string | null;
  burn_score: string | null;
  hives_count: string | null;
  attachment: { file_url: string; file_name: string };
};
type Location = { location_id: string; body_part: string };
type Score = {
  score_date: string;
  iss7: string;
  hss7: string;
  daily_score: string;
  note: string | null;
  medical_record_id: string;
};
type Week = {
  completed_days: string;
  week_score: string;
  severity_label: string;
};

export function RecordMonitoring({
  record,
  canManage,
  onChanged,
}: {
  record: MedicalRecordDetail;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const api = useApi();
  const { can } = useAuth();
  const episodes = useData<Episode[]>(
    `/lesion-episodes/record/${record.medical_record_id}`,
    [],
  );
  const scores = useData<Score[]>(
    `/uas7-scores/patient/${record.patient_id}`,
    [],
  );
  const [start, setStart] = useState("");
  const week = useData<Week | null>(
    `/uas7-scores/week/${record.patient_id}${start ? `?start_date=${start}` : ""}`,
    null,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <Panel title="Theo dõi tại nhà">
      <p>
        Trạng thái:{" "}
        <strong>
          {record.followup_active === false
            ? "Đã ngừng theo dõi"
            : "Đang theo dõi"}
        </strong>
      </p>
      {[error, episodes.error, scores.error, week.error]
        .filter(Boolean)
        .map((text, index) => (
          <p key={index} role="alert" className="form-alert">
            {text}
          </p>
        ))}
      {canManage ? (
        confirm ? (
          <div className="confirm-box">
            <p>
              {record.followup_active === false
                ? "Cho phép bệnh nhân tiếp tục ghi nhật ký và chấm UAS7?"
                : "Ngừng nhận dữ liệu theo dõi mới? Dữ liệu đã ghi vẫn được giữ lại."}
            </p>
            <Button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError("");
                void api(
                  `/medical_records/${record.medical_record_id}`,
                  "PUT",
                  { followup_active: record.followup_active === false },
                )
                  .then(onChanged)
                  .then(() => setConfirm(false))
                  .catch((reason) => setError(message(reason)))
                  .finally(() => setBusy(false));
              }}
            >
              Xác nhận
            </Button>
            <Button variant="quiet" onClick={() => setConfirm(false)}>
              Hủy
            </Button>
          </div>
        ) : (
          <Button onClick={() => setConfirm(true)}>
            {record.followup_active === false
              ? "Mở lại theo dõi"
              : "Ngừng theo dõi"}
          </Button>
        )
      ) : null}
      {can("GET", `/uas7-scores/patient/${record.patient_id}`) ||
      can("GET", `/uas7-scores/week/${record.patient_id}`) ? (
        <>
          <h3>UAS7 theo bệnh nhân</h3>
          <label>
            Ngày bắt đầu 7 ngày
            <input
              aria-label="Ngày bắt đầu tuần UAS7"
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          {week.data ? (
            <p>
              Đã ghi {week.data.completed_days}/7 ngày · Tổng{" "}
              {week.data.week_score}
              /42 · {week.data.severity_label}
            </p>
          ) : null}
          {scores.loading ? (
            <p>Đang tải điểm…</p>
          ) : scores.data.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Ngứa (0–3)</th>
                    <th>Sẩn phù (0–3)</th>
                    <th>Tổng ngày</th>
                    <th>Bệnh án</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.data.map((score) => (
                    <tr key={score.score_date}>
                      <td>{score.score_date}</td>
                      <td>{score.iss7}</td>
                      <td>{score.hss7}</td>
                      <td>{score.daily_score}</td>
                      <td>#{score.medical_record_id}</td>
                      <td>{score.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Chưa có điểm theo dõi.</p>
          )}
        </>
      ) : null}
      {can("GET", `/lesion-episodes/record/${record.medical_record_id}`) ? (
        <>
          <h3>Đợt tổn thương của bệnh án</h3>
          {episodes.loading ? (
            <p>Đang tải nhật ký…</p>
          ) : episodes.data.length ? (
            episodes.data.map((episode) => (
              <EpisodeDetails key={episode.episode_id} episode={episode} />
            ))
          ) : (
            <p>Chưa có đợt tổn thương.</p>
          )}
        </>
      ) : null}
    </Panel>
  );
}

function EpisodeDetails({ episode }: { episode: Episode }) {
  const api = useApi();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void Promise.all([
      can("GET", `/lesion-locations/episode/${episode.episode_id}`)
        ? api<Location[]>(
            `/lesion-locations/episode/${episode.episode_id}`,
            "GET",
            undefined,
            controller.signal,
          )
        : Promise.resolve({ data: [] }),
      can("GET", `/lesion-photos/episode/${episode.episode_id}`)
        ? api<Photo[]>(
            `/lesion-photos/episode/${episode.episode_id}`,
            "GET",
            undefined,
            controller.signal,
          )
        : Promise.resolve({ data: [] }),
    ])
      .then(([places, images]) => {
        if (!controller.signal.aborted) {
          setLocations(places.data);
          setPhotos(images.data);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(message(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, api, can, episode.episode_id]);
  return (
    <details
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="record-form-section"
    >
      <summary>
        {episode.name} ·{" "}
        {episode.occurred_at
          ? new Date(episode.occurred_at).toLocaleString("vi-VN")
          : "Chưa ghi thời điểm"}
      </summary>
      <p>{episode.description}</p>
      {episode.medication_name ? <p>Thuốc: {episode.medication_name}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {loading ? <p>Đang tải ảnh…</p> : null}
      <p>
        Vị trí:{" "}
        {locations.map((location) => location.body_part).join(", ") ||
          "Chưa ghi nhận"}
      </p>
      <div className="record-images">
        {photos.map((photo) => (
          <figure key={photo.photo_id}>
            <figcaption>
              {
                (
                  {
                    start: "Khởi phát",
                    peak: "Nặng nhất",
                    normal: "Trở lại bình thường",
                  } as Record<string, string>
                )[photo.milestone]
              }{" "}
              ·{" "}
              {locations.find(
                (location) => location.location_id === photo.location_id,
              )?.body_part ?? "Toàn đợt"}{" "}
              ·{" "}
              {new Date(photo.taken_at ?? photo.created_at).toLocaleString(
                "vi-VN",
              )}
            </figcaption>
            <a
              href={photo.attachment.file_url}
              target="_blank"
              rel="noreferrer"
            >
              <img
                alt={photo.attachment.file_name || "Ảnh tổn thương"}
                src={photo.attachment.file_url}
              />
            </a>
            <p>
              Ngứa {photo.itch_score ?? "—"}/10 · Đau {photo.pain_score ?? "—"}
              /10 · Rát {photo.burn_score ?? "—"}/10 · Số sẩn phù{" "}
              {photo.hives_count ?? "—"}
            </p>
          </figure>
        ))}
      </div>
    </details>
  );
}
