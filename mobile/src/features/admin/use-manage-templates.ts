import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import type { Session } from "@/features/auth/session";
import {
  templatesApi,
  type TemplateItem,
  type TemplateInput,
} from "./templates-api";

const EMPTY_FORM: TemplateInput = {
  code_template: "",
  name: "",
  description: "",
  version: "1.0",
  is_active: "0",
};

/** Owns template loading, form state and mutations for the management screen. */
export function useManageTemplates(session: Session, scrollToForm: () => void) {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [form, setForm] = useState<TemplateInput>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleteCode, setDeleteCode] = useState<string | null>(null);

  function setField<Key extends keyof TemplateInput>(
    key: Key,
    value: TemplateInput[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function edit(template: TemplateItem) {
    setEditing(template.code_template);
    setForm({
      code_template: template.code_template,
      name: template.name,
      description: template.description ?? "",
      version: template.version,
      is_active: template.is_active,
    });
    setError(null);
    setNotice(null);
    setDeleteCode(null);
    scrollToForm();
  }

  async function remove(codeToDelete: string) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await templatesApi.delete(session, codeToDelete);
      setTemplates((current) =>
        current.filter((item) => item.code_template !== codeToDelete),
      );
      if (editing === codeToDelete) resetForm();
      setDeleteCode(null);
      setNotice(`Đã xóa mẫu ${codeToDelete}.`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không xóa được mẫu phiếu.",
      );
      scrollToForm();
    } finally {
      setSaving(false);
    }
  }

  const load = useCallback(
    async (alive: () => boolean) => {
      setLoading(true);
      setError(null);
      try {
        const data = await templatesApi.list(session);
        if (alive()) setTemplates(data);
      } catch (caught) {
        if (alive())
          setError(
            caught instanceof Error
              ? caught.message
              : "Không tải được mẫu phiếu.",
          );
      } finally {
        if (alive()) setLoading(false);
      }
    },
    [session],
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void load(() => alive);
      return () => {
        alive = false;
      };
    }, [load]),
  );

  async function saveTemplate() {
    if (saving) return;
    const normalizedCode = form.code_template.trim().toUpperCase();
    const normalizedName = form.name.trim();
    const normalizedVersion = form.version.trim();
    if (!normalizedCode || !normalizedName || !normalizedVersion) {
      setError("Nhập mã, tên và phiên bản mẫu phiếu.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const input = {
        name: normalizedName,
        description: form.description.trim(),
        version: normalizedVersion,
        is_active: form.is_active,
      };
      const savedTemplate = editing
        ? await templatesApi.update(session, editing, input)
        : await templatesApi.create(session, {
            ...input,
            code_template: normalizedCode,
          });
      setTemplates((current) =>
        editing
          ? current.map((item) =>
              item.code_template === editing ? savedTemplate : item,
            )
          : [savedTemplate, ...current],
      );
      setNotice(
        `Đã ${editing ? "cập nhật" : "tạo"} mẫu ${savedTemplate.code_template}.`,
      );
      resetForm();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không lưu được mẫu phiếu.",
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    templates,
    form,
    setField,
    loading,
    saving,
    error,
    notice,
    editing,
    deleteCode,
    setDeleteCode,
    resetForm,
    edit,
    remove,
    saveTemplate,
  };
}
