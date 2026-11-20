import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { useApi, message } from "@/features/operations/api";
import { apiRequest, type ApiEnvelope } from "@/lib/api/client";
import type { MedicalRecordDetail } from "./medical-records-api";

type Option = {
  id: number;
  option_text: string;
  option_value: string;
  trigger_image_upload: number;
};
type Question = {
  question_id: string;
  question_text: string;
  type_question: string;
  is_required: number;
  allow_image: number;
  placeholder: string | null;
  help_text: string | null;
  parent_question_id: string | null;
  show_if_answer: string | null;
  options: Option[];
};
type Template = {
  name: string;
  sections: {
    section_id: number;
    title: string;
    filled_by: string;
    questions: Question[];
  }[];
};
type Answer = {
  id: number;
  question_id: string;
  question_option_id: number | null;
  answer_text: string | null;
  answer_value: unknown;
};
type AnswerImage = {
  id: number;
  attachment: { file_url: string; file_name: string };
  option_value: string | null;
};

export function RecordForm({
  record,
  canEdit,
  onChanged,
}: {
  record: MedicalRecordDetail;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const api = useApi();
  const { can } = useAuth();
  const canWrite = canEdit && can('PUT', `/medical_records/${record.medical_record_id}/answers`);
  const canComplete = canEdit && can('PUT', `/medical_records/${record.medical_record_id}`);
  const [template, setTemplate] = useState<Template | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [instructions, setInstructions] = useState(record.instructions ?? "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const load = useCallback(async () => {
    const [form, saved] = await Promise.all([
      api<Template>(`/templates/${encodeURIComponent(record.template_id)}`),
      api<Answer[]>(`/medical_records/${record.medical_record_id}/answers`),
    ]);
    setTemplate(form.data);
    setAnswers(saved.data);
    const next: Record<string, string | string[]> = {};
    for (const answer of saved.data) {
      const question = form.data.sections
        .flatMap((section) => section.questions)
        .find((item) => item.question_id === answer.question_id);
      next[answer.question_id] =
        answer.answer_text ??
        (answer.question_option_id
          ? (question?.options.find(
              (option) => option.id === answer.question_option_id,
            )?.option_value ?? "")
          : Array.isArray(answer.answer_value)
            ? answer.answer_value.map(String)
            : answer.answer_value == null
              ? ""
              : String(answer.answer_value));
    }
    setValues(next);
    setDirty(new Set());
  }, [api, record.template_id, record.medical_record_id]);
  useEffect(() => {
    void load().catch((reason) => setError(message(reason)));
  }, [load]);
  function change(questionId: string, value: string | string[]) {
    setValues((current) => ({ ...current, [questionId]: value }));
    setDirty((current) => new Set([...current, questionId]));
    setNotice("");
  }
  const questions =
    template?.sections.flatMap((section) => section.questions) ?? [];
  function visible(question: Question, visiting = new Set<string>()): boolean {
    if (!question.parent_question_id || !question.show_if_answer) return true;
    if (visiting.has(question.question_id)) return false;
    visiting.add(question.question_id);
    try {
      const parent = questions.find(
        (item) => item.question_id === question.parent_question_id,
      );
      const allowed = (
        typeof question.show_if_answer === "string"
          ? JSON.parse(question.show_if_answer)
          : question.show_if_answer
      )[question.parent_question_id] as string[];
      const value = values[question.parent_question_id];
      return (
        !!parent &&
        visible(parent, visiting) &&
        Array.isArray(allowed) &&
        (Array.isArray(value) ? value : [value]).some((item) =>
          allowed.includes(item),
        )
      );
    } catch {
      return false;
    }
  }
  async function save() {
    const updates = questions
      .filter(
        (question) => dirty.has(question.question_id) && visible(question),
      )
      .map((question) => {
        const value = values[question.question_id];
        if (!value || (Array.isArray(value) && !value.length))
          return { question_id: question.question_id, clear: true };
        if (["radio", "select", "checkbox"].includes(question.type_question))
          return { question_id: question.question_id, answer_value: value };
        return { question_id: question.question_id, answer_text: value };
      });
    if (updates.length)
      await api(`/medical_records/${record.medical_record_id}/answers`, "PUT", {
        answers: updates,
      });
    await load();
  }
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title={template?.name ?? "Phiếu khám bệnh"}>
      {error ? (
        <p role="alert" className="form-alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="success-alert">
          {notice}
        </p>
      ) : null}
      {!template && !error ? <p>Đang tải phiếu khám…</p> : null}
      {template?.sections.map((section) => (
        <fieldset key={section.section_id} className="record-form-section">
          <legend>
            {section.title} ·{" "}
            {section.filled_by === "patient"
              ? "Bệnh nhân khai"
              : section.filled_by === "doctor"
                ? "Bác sĩ khám"
                : "Thông tin chung"}
          </legend>
          {section.questions
            .filter((question) => visible(question))
            .map((question) => {
              const editable = canWrite && section.filled_by !== "patient";
              const value = values[question.question_id] ?? "";
              const choiceImages = question.options.filter(
                (option) =>
                  option.trigger_image_upload === 1 &&
                  (Array.isArray(value)
                    ? value.includes(option.option_value)
                    : value === option.option_value),
              );
              return (
                <div
                  key={question.question_id}
                  className="field record-form-field"
                >
                  <label
                    htmlFor={`question-${question.question_id}`}
                    className="field__label"
                  >
                    {question.question_text}
                    {question.is_required === 1 ? " *" : ""}
                  </label>
                  {question.help_text ? (
                    <small>{question.help_text}</small>
                  ) : null}
                  {question.type_question === "image" ? null : [
                      "radio",
                      "select",
                    ].includes(question.type_question) ? (
                    <select
                      id={`question-${question.question_id}`}
                      disabled={!editable || busy}
                      value={String(value)}
                      onChange={(event) =>
                        change(question.question_id, event.target.value)
                      }
                    >
                      <option value="">Chưa chọn</option>
                      {question.options.map((option) => (
                        <option key={option.id} value={option.option_value}>
                          {option.option_text}
                        </option>
                      ))}
                    </select>
                  ) : question.type_question === "checkbox" ? (
                    <div role="group" aria-label={question.question_text}>
                      {question.options.map((option) => (
                        <label key={option.id} className="record-choice">
                          <input
                            type="checkbox"
                            disabled={!editable || busy}
                            checked={
                              Array.isArray(value) &&
                              value.includes(option.option_value)
                            }
                            onChange={(event) =>
                              change(
                                question.question_id,
                                event.target.checked
                                  ? [
                                      ...(Array.isArray(value) ? value : []),
                                      option.option_value,
                                    ]
                                  : (Array.isArray(value) ? value : []).filter(
                                      (item) => item !== option.option_value,
                                    ),
                              )
                            }
                          />
                          {option.option_text}
                        </label>
                      ))}
                    </div>
                  ) : question.type_question === "textarea" ? (
                    <textarea
                      id={`question-${question.question_id}`}
                      disabled={!editable || busy}
                      value={String(value)}
                      onChange={(event) =>
                        change(question.question_id, event.target.value)
                      }
                      placeholder={question.placeholder ?? ""}
                    />
                  ) : (
                    <input
                      id={`question-${question.question_id}`}
                      disabled={!editable || busy}
                      type={
                        question.type_question === "date"
                          ? "date"
                          : question.type_question === "number"
                            ? "number"
                            : "text"
                      }
                      step="any"
                      value={String(value)}
                      onChange={(event) =>
                        change(question.question_id, event.target.value)
                      }
                      placeholder={question.placeholder ?? ""}
                    />
                  )}
                  {can('GET', '/answer-images/:answer_id') && (question.type_question === "image" ||
                  question.allow_image === 1 ||
                  choiceImages.length) ? (
                    <QuestionImages
                      key={`${record.medical_record_id}-${question.question_id}`}
                      question={question}
                      recordId={record.medical_record_id}
                      answer={answers.find(
                        (answer) => answer.question_id === question.question_id,
                      )}
                      canEdit={editable && !busy}
                      optionValues={choiceImages.map(
                        (option) => option.option_value,
                      )}
                      onChanged={load}
                      beforeUpload={save}
                    />
                  ) : null}
                </div>
              );
            })}
        </fieldset>
      ))}
      {canWrite || canComplete ? (
        <div className="record-form-actions">
          {canWrite ? <Button
            disabled={busy || dirty.size === 0}
            onClick={() =>
              void perform(async () => {
                await save();
                setNotice("Đã lưu phiếu khám.");
              })
            }
          >
            Lưu phiếu khám
          </Button> : null}
          {canComplete ? <label className="field">
            <span>Lời dặn khi hoàn tất</span>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              disabled={busy}
            />
          </label> : null}
          {canComplete && (confirm ? (
            <div className="confirm-box">
              <p>
                Hoàn tất sẽ khóa chỉnh sửa phiếu khám. Bệnh nhân vẫn theo dõi
                tại nhà cho đến khi bác sĩ đóng theo dõi.
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await save();
                    await api(
                      `/medical_records/${record.medical_record_id}`,
                      "PUT",
                      {
                        status: "completed",
                        ...(instructions.trim()
                          ? { instructions: instructions.trim() }
                          : {}),
                      },
                    );
                    await onChanged();
                  })
                }
              >
                Xác nhận hoàn tất
              </Button>
              <Button variant="quiet" onClick={() => setConfirm(false)}>
                Hủy
              </Button>
            </div>
          ) : (
            <Button disabled={busy} onClick={() => setConfirm(true)}>
              Hoàn tất khám
            </Button>
          ))}
        </div>
      ) : (
        <p className="muted-copy">
          Phiếu chỉ đọc theo trạng thái hồ sơ và phân công bác sĩ.
        </p>
      )}
    </Panel>
  );
}

function QuestionImages({
  question,
  recordId,
  answer,
  canEdit,
  optionValues,
  onChanged,
  beforeUpload,
}: {
  question: Question;
  recordId: number;
  answer?: Answer;
  canEdit: boolean;
  optionValues: string[];
  onChanged: () => Promise<void>;
  beforeUpload: () => Promise<void>;
}) {
  const api = useApi();
  const { session, can } = useAuth();
  const [images, setImages] = useState<AnswerImage[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [option, setOption] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [pending, setPending] = useState<{
    id: number;
    answerId: number;
    optionValue: string;
  } | null>(null);
  const load = useCallback(async () => {
    setImages(
      answer
        ? (await api<AnswerImage[]>(`/answer-images/${answer.id}`)).data
        : [],
    );
  }, [api, answer]);
  useEffect(() => {
    void load().catch((reason) => setError(message(reason)));
  }, [load]);
  async function upload(file?: File) {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      let link = pending;
      if (!link) {
        if (!file) return;
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024
        )
          throw new Error("Chỉ nhận JPG, PNG, WebP tối đa 5 MB.");
        await beforeUpload();
        let answerId = (
          await api<Answer[]>(`/medical_records/${recordId}/answers`)
        ).data.find((item) => item.question_id === question.question_id)?.id;
        if (!answerId) {
          if (question.type_question !== "image")
            throw new Error("Lưu câu trả lời trước khi tải ảnh.");
          await api(`/medical_records/${recordId}/answers`, "PUT", {
            answers: [{ question_id: question.question_id, answer_value: [] }],
          });
          answerId = (
            await api<Answer[]>(`/medical_records/${recordId}/answers`)
          ).data.find((item) => item.question_id === question.question_id)?.id;
        }
        if (!answerId)
          throw new Error("Không tìm thấy câu trả lời để gắn ảnh.");
        const form = new FormData();
        form.append("file", file);
        form.append("medical_record_id", String(recordId));
        form.append("question_id", question.question_id);
        const image = await apiRequest<ApiEnvelope<{ id: number }>>(
          "/image-attachments/upload",
          { method: "POST", body: form, token: session.token },
        );
        link = {
          id: image.data.id,
          answerId,
          optionValue: optionValues.length
            ? optionValues.includes(option)
              ? option
              : optionValues[0]
            : "",
        };
        setPending(link);
      }
      await api("/answer-images", "POST", {
        answer_id: link.answerId,
        attachment_id: link.id,
        ...(link.optionValue ? { option_value: link.optionValue } : {}),
      });
      setPending(null);
      await onChanged();
      await load();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="record-images">
      {error ? (
        <p role="alert" className="form-alert">
          {error}
        </p>
      ) : null}
      {images.map((image) => (
        <figure key={image.id}>
          <a href={image.attachment.file_url} target="_blank" rel="noreferrer">
            <img
              src={image.attachment.file_url}
              alt={image.attachment.file_name || question.question_text}
            />
          </a>
          {canEdit && can('DELETE', `/answer-images/${image.id}`) ? (
            confirm === image.id ? (
              <div>
                <Button
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void api(`/answer-images/${image.id}`, "DELETE")
                      .then(load)
                      .catch((reason) => setError(message(reason)))
                      .finally(() => {
                        setBusy(false);
                        setConfirm(null);
                      });
                  }}
                >
                  Xác nhận gỡ
                </Button>
                <Button variant="quiet" onClick={() => setConfirm(null)}>
                  Hủy
                </Button>
              </div>
            ) : (
              <Button variant="quiet" onClick={() => setConfirm(image.id)}>
                Gỡ ảnh
              </Button>
            )
          ) : null}
        </figure>
      ))}
      {canEdit && can('POST', '/image-attachments/upload') && can('POST', '/answer-images') ? (
        <div>
          {optionValues.length > 1 ? (
            <select
              aria-label="Lựa chọn gắn ảnh"
              value={optionValues.includes(option) ? option : optionValues[0]}
              onChange={(event) => setOption(event.target.value)}
            >
              {optionValues.map((value) => (
                <option key={value} value={value}>
                  {question.options.find((item) => item.option_value === value)
                    ?.option_text ?? value}
                </option>
              ))}
            </select>
          ) : null}
          {pending ? (
            <Button disabled={busy} onClick={() => void upload()}>
              Thử gắn lại ảnh đã tải
            </Button>
          ) : (
            <label>
              Thêm ảnh (tối đa 5 MB)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void upload(file);
                }}
              />
            </label>
          )}
        </div>
      ) : null}
    </div>
  );
}
